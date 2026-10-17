# Builder

Owns: `/web/src/builder`

The 2K-style creation flow: make your lead, draft your specialists, pick a scene, deploy.

## Flow

Screens follow the mock flow in [[References]]: **Title**, **Create Lead**, **Draft Squad**, **Scene and Deploy**, with a progress bar across the top.

1. **Create Lead**: big character preview on the left, category tabs on the right: Body, Hair, Color, Outfit, Hat. Left/right arrows to cycle options. Name field (default "Lead Agent"). Color tab swaps palette on the sprite in code (canvas pixel replace), no new art per color.
2. **Draft Squad**: roster cards in a grid. Click to add to one of 4 slots. Cards show role, a one-line job description ("Reads and judges changes. Never edits."), tools, and model. Model is chosen directly with a small Haiku/Sonnet/Opus toggle per agent, which is a real setting. No stat bars, no point budget.
3. **Scene and Deploy**: scene cards with background previews (maps and single rooms only, not interiors). Deploy button. On success, a modal shows the written files with their contents, then a "Go to Arena" button.

## Roster

Written in `web/src/builder/roster.ts` as `Character[]`. Prompts are short and direct.

Display names are the role. Looks are everyday engineer clothes with one prop and an accent color so they're easy to tell apart at small size.

| id | Display name | Look | Accent | Tools | Model |
|---|---|---|---|---|---|
| frontend-dev | Frontend Agent | hoodie, tablet and stylus | violet | Read, Edit, Write, Glob, Grep | sonnet |
| backend-dev | Backend Agent | flannel over tee, laptop with terminal | orange | Read, Edit, Write, Bash, Glob, Grep | sonnet |
| test-engineer | Test Agent | lab coat, clipboard with checkboxes | yellow | Read, Write, Bash, Grep | haiku |
| reviewer | Review Agent | button-up and glasses, coffee mug, magnifying glass | red | Read, Grep, Glob | sonnet |
| scout | Research Agent | backpack, stack of papers | green | Read, Grep, Glob, WebFetch | haiku |
| docs-writer | Docs Agent | cardigan, notebook and pen | blue | Read, Write | haiku |

Default lead name: Lead Agent (blazer, headset, the only one the user customizes).

The reviewer has no Edit or Write. Point this out on its card.

## Tasks

- [x] Title screen with a Start button.
- [x] Lead creator with layered preview from `looks.json`. Color tab palette-swaps exact pixel colors on a canvas. A hat hides the hair.
- [x] Haiku/Sonnet/Opus toggle per drafted agent.
- [x] Draft screen with 4 slots, click to add and remove.
- [x] Scene picker from `scenes.json`.
- [x] Deploy calls `POST /deploy` with the `Squad`; show the returned files; save the squad to localStorage.
- [x] "Randomize" button on the lead creator (fun in demos, cheap to build).
- [x] Works with placeholder art until the Art stream delivers. Never hardcode an art file path; always read from the manifests.
- [x] Art Pack 01: lead creator on real sprite variants (Body + Outfit tabs, rotate front/back/hand), head-crop portraits from front sprites, real title lineup, scene cards on real backgrounds. `looks.json` retired.
- [x] New UI direction (References, Oct 17): Welcome hero over `welcome-bg.png`, three-panel "Customize your lead" editor with pedestal, "Pick your team" avatar chips with per-agent model toggle, "Pick a scene" cards with deploy summary bar and files list, restyled files modal.

## Done when

You can build a lead, draft 3 specialists, pick UF Campus, hit deploy, and see real agent files written to `demo/target/.claude/agents/`.

## Log

- 2026-10-17: Demo 1 flow done on placeholder art: Title, Create Lead (canvas hair palette swap in `LeadPreview.tsx`, reusable by the Arena), Draft Squad with model toggles, Scene & Deploy with files modal and Go to Arena. Draft saved to `localStorage["agentsquad.draft"]`, deployed squad to `localStorage["agentsquad.squad"]`. Dev-only `?step=` and `?draft=<json>` URL params for screenshots. Waiting on real `/deploy` from Bridge to confirm files land in `demo/target/.claude/agents/`. Builder.
- 2026-10-17: Art Pack 01 wired in. Lead looks are `lead-<body>-<outfit>` variants via `ui/sprites.ts`; Hair/Color/Hat tabs hidden until recolor art. `LeadPreview` renders the variant (props `look`, `height`, `view`), no canvas swap. Saved layered looks (`body-a`, `outfit-hoodie`) migrate in `parseDraft`; unknown ones fall back to `DEFAULT_LEAD_LOOK`. Portraits are head crops of `/art/sprites/<id>-front.png`. Scene picker shows maps plus rooms no building uses as an interior, and resets a saved scene id that no longer exists. Dev params `?tab=body` and `?view=back|hand` on the lead step. Builder.
- 2026-10-17: Rebuilt the flow to the new UI direction. Steps: Welcome (`title`), Customize your lead, Pick your team, Pick a scene. Only new theme tokens/classes in `builder/`, no legacy names. Lead preview sits on a violet pedestal at the largest integer scale that fits the stage (ResizeObserver); Hair/Skin/Headset shown as disabled "Soon" rows. Team chips are 3x head crops of `front` sprites; the model toggle lives in the description line for the focused selected agent. Summary bar lists the planned files on hover/click. Draft, migration, deploy request and dev params unchanged. Verified deploy and undeploy end to end against a scratch target. Builder.
- 2026-10-17: Welcome screen lights (`WelcomeLights.tsx`): a canvas between the lab background and the headline gradient. Rack LEDs sampled from the art softly pulse, and particles drift along the rack walls, ceiling and floor toward the measured vanishing point (racks (1379,769), floor tiles (1351,583), in image px). Uses the same cover-fit math as the background, handles DPR and resize, pauses when the tab is hidden, and shows static lights under reduced motion. About 0.2ms/frame. Builder.
- 2026-10-17: Welcome lights v2 (user direction): no movement. Removed the particles, chases and trails. Now 219 fixed status LEDs sampled from the rack faces pulse, blink, flicker and sometimes cascade down a rack column in place. They are brighter on the near racks and dimmer deeper in, and nothing is drawn on the ceiling, floor, center or desks. Waits for the background image, listens for DPR and reduced-motion changes. Dev-only `?lights=debug` draws a marker at every LED. About 0.35ms/frame. Builder.
- 2026-10-17: Welcome lights v3: 175 fixed "deep" LEDs continue both rack walls into the dark, past where the art fades. They are laid out in rack columns and rows between each wall's top and bottom edge lines toward the vanishing point, with rack pitch taken from the visible racks (0.16 in depth, 1/k). They get sparser, smaller and fainter with depth and stop at depth 3.1. LED data now lives in `welcomeLeds.ts`. The debug view shows sampled LEDs in magenta and deep ones in cyan. 394 LEDs, about 0.35-0.5ms/frame. Builder.
