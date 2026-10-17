# Lead Character Customization

The lead is built from layers so options multiply. Specialists stay fixed as they are.

## Get the art

```
python tools/fetch_lead.py
```

Writes `web/public/art/lead/` (sprites, hair layers, `lead.json`) and `assets/lead-preview.png` (every outfit in every view with mixed hair and skin, plus the 3 characters). Open the preview first to check alignment.

## Options

| Step | Choices |
|---|---|
| Type | Person (Body 1 or Body 2), or a character: Robot, Dog, Gator |
| Outfit | 5 per body |
| Skin | 8 tones |
| Hair | 5 styles per body + Bald |
| Hair color | 10 |

Characters are complete looks. When a character is picked, hide Outfit, Skin, Hair and Hair color.

### Outfits

| Body 1 | Body 2 |
|---|---|
| drip: oversized white tee, huge gold chain, baggy jeans | sundress: yellow sundress, white sneakers |
| blazer: navy blazer, white tee, jeans | blazer: navy blazer, white tee, jeans |
| hoodie: charcoal hoodie, joggers | hoodie: charcoal hoodie, joggers |
| gameday: orange tee, blue shorts, striped socks, face paint | gameday: orange tee, blue pleated skirt, striped socks, face paint |
| debugger: original hero suit, black and teal, `{ }` emblem, cape | drip: black puffer, gold chain, hoops, baggy jeans |

No logos, mascots or team text anywhere.

### Hair

| Body 1 | Body 2 |
|---|---|
| bald, locs, waves, afro, sidepart, fringe | bald, braids, straight, puff, bob, buns |

### Characters

robot (white office robot, cyan screen eyes, antenna), dog (golden dog in a navy hoodie), gator (original cartoon alligator in a white tee). Each has its own headset built in.

## lead.json

```json
{
  "height": 44,
  "skinTones": { "s1": ["#F6D9C4", "...4 shades light to dark"] },
  "hairColors": { "black": "#1C1A1E" },
  "bodies": {
    "a": {
      "skin": ["#hex", "..."],
      "outfits": {
        "drip": {
          "front": { "src": "/art/lead/a-drip-front.png", "head": [x, y] },
          "hand":  { "src": "...", "head": [x, y] },
          "sit":   { "src": "...", "head": [x, y] }
        }
      },
      "hair": {
        "bald": null,
        "locs": { "src": "/art/lead/a-hair-locs.png", "offset": [dx, dy] }
      }
    }
  },
  "characters": { "robot": { "front": { "src": "..." }, "hand": {}, "sit": {} } }
}
```

- `skin` lists the exact skin colors in that body's sprites, darkest first
- `head` is the top-center of the head in that sprite, in sprite pixels
- hair `offset` is where the hair layer's top-left goes relative to `head`

## Drawing the lead (Builder preview and Arena)

Do this once per look change into an offscreen canvas at sprite size, then draw that canvas like any other sprite.

1. Draw the outfit sprite for the current view (`front`, `hand` or `sit`)
2. **Skin:** for every pixel whose color is in `bodies[body].skin` (exact match), replace it with the chosen tone. Map by position: the i-th skin color (dark to light) becomes `ramp[floor(i * 4 / skin.length)]` where `ramp` is the tone reversed to dark-first
3. **Hair** (skip if bald or a character): load the hair layer, recolor every opaque pixel to `hairColor * (0.45 + 0.75 * brightness / 255)` per channel, capped at 255, where brightness = `0.3r + 0.59g + 0.11b` of the grey pixel. Draw it at `head + offset`. The canvas needs a few pixels of padding on all sides because hair can extend past the outfit
4. Pick the view by state the same way as the specialists: `front` standing, `hand` when waiting, `sit` at a desk (the lead has one seated frame, add a 1px bob)

Characters: draw the character sprite for the view, nothing else.

Cache composed canvases by `body/outfit/view/skin/hair/hairColor` so recoloring runs once per change.

## Builder UI

Same layout as the "Customize your lead" mock in References.md:

- Left accordion: Type, Outfit, Skin, Hair, Hair color
- Type: 2 body tiles plus 3 character tiles
- Outfit and Hair: tiles rendered with the current skin and hair color so picks look final
- Skin and Hair color: round swatches
- Randomize: random type (people more often than characters), outfit, skin, hair, hair color
- Save as `{ type: "a" | "b" | "robot" | "dog" | "gator", outfit, skin, hair, hairColor }`

## Known risks

- AI edits can shift a head by a pixel or two between views. If hair floats or clips in the preview sheet, nudge that view's `head` in `lead.json` by hand.
- If a recolored face has leftover patches of the old skin, add those hex values to the body's `skin` list.
- The headset was removed from the human lead to make the bald base. Characters still have theirs.

## Not done yet (ideas for later)

More outfits from the full catalog (dresses, Y2K, academia, astronaut, onesies), headset options for humans, more hair styles, recolorable character colors.
