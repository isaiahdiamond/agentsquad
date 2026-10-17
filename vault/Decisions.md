# Decisions

## Settled

- Claude Code only. No other harnesses.
- Web app on localhost, one server on port 4317. No database.
- Stack: Vite, React, TypeScript, Tailwind, Framer Motion. Node server with `ws`.
- Characters are premade layered art. No live image generation in the app.
- Specialists are premade characters with fixed looks and pre-written agent files. Only the lead gets full customization.
- Scenes are data: one background image plus spot coordinates.
- No official UF logos or the Gator mascot in any art.
- Replay mode is never cut.
- A deployed replay site for judges (static build playing a recorded run).
- Art style: 32-bit chibi isometric pixel art for everything (characters, scenes, UI). Dark outlines, 3-4 tone shading, isometric 3/4 top-down camera. See [[References]].
- UI look: dark navy panels, gold pixel borders, pixel font (Press Start 2P or Silkscreen from Google Fonts), gold primary buttons.
- Scenes: UF Campus (overview map) with clickable building interiors, The Bar, The Beach. The standalone Office scene is dropped; building interiors replace it.
- Interiors: 2 max, reused across buildings. A library reading room (Collegiate Gothic, inspired by Smathers Library) and a lab.
- Characters are original. No Marvel, no real people, no NBA players or logos, no UF logos or Gator mascot.
- Characters are engineers, not heroes. The app is an engineering tool with a pixel art skin, not a game. Roles are named plainly (Frontend Agent, Backend Agent). No villains, powers, or game mechanics.
- Status is shown with small fun animations on the sprite: waiting for the user = yellow glow and hand raised; error or failing test = sprite catches cartoon fire until fixed.
- Lead customization uses palette swaps in code: one base sprite per body, hair and outfit colors swapped by replacing exact pixel colors. Plus a small set of full outfit variants and hat overlays. Pixel art makes this reliable where AI-generated layers are not.

### Event conventions (architect, after Phase 0)

These fill gaps in [[Contracts]] without changing any type.

- **Any event can carry `state`.** The Arena sets an agent's state whenever an event has one. A state change with no tool (thinking, waiting) is sent as `kind: "tool_start"` with `state` and no `tool`.
- **Errors:** a failed tool is `kind: "tool_end"` with `state: "error"`. The next successful `tool_start` from that agent clears it.
- **Spawn:** `agentId` and `agentType` are the new subagent's; `parentId` is `"lead"`. The lead's own Task/Agent call does not get a separate event.
- **Instance ids:** `agentId` is unique per spawn (the Bridge picks the format; mock uses `frontend-dev-1`). The Arena keys characters by `agentId` and looks them up in the roster by `agentType`.
- **Paths:** the server answers at bare paths (`/hook`, `/deploy`, ...). The browser calls `/api/...`; the Vite proxy strips `/api`. `/ws` is proxied as is.
- **Mock feed:** `npm run mock` connects to `/ws` as a client and the server relays its messages to every other client. Dev only.
- **Map paths:** `paths[i]` is the walk route from `lead` to `buildings[i].door`, in the same order as `buildings`.
- **Runs:** each run is recorded as `demo/runs/<sessionId>.jsonl`. `GET /runs` returns `{ file, events, startedAt, durationMs }[]`, newest first. `GET /state` returns `{ squad, scene, target }`.
- **Scene for the Arena:** `GET /state` scene if a squad was deployed, otherwise `uf-campus`.
- **Character fields:** `name` is the display name ("Frontend Agent"); `role` is the one-line job description shown under it. `stats` are unused (send 50/50/50). The lead is sent with `id: "lead"`, `portrait: ""`, `tools: []`, `model: "inherit"`; the Bridge ignores the lead's tools and model and writes no agent file for it.
- **Missing art:** every image the UI loads has a code-drawn fallback (colored box plus label) so the app runs before art lands. No agent generates image files. Art requests go to the Art stream (a human) through `vault/Art Requests.md`.

## Open (owner decides by the hour shown)

| Question | Owner | By |
|---|---|---|
| Lead sprite test: one base body, 2 outfits, 2 hair styles, palette swap works in code | Art + Builder | hour 3 |
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

- 2026-10-17: Applied Vault Update 01 (pixel art style, campus map with buildings, new roster, new Scene contract). Architect.
- 2026-10-17: Event conventions above, settling the Phase 0 ambiguities. Architect.
