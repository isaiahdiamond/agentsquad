# Decisions

## Settled

- Claude Code only. No other harnesses.
- Web app on localhost, one server on port 4317. No database.
- Stack: Vite, React, TypeScript, Tailwind, Framer Motion. Node server with `ws`.
- Characters are premade layered art. No live image generation in the app.
- Specialists are premade characters with fixed looks and pre-written agent files. Only the lead gets full customization.
- Scenes are data: one background image plus spot coordinates.
- Scene order: UF Campus first, The Bar second, Office last and first to cut.
- No official UF logos or the Gator mascot in any art.
- Replay mode is never cut.
- A deployed replay site for judges (static build playing a recorded run).

## Open (owner decides by the hour shown)

| Question | Owner | By |
|---|---|---|
| Art route: illustrated (A) or LPC pixel kit (B) | Art | hour 3 |
| Can hooks attribute tool calls to the right subagent? If not, transcript tailing | Bridge | hour 2 |
| Which tool name delegates: `Task`, `Agent`, or both | Bridge | hour 2 |
| Gemini role: build-time asset edits, runtime narration, or both (check sub-track rules) | Team | hour 1 |
| Narrator model: Gemini Flash or Claude Haiku | Team | hour 1 |
| Demo task and demo repo | Team | hour 10 |
| Delegation hit rate on demo prompt (target 8/10) | Bridge | hour 24 |

## Requests

Agents: write contract change requests here, then stop and wait.

- (none yet)

## Log

Add one line per decision made: date, hour, what, who.
