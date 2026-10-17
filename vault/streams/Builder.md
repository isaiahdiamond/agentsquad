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

- [ ] Title screen with a Start button.
- [ ] Lead creator with layered preview from `looks.json`. Color tab palette-swaps exact pixel colors on a canvas. A hat hides the hair.
- [ ] Haiku/Sonnet/Opus toggle per drafted agent.
- [ ] Draft screen with 4 slots, click to add and remove.
- [ ] Scene picker from `scenes.json`.
- [ ] Deploy calls `POST /deploy` with the `Squad`; show the returned files; save the squad to localStorage.
- [ ] "Randomize" button on the lead creator (fun in demos, cheap to build).
- [ ] Works with placeholder art until the Art stream delivers. Never hardcode an art file path; always read from the manifests.

## Done when

You can build a lead, draft 3 specialists, pick UF Campus, hit deploy, and see real agent files written to `demo/target/.claude/agents/`.

## Log
