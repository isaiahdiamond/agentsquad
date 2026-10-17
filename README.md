<img width="2688" height="1152" alt="agentviz_logo" src="https://github.com/user-attachments/assets/bfaebcea-1faa-4b94-b426-d537f8fc8757" />

# AgentViz


Build a squad of AI coding agents, deploy them into Claude Code, and watch them work in a live scene.

The plan, the data shapes and each team's tasks live in `vault/`. Start with `vault/00 Start Here.md`.

## Test it on a new machine (about 10 minutes)

You need Node.js 22 or newer, git, and Claude Code installed and logged in (`claude` works in a terminal).

1. Get the code and install:
   ```
   git clone https://github.com/isaiahdiamond/agentsquad.git
   cd agentsquad
   npm install
   ```
2. Optional, for friendly status lines: create `.env.local` in the repo root with one line, `GEMINI_API_KEY=your-key` (free key at aistudio.google.com/apikey). Never commit it. Without it you get plain template lines.
3. Make a demo project to work in (outside the repo): `npm run setup-target -w demo`. It prints the folder, by default `~/agentsquad-demo-target`. Then `cd ~/agentsquad-demo-target && npm install && cd -`.
4. Start AgentViz pointed at that project: `TARGET=~/agentsquad-demo-target npm run dev`, then open http://localhost:5173.
5. In the browser: **Build your squad** → customize your lead → pick a team (include the reviewer) → pick a scene → **Deploy squad**. The arena should say "Waiting for Claude Code".
6. Only now, in a second terminal: `cd ~/agentsquad-demo-target && claude`. Answer **Yes, I trust this folder** (the default is No). The arena switches to "Connected". If `claude` was already running, quit and restart it: it only reads hooks at startup.
7. Give the lead a task, for example: "Use frontend-dev to build a simple landing page in site/index.html with a hero, three feature cards and a footer, then have reviewer check it." Watch http://localhost:5173/arena: "Got it", the team portals in, works at desks, and Mission complete appears when everyone is done.
8. Clean up when finished: `curl -X POST localhost:4317/undeploy -H 'content-type: application/json' -d '{}'` removes everything AgentViz wrote into the demo project.

If the arena stays on "Waiting for Claude Code": you started `claude` before deploying (restart it), you answered No to the trust prompt, or `claude` isn't running in the demo folder.

## What you need

- Node.js 22 or newer (`node -v` to check)

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

## Watch a real Claude Code session

Full steps and the demo prompt: `demo/PROMPT.md`. Short version:

1. Make a demo project outside this repo (only once): `npm run setup-target -w demo`, then `cd ~/agentsquad-demo-target && npm install`.
2. Start AgentSquad pointed at it: `TARGET=~/agentsquad-demo-target npm run dev`.
3. Open http://localhost:5173/builder, build your squad and hit **Deploy Squad**. That writes the agent files, a "Your team" section in the project's `CLAUDE.md`, and hooks in `.claude/settings.local.json`.
4. **Then** in another terminal: `cd ~/agentsquad-demo-target && claude`. Claude Code reads hooks only at startup, so restart it if it was already running. On a new folder, answer **Yes, I trust this folder** (the default is "No, exit"). Hooks don't fire before that.
5. Give it a task: "Use frontend-dev to add a dark mode toggle, test-engineer to write tests, and reviewer to check both." Watch http://localhost:5173/arena.

`GET /state` (via `/api/state` from the browser) tells you where things stand: `connected: false` means no Claude session yet, and `live.phase` is `connected`, `mission` or `done`.

To remove everything AgentSquad wrote into the project, run `curl -X POST localhost:4317/undeploy -H 'content-type: application/json' -d '{}'`.

Every session is recorded in `demo/runs/`, and the match report's **Replay** button plays it back. For debugging, start the server with `AGENTSQUAD_RAW=/tmp/raw.jsonl` to save every raw hook, then `npm run replay-hooks -w demo -- /tmp/raw.jsonl` to feed it back with the original timing. The raw file holds everything Claude Code sends to hooks: your prompts, file contents, commands, command output and absolute paths. Keep it local, and scrub it before committing it as a sample.

## Art

No art is in the repo yet. Until it lands, the app draws placeholders in code. The list of files to make, with sizes, is in `vault/Art Requests.md`. Drop a file at its path and it shows up.

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
