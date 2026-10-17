# Art

All characters and scenes for AgentSquad. Generated with Higgsfield on Oct 17.

## Get it

From the repo root:

```
pip install pillow
python tools/fetch_art.py
```

This downloads everything, cleans the sprites into real pixel art, and writes:

- `web/public/art/scenes/*.png` — 6 backgrounds, 2688x1520
- `web/public/art/sprites/*.png` — 42 sprites, 44px tall, sharing one 64-color palette
- `web/public/art/sprites.json` — manifest the app reads
- `assets/raw/` — the original big images, keep them for re-runs
- `assets/palette.png` — the shared palette

Re-running skips files already downloaded.

## Characters

Every look has 3 views: `front`, `back`, `hand` (hand raised, front facing). Flip front and back horizontally for the other two directions.

Team (fixed):

| id | Look |
|---|---|
| frontend-dev | East Asian woman, high ponytail, violet hoodie, tablet and stylus |
| backend-dev | stocky man, red beard, orange flannel, laptop |
| test-engineer | Black woman, curly puff, lab coat over yellow, clipboard |
| reviewer | older South Asian man, grey hair, glasses, red shirt, mug, magnifier |
| scout | Latina woman, short wavy hair, green utility jacket, backpack, papers |
| docs-writer | Middle Eastern man, curly hair, blue cardigan, notebook |

Lead (customizable): 2 bodies x 4 outfits. Names are `lead-<body>-<outfit>-<view>`.

- Bodies: `a` (man, short dark hair), `b` (woman, shoulder-length wavy hair)
- Outfits: `blazer`, `hoodie`, `flannel`, `track`
- All lead looks keep the headset and tablet so the lead is always recognizable

## Rendering rules

- Draw sprites at integer scale with smoothing off (`image-rendering: pixelated`, `imageSmoothingEnabled = false`).
- Anchor sprites at the feet (bottom center).
- Scale is per scene: zoomed-in rooms use a bigger scale than the campus map. Store it on each scene's spots. Tune with `tools/preview.html`.
- Agents always draw on top of the background, so place stations on the camera-facing side of furniture and keep campus paths on open ground.

## Known limits

- AI views aren't perfectly consistent. Some back or hand views may shift a pixel or change a detail. Fix by hand in Piskel or Aseprite after cleanup, or ask for a regen.
- Hair and outfit recoloring by color swap: the colors to swap are whatever the cleanup picked for that sprite. The Builder stream reads them from the sprite (most common non-skin colors in the hair and torso areas) or a human writes them into `sprites.json`.
