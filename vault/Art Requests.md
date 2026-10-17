# Art Requests

The code side lists every image it needs here. The Art stream (a human) makes them; no coding agent generates images. Until a file exists, the app draws a placeholder in code, so nothing blocks on art. Drop a file at its path and it shows up.

## Rules for every file

- Pixel art, nearest-neighbor, one shared palette (about 32 colors, from lospec.com). Transparent PNG except backgrounds.
- **Characters share one canvas: 48×64 px**, feet at the bottom center, front-facing. Lead layers, specialist sprites, fire overlays all use it so they stack and line up. The app scales them up by whole numbers (×2, ×3).
- Sprite sheets are horizontal strips: frames left to right, each 48×64.
- Paths are under `web/public/`.

## Priority 1: makes the demo look real

| File | What | Size |
|---|---|---|
| `/art/scenes/uf-campus.png` | Campus map, empty (no people, text, UI). Buildings: Library, Lab, Engineering, Court, Studio. Boxes in `scenes.json` get tuned to your image with the `D` overlay | 1920×1080 (e.g. 640×360 native, ×3) |
| `/art/roster/<id>.png` ×6 | Card portraits, bust, for `frontend-dev`, `backend-dev`, `test-engineer`, `reviewer`, `scout`, `docs-writer`. Look and accent per the roster table in [[Builder]] | 96×96 |
| `/art/sprites/<id>.png` ×6 | Specialist full-body sheet: 4 idle frames, 4 walk frames, 1 hand-raised frame (9 frames) | 432×64 |
| `/art/scenes/interior-library.png` | Library reading room, empty | 1920×1080 |
| `/art/scenes/interior-lab.png` | Lab, empty | 1920×1080 |

## Priority 2: lead customization

All on the 48×64 canvas. Listed in `web/public/art/looks.json` (update it when files change).

| File | What |
|---|---|
| `/art/looks/<body>-<outfit>.png` | Body plus outfit, full render. 2 bodies × at least 3 outfits (blazer + headset is the default lead) |
| `/art/looks/<body>-<hair>.png` | Hair overlay, at least 4 styles. **Drawn only in these 4 grays, highlight to shadow: `#e8e8e8`, `#d4d4d4`, `#a8a8a8`, `#7a7a7a`.** Code swaps them for the chosen color. Don't use these grays anywhere else in the hair layer. If you prefer other values, tell the code side |
| `/art/looks/<body>-<hat>.png` | Hat overlay, e.g. cap and beanie. Not recolored |

## Priority 3: effects and polish

| File | What | Size |
|---|---|---|
| `/art/fx/fire.png` | Looping cartoon flame overlay, 6 frames | 288×64 |
| `/art/fx/smoke.png` | Smoke puff, 4 frames | 64×16 |
| `/art/fx/puff.png` | Fire-extinguisher puff, 5 frames | 160×32 |
| `/art/fx/icons.png` | Status icons in one strip: book, keyboard, terminal, magnifier, "...", check, "!" (7 frames) | 112×16 |
| `/art/scenes/bar.png` | The Bar, warm amber, empty | 1920×1080 |
| `/art/scenes/beach.png` | The Beach, empty | 1920×1080 |
| `/art/ui/title-bg.png` | Title screen background | 1920×1080 |

## Open question for Art

- Test Agent's accent (yellow) is close to the lead's gold in the report and timeline. Pick a different accent for one of them.
