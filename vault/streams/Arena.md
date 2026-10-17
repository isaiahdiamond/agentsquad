# Arena

Owns: `/web/src/arena`, `/web/src/report`

The live scene and the match report. This is the demo. Whoever owns it should be the strongest frontend person on the team.

## Look and feel

Match the pixel HUD in the campus mock in [[References]] (top bar, right activity feed). Render all sprites with `image-rendering: pixelated` at integer scales. The scene art is the background; our UI sits on top as a clean overlay.

## Tasks

### Scene

- [x] Load `scenes.json`, render the chosen scene's background full-bleed at 16:9, letterboxed on other screen shapes.
- [x] Place the lead at `scene.lead`. Line specialists up from `scene.bench`.
- [ ] Character component: renders the lead's layered look (outfit, tinted hair, hat) or a specialist's portrait. Scale from the spot.
- [x] Debug overlay (press `D`): show all spots as dots with labels, so the Art stream can tune coordinates.

### Campus

- [x] Map view: on spawn, agent walks from lead along a path to its building door (by role), then fades out.
- [x] Building badge: small portraits of agents inside, pulse when any of them has a tool event.
- [x] Click a building: zoom toward it, crossfade to its interior scene, agents inside are at stations with state effects and bubbles. Back button returns to map.
- [x] On done: agent fades in at the door and walks back to the lead.
- [x] Keep Bar and Beach as single-room scenes (no buildings).

### Live behavior

- [x] On `spawn`: specialist moves from bench to the next free station (spring animation, about 0.8s), an accent-color line draws from lead to them.
- [x] waiting: yellow glow and the hand-raised sprite frame, small "!" bubble. On the map, the building badge turns yellow so you notice from the overview.
- [x] error: animated cartoon fire on the sprite (looping pixel flame sprite overlay, 4-6 frames), little smoke puffs. Clears with a fire-extinguisher puff when the agent's next tool event succeeds. Building badge shows a flame on the map.
- [x] reading, writing, running, searching, thinking: small icon above the head (book, keyboard, terminal, magnifier, "...") plus the speech bubble. Keep these subtle so fire and hand-raise stand out.
- [x] done: green check, walk back to lead.
- [x] Gentle idle bob on every character so the scene never looks frozen.
- [x] Speech bubble above each active agent showing latest narration. Fade after 5s.
- [x] Right rail: activity feed (small portrait + narration line), and a file list showing which agent touched which file.
- [x] Top bar: scene name, timer, tool call count, active agents.

### Report

- [x] On `session_end`, transition to the match report: a card per agent with portrait, role, summary (from `REPORT:` narration), files touched, tool calls, active time.
- [x] MVP badge on the agent with the most files changed.
- [x] "Replay" and "New task" buttons.

### Polish (after checkpoint 2)

- [ ] Scene intro: squad walks in from the edge when the arena opens.
- [ ] Sound effects for spawn, done, error (one file each, mute button).
- [ ] Bar scene gags: reviewer stands behind the bar; done agents raise a glass.
- [ ] Beach scene.

## Done when

The mock session plays start to finish in the UF scene looking demo-ready, and the report shows correct stats.

## Log

- 2026-10-17: Demo 1 arena done on code-drawn art: campus map (walk to door, badges, waiting/error), interiors via click or `?view=<building>`, bar/beach rooms (`?scene=bar`), HUD, effects, report (also fires on lead `agent_done` with no active specialists). Character component is still the code-drawn chibi; lead layered look and sprite PNGs pending art. Arena.
