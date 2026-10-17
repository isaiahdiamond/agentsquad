# Bridge

Owns: `/server`, `/hooks`, `/demo`

Gets real Claude Code activity into the browser, writes the squad into the user's project, records and replays runs, and runs the narrator.

## Tasks

### First 2 hours (blocks everyone, do these first)

- [x] Write `hooks/emit.mjs`: read stdin, POST it to `http://localhost:4317/hook`, 300ms timeout, always exit 0, never print anything.
- [x] Install hooks by hand in a scratch project for `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `SubagentStop`, `Stop`. Run a Claude Code session that delegates to a subagent.
- [x] Save every raw payload to `hooks/samples/`. Write `hooks/FINDINGS.md`: which fields exist, which tool name delegation uses (`Task` or `Agent`), and whether a tool call inside a subagent can be traced to that subagent.
- [x] Put the answers in [[Decisions]].

### Core

- [x] `POST /hook` → normalize to `AgentEvent` using the tool-to-state table in [[Contracts]] → broadcast on `/ws` → append to `demo/runs/<sessionId>.jsonl`.
- [x] Track active agents per session so spawns and finishes pair up. Emit `thinking` if an agent has no tool event for 2s.
- [x] (not needed: hooks carry `agent_id`) If hooks can't attribute subagent tool calls: tail transcript JSONL files under `~/.claude/projects/` for the target project and emit events from those instead. Keep `/hook` for spawns and session events.
- [x] `POST /deploy`: write `.claude/agents/<id>.md` per member (frontmatter `name`, `description`, `tools`, `model`; body = `prompt`), write the CLAUDE.md team section between markers, merge our hooks into `.claude/settings.json` after backing it up. Return the written files.
- [x] `POST /undeploy`: reverse all of it.
- [x] `GET /replay/:file`: stream a recorded run with original timing; `speed` param.
- [x] `GET /state`: last deployed squad and scene.

### Narrator

- [x] Calm status lines via Gemini (`gemini-3.5-flash-lite`, key from `.env.local`): per-agent rolling window of the last 8 tool events, one batched call for all changed agents at most every ~4-5s, `narration` only when the meaning changes. Waiting/error/done go out right away.
- [x] Cache by input. On error, timeout (2.5s; 6s when the agent already has a line) or no key, emit a template line like "Editing App.tsx".
- [x] After each turn's Stop, per-agent stats from the log plus one batched Gemini call for the summaries. One `narration` per agent with `text` prefixed `REPORT:` (line 1 summary, line 2 stats).

### Demo

- [x] Build `demo/target`: a tiny todo app (Vite + React) that's easy to add a dark mode toggle and tests to.
- [ ] Write the demo prompt (done: `demo/PROMPT.md`). Run it 10 times (3 so far, 3/3, table in `demo/PROMPT.md`). Record the delegation hit rate in [[Decisions]].
- [ ] Record 3 clean runs. Name the best one `demo/runs/hero.jsonl`.
- [ ] `npx agentsquad` entry point: starts server, opens browser, uses current folder as target. (Stretch: package as a Claude Code plugin.)

## Done when

A real Claude Code session in `demo/target` produces correct events in the arena, deploy writes working agent files, and `hero.jsonl` replays identically.

## Log

- 2026-10-17: emit.mjs, real hook capture (attribution works via `agent_id`; delegation tool is `Agent`; failures arrive as `PostToolUseFailure`), /hook normalizer with thinking timer, deploy/undeploy (byte-identical round trip on a scratch dir), /runs + /replay, template narrator + REPORT lines (model line via Messages API when ANTHROPIC_API_KEY is set, untested without a key), rich 60s mock, demo/target todo app. Bridge.
- 2026-10-17: Gemini narrator. Server scripts load `../.env.local` with `--env-file-if-exists` (key never logged). Status model: rolling window of 8 acts per agent; a 1s tick batches every agent whose window changed, settled 1.5s and last spoke 5s+ ago into ONE Gemini JSON call (`{agentId: line | "SAME"}`); emits only if the gist differs from the agent's last line. Waiting is a fixed line; error/done trigger an immediate batch. Free tier is 15 req/min per key (shared with any other server using it): status batches stop at 10/min, urgent at 13, REPORTs at 15; 429 → 15s cooldown → templates. REPORTs: one batched call per turn, 4s timeout. `npm run replay-hooks -w demo` POSTs `hooks/samples/*.jsonl` to `/hook` with realistic pacing; `-- --scripted` converts the mock's dark-mode session into raw hooks. Mock moved its script to `demo/script.ts`. Bridge.
- 2026-10-17: Narrator review fixes: per-batch ids (a1, a2...) so batches across sessions never swap lines; session_end waits for the turn's REPORTs (capped 5.5s); Finished lines land before REPORTs; SAME normalized and a missing id keeps the current line; stale Waiting cleared; finished agents pruned after REPORT, idle sessions dropped after 30 min; Finished-style done templates; no REPORT for a SessionEnd without a turn; Retry-After honored. Replay sends SessionEnd 50ms after Stop like `claude -p`. Bridge.
- 2026-10-17: Real-session round. Real runs in a deployed target (3 with `claude -p` haiku, 1 interactive driven through `expect`) showed that subagents are async: the lead Stops early and each finished specialist comes back as a `<task-notification>` UserPromptSubmit, which had fragmented every mission. Now one prompt makes one mission and one lead agent_done, sent after every SubagentStop (8s grace, 3 min stall cap). Notifications are never `prompt`. No narration after agent_done. A stalled tool goes back to thinking after 15s (5 min for Bash). Internal `agent_type: ""` SubagentStops are ignored. `prompt` is trimmed to 80 chars, and spawn text is the description or the first line of the prompt. `GET /state` gains `connected`, `hooksSinceDeploy`, `deployedAt` and `live` (phase, mission, per-agent state/task/status/report). `AGENTSQUAD_RAW` dumps raw hooks, and `replay-hooks` replays any raw file. Wrote `demo/PROMPT.md`. Interactive caveat: the trust dialog defaults to "No, exit" and nothing fires until the user trusts the folder. Notification is still unconfirmed. Bridge.
- 2026-10-17: Review fixes. A queued delegation with no SubagentStart (denied, or a type mismatch) holds a mission for 15s, not 3 min; a real prompt clears the queue. A finished mission stays closed: late `<task-notification>`s, lead tools and Stop after it are dropped until the next real prompt. Notification skips done agents. Bash stall is 5 min, the no-hook cap 5 min, and a PostToolUse after a stall sends `thinking`. `/state` drops a session after 5 min without hooks mid-mission; after a server restart the first hook opens `phase: "mission"` with an empty prompt. `prompt` always carries text, and a `/ws` client joining mid-mission gets the mission's `prompt` event first (fixes "No mission yet" in a reloaded Arena). Raw tap privacy note in README; samples scrubbed to `/Users/me`. Verified by replaying raw4, the E2E baseline, `--scripted` and six hand-made cases on port 4417. Bridge.
