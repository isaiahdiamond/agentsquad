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

- [ ] Batch events per agent every 1.5s or 4 events. Ask the narrator model (see [[Decisions]]) for one plain sentence under 12 words, present tense, in the voice of the agent's role. Emit as `narration`.
- [ ] Cache by input. On error or over 2s, emit a template line like "Editing App.tsx".
- [ ] At `session_end`, compute per-agent stats from the log (files touched, tool calls, active seconds) and ask for a 2-line summary per agent. Emit one `narration` per agent with `text` prefixed `REPORT:`.

### Demo

- [x] Build `demo/target`: a tiny todo app (Vite + React) that's easy to add a dark mode toggle and tests to.
- [ ] Write the demo prompt. Run it 10 times. Record the delegation hit rate in [[Decisions]].
- [ ] Record 3 clean runs. Name the best one `demo/runs/hero.jsonl`.
- [ ] `npx agentsquad` entry point: starts server, opens browser, uses current folder as target. (Stretch: package as a Claude Code plugin.)

## Done when

A real Claude Code session in `demo/target` produces correct events in the arena, deploy writes working agent files, and `hero.jsonl` replays identically.

## Log

- 2026-10-17: emit.mjs, real hook capture (attribution works via `agent_id`; delegation tool is `Agent`; failures arrive as `PostToolUseFailure`), /hook normalizer with thinking timer, deploy/undeploy (byte-identical round trip on a scratch dir), /runs + /replay, template narrator + REPORT lines (model line via Messages API when ANTHROPIC_API_KEY is set, untested without a key), rich 60s mock, demo/target todo app. Bridge.
