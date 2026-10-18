# Lead Character Customization

Removed from the active outfit catalog: superhero (`debugger`), Band Tour Tee (`tour`), Hollister Surf Tee (`coastal`), and PacSun Sunset Tee (`sunset`). Historical descriptions below are not the active catalog; use `lead.json`. Old saved selections normalize to a valid remaining outfit.

The lead is built from layers so options multiply. Specialists stay fixed as they are.

## Get the art

```
python tools/fetch_lead.py
```

Writes `web/public/art/lead/` (sprites, hair layers, `lead.json`) and `assets/lead-preview.png` (every outfit in every view with mixed hair and skin, plus the 3 characters). Open the preview first to check alignment.

## Options

| Step | Choices |
|---|---|
| Type | Person (Body 1 or Body 2), or a character: Dog, Gator |
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

Additional outfit colorways for both bodies: **Neon Nights** (`neon`, purple hoodie), **Cherry Varsity** (`varsity`, cherry-red blazer), and **Arctic Drip** (`arctic`, icy-blue streetwear). These reuse the original poses and head anchors. Each view may include a `palette` mapping exact source clothing hex colors to replacement hex colors. Skin replacement takes precedence; outlines and hair remain separate. Keep these entries when regenerating the lead manifest.

Streetwear and campus options: **After Hours** (`street`) adds a lime star graphic to a charcoal hoodie; **Campus Hoodie** (`campus`) adds pixel UF lettering to an orange hoodie. Cherry Varsity includes cream sleeves and a collegiate letter patch. Optional per-view `graphics` use head-relative offsets, `#` pixel patterns, and a color; prints are masked to clothing. `sleeveColor` recolors the jacket's outer sleeve regions while preserving skin. These details render in front, wave, and seated views.

The Outfit panel also has independent `topColor`, `pantsColor`, `shoeColor`, `sleeveColor`, and `graphicColor` controls plus `graphic` (`default`, `none`, `uf`, `star`, `letter`). These saved Look overrides recolor clothing regions with source shading, leave skin untouched, and participate in the sprite cache key. Reset clears the overrides. Clothing shapes still come from the selected base outfit.

Tee presets for both bodies: Band Tour Tee (`tour`), Hollister Surf Tee (`coastal`), PacSun Sunset Tee (`sunset`), and Skate Tee (`skate`). These use the existing short-sleeve art with custom palettes and pixel graphics. Independent graphics also include `tour` (lightning), `gull`, `sunset` (waves), and `checker`. They remain compatible with separate color controls.

Independent `bottoms` choices: `original`, `gym-shorts`, and `leggings` (Yoga pants in the UI). Athletic lower halves are composed using the matching front/hand/sit pose and head-relative waist alignment; shorts use the short athletic art and yoga pants use the dark athletic-pants art. The source skin ramp is mapped to the chosen body's skin ramp before skin customization. The Bottoms color control applies afterward. Reset restores original bottoms.

Female athletic bottoms now use dedicated fitted-short and flared-yoga-pant artwork, configured by `athleticBottoms` in lead.json. The transparent sheet has three pose columns (front, hand, sit) and two rows (shorts, yoga pants). The renderer extracts the visible bounds, removes low-alpha edge haze, aligns to the outfit waist, and preserves foreground hands. Short tees/dresses have their torso aligned to the shared waist to remove the old skirt. Clothing palettes do not recolor the replacement layer; independent Bottoms color still applies. Male bottoms retain the earlier athletic source-art path.

Athletic proportions use a consistent waist at head + 55 pixels, with the short-tee/dress torso extended to that waist. Lower-body width is sized from the sheet's waistband (18 native pixels standing, 20 seated, capped to preserve side padding), independently of leg height. This prevents skinny legs under hoodies and oversized legs under short tees.

Male characters also offer `jorts`: pose-matched knee-length washed denim shorts with a waist at head + 55 pixels and an 18% wider relaxed fit, compatible with the independent top and Bottoms colors. The option is only shown for Male and is cleared when changing to Female. Denim extension is confined to the legs so the hands at the waistband retain their skin tone.

Jorts now use dedicated clean denim artwork from `denimBottoms` (three pose columns, one row), replacing the older basketball-art fallback whenever this manifest entry is present. The shared layer compositor aligns both athletic and denim waistbands, suppresses low-alpha edge noise, and restricts the foreground-finger mask to skin hues so clothing fragments do not leak through. Female layers crop off the source artwork's small bare waist strip before composition.

### Hair

| Body 1 | Body 2 |
|---|---|
| bald, locs, waves, afro, sidepart, fringe | bald, braids, straight, puff, bob, buns |

### Characters

dog (grey pitbull, backwards cap, black tee, gold chain), gator (green alligator, black hoodie, silver chain). Robot removed (2026-10-17). Both are front views only for now: `hand` and `sit` reuse the front until the art lands; source files in `assets/lead-src/`.

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
