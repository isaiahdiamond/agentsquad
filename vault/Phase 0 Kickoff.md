# Phase 0 Kickoff

One Claude Code session, one person, about 2 hours. Nobody else writes code until this is done, because every stream builds on what it creates.

## Prompt to paste into Claude Code

> Read every file in `vault/`, starting with `00 Start Here.md`. You are doing Phase 0 only. Do not build any stream's features.
>
> 1. Create an npm workspaces monorepo with `server`, `web`, `shared`, `hooks`, `assets`, `demo`. TypeScript everywhere. `web` is Vite + React + Tailwind + Framer Motion. `server` is Node with `ws` and a tiny HTTP layer (Hono or plain `http`).
> 2. Copy every type from `vault/Contracts.md` into `shared/types.ts` exactly.
> 3. Server: start on port 4317, accept WebSocket connections on `/ws`, stub every endpoint in Contracts so it returns a sensible empty response.
> 4. `npm run mock`: a script that sends a scripted 60-second fake session over `/ws` on a loop: session start, lead thinks, spawns frontend-dev and test-engineer, they read and write a few files, reviewer is spawned, everyone finishes, session end. Include narration events with sample text.
> 5. Web: three routes, `/builder`, `/arena`, `/report`, each a placeholder. `/arena` connects to `/ws` and shows a plain list of incoming events so we can see mock data flowing.
> 6. Placeholder art: colored rectangles with names for 6 roster characters, one placeholder scene `scenes.json` with UF Campus spots, a placeholder `looks.json` with 2 bodies, 2 hair, 2 outfits, 1 hat as solid shapes.
> 7. Root `npm run dev` starts server and web together.
> 8. Write `README.md` with how to run it, in plain language.
>
> Then run `npm run dev` and `npm run mock`, open `/arena`, confirm events appear. Commit as "phase 0". Report what you built and anything in the vault that was unclear.

## After Phase 0

Each stream gets its own copy of the repo so agents don't overwrite each other:

```
git worktree add ../as-bridge  -b bridge
git worktree add ../as-arena   -b arena
git worktree add ../as-builder -b builder
git worktree add ../as-art     -b art
```

Then open Claude Code in each folder with that stream's prompt. See [[Running the Streams]].
