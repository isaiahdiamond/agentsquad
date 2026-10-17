# Builder

Owns: `/web/src/builder`

The 2K-style creation flow: make your lead, draft your specialists, pick a scene, deploy.

## Flow

Three screens with a progress bar across the top, like MyPlayer creation:

1. **Create Lead**: big character preview on the left, category tabs on the right (Body, Hair, Hair Color, Outfit, Hat). Left/right arrows or swipe to cycle options. Name field. Three stat bars with a 180-point budget.
2. **Draft Squad**: roster cards in a grid. Click to add to one of 4 slots. Each card shows portrait, role, 3 stats, accent color, and a one-line specialty ("Never edits. Only judges.").
3. **Pick Scene and Deploy**: three scene cards with background previews. Deploy button. On success, a modal shows the written files with their contents for a few seconds, then a "Go to Arena" button.

## Roster

Write in `web/src/builder/roster.ts` as `Character[]`. Prompts are short and direct.

| id | Name idea | Role | Tools | Model |
|---|---|---|---|---|
| frontend-dev | Nova | UI Engineer | Read, Edit, Write, Glob, Grep | sonnet |
| backend-dev | Forge | Backend Engineer | Read, Edit, Write, Bash, Glob, Grep | sonnet |
| test-engineer | Gauge | Tester | Read, Write, Bash, Grep | haiku |
| reviewer | Judge | Code Reviewer | Read, Grep, Glob | sonnet |
| scout | Radar | Researcher | Read, Grep, Glob, WebFetch | haiku |
| docs-writer | Quill | Docs Writer | Read, Write | haiku |

The reviewer has no Edit or Write. Point this out on its card. Names are placeholders; the team can rename.

## Tasks

- [ ] Lead creator with layered preview from `looks.json`. Hair color tints the hair layer (CSS `filter` or a canvas tint on a light-gray hair image). A hat hides the hair.
- [ ] Stat sliders with a shared point budget; speed over 70 sets model to haiku, otherwise sonnet.
- [ ] Draft screen with 4 slots, click to add and remove.
- [ ] Scene picker from `scenes.json`.
- [ ] Deploy calls `POST /deploy` with the `Squad`; show the returned files; save the squad to localStorage.
- [ ] "Randomize" button on the lead creator (fun in demos, cheap to build).
- [ ] Works with placeholder art until the Art stream delivers. Never hardcode an art file path; always read from the manifests.

## Done when

You can build a lead, draft 3 specialists, pick UF Campus, hit deploy, and see real agent files written to `demo/target/.claude/agents/`.

## Log
