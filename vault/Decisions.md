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
- UI look (updated 2026-10-17 by the user): deep black and white everywhere, matching the welcome screen — background `#050505`, panels `#0E0E10`, white accent with black text on white. Blue dropped. Pixel art only in characters and scenes; agent identity colors stay.
- Scenes: UF Campus (overview map) with clickable building interiors, The Bar, The Beach. The standalone Office scene is dropped; building interiors replace it.
- Interiors: 2 max, reused across buildings. A library reading room (Collegiate Gothic, inspired by Smathers Library) and a lab.
- Characters are original. No Marvel, no real people, no NBA players or logos, no UF logos or Gator mascot.
- Characters are engineers, not heroes. The app is an engineering tool with pixel art inside it, not a game. Roles are named plainly (Frontend Agent, Backend Agent). No villains, powers, or game mechanics.
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
- **Turns:** REPORT narrations arrive after each turn's Stop; session_end only on SessionEnd.
- **Missing art:** every image the UI loads has a code-drawn fallback (colored box plus label) so the app runs before art lands. No agent generates image files. Art requests go to the Art stream (a human) through `vault/Art Requests.md`.

### Art Pack 01 (2026-10-17, delivered by Art)

See [[Art Pack]]. It supersedes the sizes in [[Art Requests]] where they differ.

- **Characters** are single images per view: `front`, `back`, `hand` (hand raised), **96px tall, each sprite keeping its own colors** (the first 44px shared-palette pass destroyed the art), listed in `web/public/art/sprites.json`. Typical scales: campus map 1×, rooms 2×, builder preview 4×. Left/right facing = flip front/back horizontally. No walk-cycle frames: walking is the front or back image with a bob. Draw at integer scale, anchored at the feet.
- **Lead looks** are full variants, not layers: body `a` or `b` × outfit `blazer`, `hoodie`, `flannel`, `track`. In `Look`, `body` is `"a"`/`"b"`, `outfit` is the outfit id, `hair` and `hat` are `"none"`, `hairColor` is unused for now. The Color/Hair/Hat tabs are hidden until recolor art lands. `looks.json` is retired.
- **Portraits** come from each character's `front` sprite (head crop, upscaled in code). No separate portrait files.
- **Scenes:** `uf-campus` (map) with 3 buildings: top-left Library (scout, docs-writer → `interior-library`), top-right Lab (backend-dev, test-engineer → `interior-lab`), bottom-right Union (frontend-dev, reviewer → `interior-union`). Rooms you can pick directly: `office` and `beach`. The Bar/Club is dropped. The welcome screen uses `web/public/art/scenes/welcome-bg.png` (not a scene in scenes.json).
- Scene art is 2688×1520; render it to fit the 16:9 stage.

### Narrator (2026-10-17, user)

- **Narrator model: Google Gemini** (`gemini-3.5-flash-lite`, via the Gemini API; hackathon requirement). Key lives in `.env.local` as `GEMINI_API_KEY` (git-ignored, never committed); the server loads it at startup. Template lines are the fallback when the key is missing or a call fails or is slow.
- **Calm status, not a feed:** the narrator turns each agent's raw tool events into one short, plain status line ("Working on the header toggle", "Fixing a failing test") and only emits a new `narration` for that agent when the meaning changes, at most every few seconds. `REPORT:` lines at the end of a turn are unchanged.
- **Arena shows a stationary Team panel** (one row per agent, status line crossfades in place) instead of a scrolling activity feed; speech bubbles only for key moments (task assigned, needs you, done).

## Open (owner decides by the hour shown)

| Question | Owner | By |
|---|---|---|
| Lead sprite test: one base body, 2 outfits, 2 hair styles, palette swap works in code | Art + Builder | hour 3 |
| Can hooks attribute tool calls to the right subagent? If not, transcript tailing | Bridge | hour 2 — **Answered: yes.** Tool hooks fired inside a subagent carry `agent_id` + `agent_type`; `SubagentStart`/`SubagentStop` carry the same `agent_id`. No transcript tailing. See `hooks/FINDINGS.md` |
| Which tool name delegates: `Task`, `Agent`, or both | Bridge | hour 2 — **Answered: `Agent`** on v2.1.302 (`tool_input.subagent_type`). Server accepts both |
| Gemini role: build-time asset edits, runtime narration, or both (check sub-track rules) | Team | hour 1 |
| Demo task and demo repo | Team | hour 10 |
| Delegation hit rate on demo prompt (target 8/10) | Bridge | hour 24 |

### Arena Art pack (2026-10-17, delivered by Art)

See [[Arena Art]]: native-size stage (2688x1520) scaled by one transform, desk stations, seated typing agents, y-sorted layering. Contract additions approved by the user with this pack: `Scene.scale` and `Spot.kind: "desk"`. Sprites stay **96px with per-sprite colors** (the pack's script reverted to 44px + shared palette; not used), so the pack's starting scales are multiplied by 44/96: rooms ≈2.75, beach ≈1.83, campus ≈0.92. Sprite manifest gains `sit` frames per look and `desks` per room.

### Lead customization (2026-10-17, user)

See [[Character Customization]]: the lead is layered (type, outfit, skin, hair, hair color; robot/dog/gator are complete characters), composed in code into an offscreen canvas and cached. `Look` gains an optional `skin`; `body` holds the type (approved by the user with this spec). Lead art comes from `tools/fetch_lead.py` into `web/public/art/lead/` + `lead.json`, **run at 96px** to match the specialists and scene scales (the spec's 44px predates the 96px switch). Its shared palette is intentional here: skin swapping needs identical skin hexes across outfits.

## Requests

Agents: write contract change requests here, then stop and wait.

- **Replace `LookManifest` with a `SpriteManifest` type** matching `web/public/art/sprites.json` (architect, pending human approval). Until then, code reads `sprites.json` with a local type and `LookManifest` goes unused.

## Log

Add one line per decision made: date, hour, what, who.

- 2026-10-17: Applied Vault Update 01 (pixel art style, campus map with buildings, new roster, new Scene contract). Architect.
- 2026-10-17: Event conventions above, settling the Phase 0 ambiguities. Architect.
- 2026-10-17: Hooks attribute subagent tool calls via `agent_id`/`agent_type`; delegation tool is `Agent`; failed tools fire `PostToolUseFailure` (not PostToolUse), so deploy installs that hook plus `SubagentStart` and `SessionEnd`. Notification unverified in headless mode. Bridge.
- 2026-10-17: Stop fires every turn, so REPORTs are per turn and session_end comes only from SessionEnd. Deploy writes hooks to `.claude/settings.local.json`. Server binds 127.0.0.1 and requires JSON content-type on /deploy and /undeploy. Bridge.
