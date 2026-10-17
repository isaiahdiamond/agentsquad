# Demo prompt

Type this into Claude Code in the demo project:

```
Use frontend-dev to add a dark mode toggle, test-engineer to write tests, and reviewer to check both.
```

The demo target is a small Vite + React todo app (`src/Header.jsx`, `src/App.jsx`, `src/index.css`) with Vitest and Testing Library already set up (`npm test`), so the toggle goes in the header and the tests run without extra setup. Deploy a squad that includes **frontend-dev**, **test-engineer** and **reviewer**.

## Steps

1. Make the demo project outside this repo (once). It must be outside the repo so Claude doesn't also load this repo's `CLAUDE.md`:

   ```
   npm run setup-target -w demo
   cd ~/agentsquad-demo-target && npm install && cd -
   ```

   Pass a folder to put it somewhere else: `npm run setup-target -w demo -- /some/dir`.

2. Start AgentSquad pointed at it:

   ```
   TARGET=~/agentsquad-demo-target npm run dev
   ```

3. Open http://localhost:5173/builder, pick frontend-dev, test-engineer and reviewer, and hit **Deploy squad**. The arena now shows "Waiting for Claude Code" (`GET /state` says `connected: false`).

4. **After deploying**, in a second terminal:

   ```
   cd ~/agentsquad-demo-target
   claude
   ```

   - If `claude` was already running there, quit and restart it. Claude Code reads hooks and agents only at startup.
   - On a new folder Claude asks "Do you trust this folder?". The default is **No, exit**, so pick **Yes, I trust this folder**. No hooks fire until you do.
   - The arena flips to connected (`connected: true`, `live.phase: "connected"`).

5. Paste the prompt above. The arena shows the mission. Each specialist spawns when the lead delegates, and the mission completes once all of them are done and the lead has answered (`live.phase: "done"`, then REPORT lines).

6. Optional: let the test run happen without a prompt by approving `npm test` when Claude asks, or start Claude with `claude --allowedTools "Bash(npm test*)"`.

To undo the deploy: `curl -X POST localhost:4317/undeploy -H 'content-type: application/json' -d '{}'`.

## Headless check (no UI, cheap)

```
cd ~/agentsquad-demo-target
claude -p "Use frontend-dev to add a dark mode toggle, test-engineer to write tests, and reviewer to check both." \
  --model haiku --permission-mode acceptEdits --allowedTools "Bash(npm test*)"
```

`-p` skips the trust dialog and never shows permission prompts, so it never fires `Notification`.

## What to expect (Claude Code 2.1.302)

Specialists run in the background. The lead often delegates one at a time and re-delegates after the review (one real run had 8 spawns). On the wire: `session_start` → `prompt` → `spawn` + tools per specialist → specialist `agent_done` → … → a single lead `agent_done` → one `REPORT:` narration per agent. `session_end` comes only when Claude exits.

## Delegation hit rate

| Date | Runs | Delegated to all three | Notes |
|---|---|---|---|
| 2026-10-17 | 3 (`-p`, haiku) | 3/3 | 1 with this exact prompt, 2 with close variants; every run spawned all three |
