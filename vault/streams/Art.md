# Art

Owns: `/assets`, `/web/public/art`

All characters, clothing layers, roster portraits, and scene backgrounds. Uses Higgsfield MCP and Gemini at build time. Nothing is generated live in the app.

This stream needs a human with an eye for consistency and basic image editing (Photopea is free and runs in the browser).

## Hour 0–3: the art test (decides everything)

- [ ] Write `assets/style.md`: one style prompt prefix used for every image. Fixed pose (standing, front-facing, full body), fixed framing, plain background, same lighting.
- [ ] Generate one base body. Then use image editing (Gemini) to make the same person in 2 outfits. Generate 1 hair layer and 1 hat as overlays.
- [ ] Remove backgrounds. Stack them in Photopea. Do they line up cleanly?
- [ ] **Yes:** go with route A below. **No, or it's eating hours:** switch to route B. Write the choice in [[Decisions]] by hour 3. No going back.

## Route A: illustrated (AI generated)

- [ ] 2 bodies
- [ ] 5 outfits per body as full renders (10 images, shoes included)
- [ ] 4 hair styles per body as overlays in light gray so code can tint them (8 images)
- [ ] 3 hats per body as overlays (6 images)
- [ ] Align every overlay to its body in Photopea. Export all at the same canvas size, transparent PNG.

## Route B: LPC pixel kit

- [ ] Pull layers from the Liberated Pixel Cup character generator (bodies, hair, clothes, hats), front-facing frame plus walk cycle.
- [ ] Note the license (CC-BY-SA / GPL) and credit list in `assets/CREDITS.md`. Add a credits line to the final slides.

## Both routes

- [ ] 6 roster portraits in the same style as the lead, one per specialist in [[Builder]]. Each has a clear accent color in its outfit.
- [ ] Write `web/public/art/looks.json` matching the `LookManifest` in [[Contracts]].
- [ ] Scenes, 1920x1080, each with clear standing spots for a lead and at least 4 workstations:
  - [ ] UF Campus: brick buildings, Century Tower style tower, outdoor tables with laptops. No UF logos, no Gator mascot.
  - [ ] The Bar: neon, a bar counter where the reviewer stands, high tables as stations. Keep it PG.
  - [ ] Office: last priority, first to cut.
- [ ] Write `web/public/art/scenes/scenes.json`. Use the arena's debug overlay (`D` key) to tune spot coordinates.
- [ ] Check Higgsfield credit balance before every batch.

## Done when

The lead creator shows real layered art, roster cards have real portraits, and the UF Campus scene looks right in the arena with spots tuned.

## Log
