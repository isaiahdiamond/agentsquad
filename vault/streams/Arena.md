# Arena

Owns: `/web/src/arena`, `/web/src/report`

The live scene and the match report. This is the demo. Whoever owns it should be the strongest frontend person on the team.

## Look and feel

Clean dark product UI per [[References]] (Inter, `#0B0D12`/`#14161D` panels, violet accent); pixel art only in characters and scenes. Render all sprites with `image-rendering: pixelated` at integer scales. The scene art is the background; our UI sits on top as a clean overlay.

## Tasks

### Scene

- [x] Load `scenes.json`, render the chosen scene's background full-bleed at 16:9, letterboxed on other screen shapes.
- [x] Place the lead at `scene.lead`. Line specialists up from `scene.bench`.
- [x] Character component: sprite PNG from `sprites.json` (lead look variant or specialist), integer scale from the spot, feet-anchored. Portraits are head crops of the front sprite.
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
- [x] Beach scene (replaced by The Club, 2026-10-17).

## Done when

The mock session plays start to finish in the UF scene looking demo-ready, and the report shows correct stats.

## Log

- 2026-10-17: Demo 1 arena done on code-drawn art: campus map (walk to door, badges, waiting/error), interiors via click or `?view=<building>`, bar/beach rooms (`?scene=bar`), HUD, effects, report (also fires on lead `agent_done` with no active specialists). Character component is still the code-drawn chibi; lead layered look and sprite PNGs pending art. Arena.
- 2026-10-17: Art Pack 01 wired in. Real scene images (stretched 0.5% to 16:9 so spot fractions stay exact), new `scenes.json` (campus Library/Lab/Union, 3 interiors, office, beach; spot scale = sprite pixel scale on a 1600x900 stage: map 1, rooms 3.3, beach 2). Sprites at integer scale with front/back/mirror facing, hand view for waiting, stepped bob; chibi only as fallback. Done agents wait on their own walkway. Arena.
- 2026-10-17: 96px sprites at whole-number scale snapped to whole pixels (campus 1x, rooms 2x, beach 1x; at 1280x720 rooms round to 1x). Portraits are integer head crops. Campus paths retraced on the brick walks (D overlay numbers each path point); done agents walk back their path and queue on the walk from `bench`. No clean brick route reaches the Union: it leaves on the stub south of the lead and crosses under the big oak's canopy to the Union walk. Broken sprite files fall back to the chibi, no fallback flash before sprites.json, Puff no longer replays on walk/idle. Stations retuned off furniture (office, beach, interiors). HUD, rail, badges, bubbles, Back, notices, debug labels and report restyled to the new UI. Arena.
- 2026-10-17: Arena Art pack. Every scene renders on a 2688x1520 native stage scaled by one transform (letterboxed); spots, sprites and desks in native px at `scene.scale` (campus 1.1 ≈ door height, library 2.75, lab 3.0, union 3.2, office 2.6, beach 1.6, each tuned to that room's chairs/tables). Desks at every `kind: "desk"` station (office/beach lead spot is a desk too), always drawn, y-sorted with agents; seated agent behind its desk (seatLift 0.05 for the 96px art, feet clipped behind the desk), effects above everything. Behavior: walk to a free desk, 150ms crossfade to seated, sit[0]/sit[1] every 180ms while working (lead bobs), thinking pauses, waiting stands beside the desk with hand + yellow glow outline, error stays seated with fire, done stands and walks back to the lead. D overlay shows desk footprints, seat line and a standing-height ruler. Overlays (bubbles, icons, badges) scale with the stage but never below design size on screen. Arena.
- 2026-10-17: Rooms shrunk after review: library 2.4, lab 2.6, union 2.8, office 2.35 (beach 1.6, campus 1.1 unchanged). Extra agents beyond the desk count stand in a row by the bench; agents sit only when the sit frame loaded; stand-beside side faces the room middle; bubbles staggered and capped on small stages. Arena.
- 2026-10-17: Desks only while occupied: poof in when the agent sits, poof out after it stands to leave (waiting/error keep it). Desks sized to agents (standing agent ≈1.075x desk width), seat height derived from the desk. Scales raised: campus 1.4 (agent ≈1.02–1.05x Library/Union doors; the Lab door is much smaller), library 2.65, lab 2.8, union 3.0, office 2.55, beach 1.8. Arena.
- 2026-10-17: Team panel replaces the activity feed: one fixed row per squad member (whole roster when no squad), lead first, roster order, "On call" until spawned; one status line (latest narration, else a short verb from state/tool, done text when done) that crossfades in place, settling to the latest when changes come under 1.5s apart. Files list collapsed under it. Speech bubbles only on spawn (task), waiting and done, 4s. Feed and file data still recorded for the report. Arena.
- 2026-10-17: Scales derived from the user baseline (office agent 255 px = 2.656) via measured furniture, table in Arena Art.md: library 2.5, lab 2.9, union 2.75, beach 1.6, campus 1.5 (≈1.1× Library/Union doors). Desks follow via the fixed agent:desk ratio. Arena.
- 2026-10-17: The Club replaces The Beach. `club` in scenes.json (scale 1.6, about the painted people and a touch taller; lead desk, 4 desk stations and bench all on open deck, table in Arena Art.md); `beach.png` scene and desk deleted; a deployed `scene: "beach"` opens the club. The club borrows the office desk until Art draws one. Arena chrome on the black-and-white tokens: glass `rgba(14,14,16,…)`, dark text `#050505`, debug overlay white/grey instead of blue, report MVP glow white. Arena.
- 2026-10-17: Session Flow finished. Standby hint (bottom center) from `GET /state` polled every 3s until a mission runs: no squad → link to the Builder; deployed, not connected → "Waiting for Claude Code. Run `claude` in this project." with a Copy button and "Deploy before starting Claude, or restart it"; connected → "Connected. Give your lead a task in Claude Code." and the lead's "!" bubble on `session_start`. On `prompt` the lead stands facing the camera with "Got it." (1.2s) then the trimmed task (3s) in one bubble, then takes its desk. Resumed subagents (second `spawn`, same id) get a new delegation key (`spawnAt`), portal back in, walk to their desk and hold Mission complete until their next `agent_done`. Leaving `waiting` drops the needs-you text. A tab opened mid-session is seeded from `/state.live`; the replayed `prompt` keeps its own `ts`, so the timer and briefing are right and agents already delegated start inside/at desks. Nameplate collision avoidance (Plates.tsx) and compact done plates; fixed building signs keeping a stale safe-area nudge from StrictMode's first mount (the Library sign sat by the clock tower). Arena.
