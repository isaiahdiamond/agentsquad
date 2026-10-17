# Art

Owns: `/assets`, `/web/public/art`

All characters, clothing layers, roster portraits, and scene backgrounds. Uses Higgsfield MCP and Gemini at build time. Nothing is generated live in the app.

This stream needs a human with an eye for consistency and basic image editing (Photopea is free and runs in the browser).

## Hour 0-3: lead sprite test

- [ ] One base chibi body, front-facing plus the 3 other facings if the model holds consistency (see style reference in [[References]]).
- [ ] Reduce to a strict palette (pick one from lospec.com, about 32 colors) so every sprite shares exact colors. Palette swapping depends on this.
- [ ] 2 outfits and 2 hair styles. Hand the Builder stream the exact hex values for hair and outfit colors so it can swap them.
- [ ] If swaps break, fall back to fixed full-character variants (body x outfit) and drop the Color tab.

## Production

- [ ] 6 specialist sprites and 6 card portraits from the roster in [[Builder]]. Engineers in normal clothes, not heroes.
- [ ] Lead: 2 bodies, 4 outfits, 4 hair styles, 3 hats
- [ ] Hand-raised frame for every sprite (same character, one arm up)
- [ ] Pixel fire overlay: 4-6 frame loop, plus a smoke puff and an extinguisher puff
- [ ] Status icons: book, keyboard, terminal, magnifier, thinking dots, "!", check
- [ ] Scenes, empty (no characters, no HUD, no text): UF Campus map, Library interior, Lab interior, Bar, Beach
- [ ] Title screen background
- [ ] All sprites background-removed, snapped to the palette, exported at the same pixel scale
- [ ] Write `web/public/art/looks.json` and `web/public/art/scenes/scenes.json`. Use the arena's debug overlay (`D` key) to tune spot coordinates.
- [ ] Check Higgsfield credit balance before every batch.

Prompt prefix for every image (put in `assets/style.md`):

> 32-bit pixel art, chibi isometric RPG style, large head about one third of body height, crisp nearest-neighbor pixels, dark near-black outline, soft cel shading with 3 to 4 tones per color, slightly muted warm palette, isometric 3/4 top-down camera.

Scenes must be generated empty. Add "no characters, no people, no text, no UI" to every scene prompt.

The code side lists exactly which files it needs, with names and sizes, in [[Art Requests]].

## Done when

The lead creator shows real layered art, roster cards have real portraits, and the UF Campus scene looks right in the arena with spots tuned.

## Log
