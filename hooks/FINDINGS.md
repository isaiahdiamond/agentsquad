# Hook findings (Claude Code 2.1.302)

Two headless runs (`claude -p ... --model haiku`), hooks on SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, SubagentStart, SubagentStop, Stop, Notification, SessionEnd. Raw payloads in `samples/` (full runs as `run*.jsonl`, one example per event type as `<Event>-<Tool>[-subagent].json`).

## Answers

- **Delegation tool name: `Agent`.** `tool_input` has `subagent_type`, `description`, `prompt`, `run_in_background`. `Task` was not seen; the server accepts both.
- **Attribution: yes, hooks attribute subagent tool calls.** Every PreToolUse / PostToolUse / PostToolUseFailure fired inside a subagent carries `agent_id` (e.g. `a2ca4114f1f1ff21f`) and `agent_type` (e.g. `helper`). Lead tool calls have neither field. Verified with two parallel subagents: each call carried the right `agent_id`. No transcript tailing needed.
- **Spawn pairing:** `SubagentStart` fires with `agent_id` + `agent_type` right after the lead's `PreToolUse` for `Agent`. `SubagentStop` fires with the same `agent_id`, plus `agent_transcript_path` and `last_assistant_message`. The lead's `PostToolUse` for `Agent` has `tool_response.agentId` (links `tool_use_id` to `agent_id`). `SubagentStart` has no `tool_use_id`, so the spawn prompt is matched FIFO by `subagent_type`.
- **Failed tools:** a non-zero Bash exit does **not** fire `PostToolUse`. It fires `PostToolUseFailure` with `error: "Exit code 1\n<stderr>"`, `is_interrupt`, `duration_ms`, and no `tool_response`. The server also treats a `PostToolUse` whose `tool_response` has `is_error: true` or a non-zero exit code as an error, defensively.
- **Permission denied in headless mode:** `PreToolUse` fires, then nothing (no PostToolUse, no Notification). The server drops a tool with no PostToolUse back to `thinking` after 15s (5 min for Bash).
- **Notification:** did not fire in `-p` mode, so it is unverified. Expected shape from the docs: `{ hook_event_name: "Notification", message, notification_type }` with `notification_type` like `permission_prompt` / `idle_prompt`. No `agent_id` expected, so the server gives it to the agent with the newest unfinished tool (else the lead) and ignores `idle_prompt`/`auth_success`. Still unconfirmed: our one interactive run inherited auto mode, so no permission prompt appeared. Confirm with `claude --permission-mode default` and a Bash command that needs approval.

## Fields

Common: `session_id`, `transcript_path`, `cwd`, `hook_event_name`. Most also have `prompt_id`, `permission_mode`, `effort`.

| Event | Extra fields |
|---|---|
| SessionStart | `source` (`startup`) |
| UserPromptSubmit | `prompt` |
| PreToolUse | `tool_name`, `tool_input`, `tool_use_id`, `agent_id`/`agent_type` inside subagents |
| PostToolUse | same plus `tool_response`, `duration_ms` |
| PostToolUseFailure | same as PreToolUse plus `error`, `is_interrupt`, `duration_ms` |
| SubagentStart | `agent_id`, `agent_type` |
| SubagentStop | `agent_id`, `agent_type`, `agent_transcript_path`, `last_assistant_message`, `stop_hook_active` |
| Stop | `last_assistant_message`, `stop_hook_active` |
| SessionEnd | `reason` |

## Async subagents (second round, real runs in a deployed demo target)

- **Delegation is async by default.** The lead's `PostToolUse` for `Agent` returns at once with `tool_response: { isAsync: true, status: "async_launched", agentId, ... }`. The lead then hits `Stop` while the specialist is still working.
- **Each finished specialist comes back as a new turn:** `SubagentStop`, then a `UserPromptSubmit` whose `prompt` starts with `<task-notification>` (task id = the subagent's `agent_id`, plus its result), then the lead's follow-up tools and another `Stop`. A demo run of 8 delegations had 8 Stops and 8 notifications. Under a parent Claude session we also saw `<agent-message from="...">` prompts. Neither kind is a user prompt.
- **So the server:** never sends `prompt` for those; holds the lead's `Stop` while any spawned agent has not hit SubagentStop (or a delegation is queued); ends the mission (lead `agent_done` + REPORTs) when the lead has stopped and the team is idle for 8s, or after 5 min without hooks. A queued delegation with no SubagentStart (denied, or a `subagent_type`/`agent_type` mismatch) only holds the mission for 15s. Hooks after the mission ends (late notification, lead tools, Stop) are dropped until the next real prompt. Sample: `samples/async/run3-demo-prompt-async.jsonl` (raw hooks with `tapAt` times; replay with `npm run replay-hooks -w demo -- hooks/samples/async/run3-demo-prompt-async.jsonl`).
- **Resumed subagents:** the lead can wake a finished specialist with `SendMessage` (`tool_input: { to: <agent_id>, summary, message }`; `tool_response: { success, resumedAgentId, ... }`). Claude Code then fires `SubagentStart` again with the **same `agent_id`**, the agent works, and it hits `SubagentStop` again (then another `<task-notification>`). The server emits a fresh `spawn` for the same `agentId` (text = `summary`, else the message's first line, else "Picking up where it left off"), reopens it for the narrator and `/state`, and the mission holds until it stops again. The `SendMessage` call itself is hidden like the `Agent` call; a pending resume holds the mission for up to 15s until its `SubagentStart`. Seen in e2e `main-2` (frontend-dev and reviewer each resumed once).
- **Denied/cancelled permission (interactive):** after `Notification` (`permission_prompt`), pressing Escape fires **no hook at all** (no PostToolUse/Failure, no Stop) until the next prompt or SessionEnd. So `waiting` clears on the next real `UserPromptSubmit` (every waiting agent goes to `thinking`; the lead gets `prompt` + `thinking`), and after **60s with no further hook for that agent** it drops back on its own (lead → `idle`, a subagent → `thinking`), as a bare state change with no narration. A cancelled turn has no `Stop`, so its mission gets no lead `agent_done` of its own; the next prompt starts a new mission.
- **Internal agents:** Claude Code can fire `SubagentStop` with `agent_type: ""` and an `agent_id` that never had a `SubagentStart` (its own helper agents). Ignored.
- **Order varies:** `SubagentStart` can come before or after the lead's `PostToolUse` for `Agent`. Spawn text is still matched FIFO by `subagent_type` from the `PreToolUse`.
- **Setup that matters in interactive mode:** a new folder shows the "Do you trust this folder?" dialog, and its default is **No, exit**. No hooks fire (not even SessionStart) until the user picks "Yes, I trust this folder". Hooks are read when Claude starts, so deploy first, or restart `claude` after deploying. `claude -p` skips the trust dialog.
- **Hook config is fine as written:** `.claude/settings.local.json` with `{ matcher: "", hooks: [{ type: "command", command: "AGENTSQUAD_PORT=<port> node \"<abs>/hooks/emit.mjs\"" }] }` per event works on 2.1.302. Seen firing from it: all events except Notification in `-p` mode; SessionStart, UserPromptSubmit, Pre/PostToolUse, SubagentStart/Stop, Stop, SessionEnd in an interactive run (driven through `expect`). Running `claude` with cwd = the target works (no sandbox issue this round).
- **Raw capture:** start the server with `AGENTSQUAD_RAW=/path/raw.jsonl` to append every hook payload (with `tapAt`).

## Turns vs sessions

`Stop` fires at the end of every turn (each time Claude finishes answering a prompt), not only when the session ends. `SessionEnd` fires once, when Claude Code exits. So the server does this:

- `Stop`: lead `agent_done`, then one `REPORT:` narration per agent that worked this turn, once no subagent is still running (see Async subagents). No `session_end`.
- `UserPromptSubmit` after a `Stop`: `prompt`, then the lead goes straight to `thinking`. Stats restart for the new turn.
- `Notification` between `Stop` and the next prompt (e.g. `idle_prompt`) is ignored, so the hand doesn't go up while Claude is idle.
- `SessionEnd`: `session_end`, and the session is dropped from memory.

## Consequences for deploy

Hooks go in `.claude/settings.local.json` (per machine, usually not committed; the command has an absolute local path). Install hooks for SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, **PostToolUseFailure**, **SubagentStart**, SubagentStop, Stop, Notification, **SessionEnd**. Without PostToolUseFailure we never see errors.

How the runs were done: the sandbox blocked running `claude` from another directory, so the runs used cwd = repo worktree with `--settings <scratch>/.claude/settings.json --agents '{...helper...}' --add-dir <scratch>`. Hook behavior is the same either way.
