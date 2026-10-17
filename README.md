# AgentSquad

Build a squad of AI coding agents, deploy them into Claude Code, and watch them work in a live scene.

The plan, the data shapes and each team's tasks live in `vault/`. Start with `vault/00 Start Here.md`.

## What you need

- Node.js 20 or newer (`node -v` to check)

## First time

```
npm install
```

## Run it

```
npm run dev
```

This starts two things together:

- the **server** on http://localhost:4317 (receives Claude Code events and sends them to the browser)
- the **web app** on http://localhost:5173 (open this one in your browser)

Stop both with `Ctrl+C`.

## See fake data without Claude Code

With `npm run dev` still running, open a second terminal and run:

```
npm run mock
```

This plays a pretend 60-second session over and over: the lead thinks, hands work to a frontend dev and a test engineer, they read and edit files, a reviewer checks it, and everyone finishes. Open http://localhost:5173/arena and you'll see the events scroll in.

## Pages

- `/builder`: make your squad (placeholder for now)
- `/arena`: watch the squad work (shows a raw event list for now)
- `/report`: the match report after a session (placeholder for now)

## Folders

| Folder | What's in it | Stream |
|---|---|---|
| `shared/` | `types.ts`, the data shapes everyone agrees on. Don't edit; see `vault/Decisions.md` | none (read-only) |
| `server/` | The server on port 4317 | Bridge |
| `hooks/` | The script Claude Code runs on each event | Bridge |
| `demo/` | `mock.ts` (fake session) and, later, recorded runs and the demo project | Bridge |
| `web/` | The browser app. `src/builder`, `src/arena`, `src/report` | Builder, Arena |
| `web/public/art/` | Characters, outfits, scenes and their `looks.json` / `scenes.json` lists | Art |
| `assets/` | Art source files and style notes | Art |

## Other commands

- `npm run typecheck`: checks the TypeScript in every folder.
