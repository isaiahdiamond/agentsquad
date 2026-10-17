# Hook findings (Claude Code 2.1.302)

Two headless runs (`claude -p ... --model haiku`), hooks on SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, SubagentStart, SubagentStop, Stop, Notification, SessionEnd. Raw payloads in `samples/` (full runs as `run*.jsonl`, one example per event type as `<Event>-<Tool>[-subagent].json`).

## Answers

- **Delegation tool name: `Agent`.** `tool_input` has `subagent_type`, `description`, `prompt`, `run_in_background`. `Task` was not seen; the server accepts both.
- **Attribution: yes, hooks attribute subagent tool calls.** Every PreToolUse / PostToolUse / PostToolUseFailure fired inside a subagent carries `agent_id` (e.g. `a2ca4114f1f1ff21f`) and `agent_type` (e.g. `helper`). Lead tool calls have neither field. Verified with two parallel subagents: each call carried the right `agent_id`. No transcript tailing needed.
- **Spawn pairing:** `SubagentStart` fires with `agent_id` + `agent_type` right after the lead's `PreToolUse` for `Agent`. `SubagentStop` fires with the same `agent_id`, plus `agent_transcript_path` and `last_assistant_message`. The lead's `PostToolUse` for `Agent` has `tool_response.agentId` (links `tool_use_id` to `agent_id`). `SubagentStart` has no `tool_use_id`, so the spawn prompt is matched FIFO by `subagent_type`.
- **Failed tools:** a non-zero Bash exit does **not** fire `PostToolUse`. It fires `PostToolUseFailure` with `error: "Exit code 1\n<stderr>"`, `is_interrupt`, `duration_ms`, and no `tool_response`. The server also treats a `PostToolUse` whose `tool_response` has `is_error: true` or a non-zero exit code as an error, defensively.
- **Permission denied in headless mode:** `PreToolUse` fires, then nothing (no PostToolUse, no Notification). The server's 2s thinking timer covers this.
- **Notification:** did not fire in `-p` mode, so it is unverified. Expected shape from the docs: `{ hook_event_name: "Notification", message, notification_type }` with `notification_type` like `permission_prompt` / `idle_prompt`. No `agent_id` expected, so it is attributed to the lead. Needs one interactive run to confirm.

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

## Consequences for deploy

Install hooks for SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, **PostToolUseFailure**, **SubagentStart**, SubagentStop, Stop, Notification, **SessionEnd**. Without PostToolUseFailure we never see errors.

How the runs were done: the sandbox blocked running `claude` from another directory, so the runs used cwd = repo worktree with `--settings <scratch>/.claude/settings.json --agents '{...helper...}' --add-dir <scratch>`. Hook behavior is the same either way.
