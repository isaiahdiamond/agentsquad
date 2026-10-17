# Arena

Owns: `/web/src/arena`, `/web/src/report`

The live scene and the match report. This is the demo. Whoever owns it should be the strongest frontend person on the team.

## Look and feel

Broadcast style, not pixel office. Think a sports game halftime screen: bold type, accent-color glows, smooth camera-feel transitions. The scene art is the background; our UI sits on top as a clean overlay.

## Tasks

### Scene

- [ ] Load `scenes.json`, render the chosen scene's background full-bleed at 16:9, letterboxed on other screen shapes.
- [ ] Place the lead at `scene.lead`. Line specialists up from `scene.bench`.
- [ ] Character component: renders the lead's layered look (outfit, tinted hair, hat) or a specialist's portrait. Scale from the spot.
- [ ] Debug overlay (press `D`): show all spots as dots with labels, so the Art stream can tune coordinates.

### Live behavior

- [ ] On `spawn`: specialist moves from bench to the next free station (spring animation, about 0.8s), an accent-color line draws from lead to them.
- [ ] Per state effects on one image, no new art: thinking = pulsing ring, reading = scanning beam, searching = radar sweep, writing = typing sparks, running = spinning terminal glyph, waiting = slow blink, error = red shake, done = check mark then return to bench.
- [ ] Gentle idle bob on every character so the scene never looks frozen.
- [ ] Speech bubble above each active agent showing latest narration. Fade after 5s.
- [ ] Right rail: activity feed (small portrait + narration line), and a file list showing which agent touched which file.
- [ ] Top bar: scene name, timer, tool call count, active agents.

### Report

- [ ] On `session_end`, transition to the match report: a card per agent with portrait, role, summary (from `REPORT:` narration), files touched, tool calls, active time.
- [ ] MVP badge on the agent with the most files changed.
- [ ] "Replay" and "New task" buttons.

### Polish (after checkpoint 2)

- [ ] Scene intro: squad walks in from the edge when the arena opens.
- [ ] Sound effects for spawn, done, error (one file each, mute button).
- [ ] Bar scene gags: reviewer stands behind the bar; done agents raise a glass.

## Done when

The mock session plays start to finish in the UF scene looking demo-ready, and the report shows correct stats.

## Log
