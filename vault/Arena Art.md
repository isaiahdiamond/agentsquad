# Arena Art: Scaling, Desks and Seated Agents

Two jobs: fix sprite proportions in the scenes, and make agents sit and work at desks instead of standing around.

## 1. Get the new art

```
python tools/fetch_art.py
```

New since last time (all listed in `web/public/art/sprites.json`):

- `sit` frames for every look: `team[id].sit` has 2 frames (typing animation), `lead.looks[id].sit` has 1
- `desks[sceneId]`: one desk per room, drawn to match it: `interior-library`, `interior-lab`, `interior-union`, `office`, `beach`

Seated sprites are already at the correct size relative to the standing sprites (shorter than 44px). Never resize them to 44.

## 2. Scaling fix (do this first)

The sprites lost their proportions because they are sized separately from the background. Fix it like this:

- Each scene is drawn on a stage at the background's native size, **2688x1520**. All positions and sizes are in those native pixels.
- A spot `{x, y}` in scene JSON is a fraction of the image: native position = `x * 2688`, `y * 1520`.
- A sprite is drawn at `spriteWidth * scene.scale` by `spriteHeight * scene.scale` native pixels. Desks and seated sprites use the same `scene.scale` as standing sprites.
- Then the whole stage is scaled to fit the viewport with **one** transform, keeping 16:9 (letterbox if needed). Nothing inside the stage is sized in CSS pixels or viewport units.
- Smoothing off everywhere: `image-rendering: pixelated` on the stage and every image, `ctx.imageSmoothingEnabled = false` if using canvas.
- Anchor every sprite and desk at bottom-center.

Starting scales (tune with the `D` debug overlay):

| Scene | scale | standing agent height |
|---|---|---|
| interior-library, interior-lab, interior-union, office | 6 | about 17% of scene height |
| beach | 4 | about 12% |
| uf-campus | 2 | about 6% (door height) |

These come from the team's test: 44px sprites at 3x looked right on an 805px-tall view of the library, which is about 5.7x at native size.

## 3. Desk stations

Add stations to each room scene:

```json
"stations": [
  { "x": 0.20, "y": 0.80, "kind": "desk" },
  { "x": 0.30, "y": 0.88, "kind": "desk" }
]
```

- Desks are **always drawn** at every desk station, empty or not, so the room looks furnished.
- Put stations on open floor, lined up with the room's existing tables, never on top of background furniture.
- Library starting points: two on the sunlit floor at left (about 0.20, 0.80 and 0.30, 0.88), two along the right edge of the rug (about 0.72, 0.80 and 0.82, 0.72). Other rooms: same idea, tune by eye.
- Campus has no desks. Agents walk into buildings and the interiors have the desks.

## 4. Layering (how real 2D games do it)

Draw order every frame:

1. Background
2. Everything else sorted by y, lowest on screen drawn last. For each desk station that's occupied, draw the **seated agent first, then the desk on top of it**
3. Effects (status icons, fire, glow, bubbles) on top of everything

Positions at a desk station:

- Desk: bottom-center at the station point
- Seated agent: bottom-center at `station.x`, `station.y - desk.height * scale * seatLift`
- Start `seatLift` at **0.45** and tune so the desk front hides the agent from the waist down and the head, shoulders and arms show above the laptop

Standing agents get a soft dark ellipse shadow under their feet (about 70% of sprite width, 20% opacity). Seated agents don't need one, the desk covers it.

## 5. Behavior

| Event / state | What happens |
|---|---|
| spawn | Walk from bench or door to a free desk station using the standing sprite (front or back, flipped by direction), with a 1px step bob |
| arrive | 150ms crossfade from standing to seated behind the desk |
| reading, writing, running, searching | Seated. Specialists alternate `sit[0]` and `sit[1]` every 180ms. The lead has one seated frame, so give it a 1px bob instead. Status icon above the head |
| thinking | Seated, typing paused on `sit[0]`, "..." icon |
| waiting (needs the user) | Stand up beside the desk using the `hand` sprite, yellow glow, "!" bubble |
| error | Stay seated, fire overlay on the agent until the next successful tool event |
| done | Stand up, green check, walk back to the lead |

## 6. Check before calling it done

- Resize the browser from small to full screen. Agents, desks and the room must scale together with no drift.
- Standing agents in the library are about the height of the chairs' backs plus a head.
- Seated agent heads are the same size as standing agent heads.
- No agent is ever drawn on top of a desk it is sitting behind.
- Typing frames don't jitter sideways.
