# Art Requests

The code side lists every image it needs here. The Art stream (a human) makes them; no coding agent generates images. Until a file exists, the app draws a labeled colored box in its place, so nothing blocks on art.

Rules for every file: transparent PNG unless it's a background, nearest-neighbor pixel art, one shared palette, same pixel scale across sprites. Paths are under `web/public/`.

## Needed

| File | What | Size | Used by | Status |
|---|---|---|---|---|
| `/art/scenes/uf-campus.png` | Campus map, empty, isometric. Buildings roughly where `scenes.json` puts them (or move the boxes to match) | 1920x1080 | Arena | needed |
| `/art/scenes/interior-library.png` | Library reading room, empty | 1920x1080 | Arena | needed |
| `/art/scenes/interior-lab.png` | Lab, empty | 1920x1080 | Arena | needed |
| `/art/scenes/bar.png` | The Bar, warm amber, empty | 1920x1080 | Arena, Builder | later |
| `/art/scenes/beach.png` | The Beach, empty | 1920x1080 | Arena, Builder | later |
| `/art/roster/<id>.png` | Card portrait, one per roster id (`frontend-dev`, `backend-dev`, `test-engineer`, `reviewer`, `scout`, `docs-writer`) | square, e.g. 256x256 | Builder, Arena | needed |

Coding agents: add rows here for anything else you need (sprites, icons, fire frames, title background) with exact path, size and frame count. Don't invent art.
