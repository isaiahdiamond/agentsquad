# End-to-end test: a real Claude Code session

Proves the whole path: deploy -> Claude Code hooks -> server events -> arena. The harness lives outside the repo, in `$TMPDIR/e2e/harness/` (`e2e.mjs`, `assert.mjs`, `tap.mjs`, `squad.json`).

## Run

```
node $TMPDIR/e2e/harness/e2e.mjs --repo <agentsquad checkout> --out $TMPDIR/e2e/<run-name> \
  --env-file <path to .env.local>   # optional: Gemini narrator; otherwise template narration
  --cdp-port 9755                   # headless Chrome debug port (default 9755)
```

If 9755 is taken by another Chrome, pass another port (the baseline used `--cdp-port 9765`); the harness never kills what it didn't start.

One command does everything, then stops what it started (by PID / process group):

1. `npm run setup-target` into `<out>/target`, `npm install`, git baseline commit.
2. Adds a test-only hook tap to `<out>/target/.claude/settings.json` that logs every raw hook payload to `<out>/hooks.jsonl` (AgentSquad writes its own hooks to `settings.local.json`; both run).
3. Starts the server and web from `--repo` on PORT=4617 / WEB_PORT=5473 with `TARGET=<out>/target`. Refuses to start if a port is busy.
4. `POST /api/deploy` (through the Vite proxy) with `squad.json`: lead + frontend-dev + test-engineer + reviewer (all haiku, to keep runs cheap).
5. Records every `/ws` event to `<out>/events.jsonl`.
6. Headless Chrome on `/arena` at 1440x900: a screenshot + DOM probe (`shots/*.png` + `*.json`) at each step (deployed, session_start, prompt, every spawn at 150/450/800/1300/4000/12000ms, first tool per agent, every agent_done, session_end) and every 5s. 15s after the first spawn it opens two late tabs (`/arena`, `/arena?view=union`) to test "arena opened after the session started".
7. Runs `claude -p "<demo prompt>" --model haiku --permission-mode acceptEdits --output-format stream-json --verbose` with cwd = the scratch project. Transcript in `claude.jsonl`. (`--claude-cwd repo` runs it from the repo with `--settings/--add-dir/--agents` if a sandbox forbids another cwd.)
8. Writes `report.md` / `report.json`: pass/fail per Session Flow and In-World HUD "Done when" item and per event-sequence check, each with evidence (events.jsonl line numbers, screenshot files).

In `acceptEdits` mode headless Claude may not run `npm test` (the PreToolUse fires, then nothing). To let the test engineer run tests, add `--allowed-tools "Bash(npm test:*) Bash(npm install:*) Bash(npx vitest:*)"`.

Re-check an existing run without re-running Claude: `node $TMPDIR/e2e/harness/assert.mjs <out>`.
Dry run (no Claude, no cost): add `--no-claude`.

Notes: deploy writes `demo/state.json` and `demo/runs/` in the `--repo` checkout. One run costs one headless haiku session.

## Not covered by headless runs (test by hand)

Use `--interactive` instead of the headless run: the harness sets everything up, records and screenshots as usual, and you drive Claude yourself in `<out>/target`. Exiting Claude (session_end) or Ctrl-C ends the run and writes the report.

- **Connected state:** in `-p` mode SessionStart and the prompt arrive within ~1s, so the "connected, no prompt yet" state is barely visible. With `--interactive`, start `claude`, wait ~10s before typing.
- **Needs you, scripted:** start the harness with `--interactive`, then `node $TMPDIR/e2e/harness/drive.mjs <out>/target <out>`. It runs interactive `claude --permission-mode default` in a pseudo-terminal (`ptyrun.py`). It reads the screen before every key: it accepts the folder-trust dialog only when the dialog names exactly that scratch folder, aborts on any other dialog, types a prompt that needs Bash approval, leaves the permission prompt open for 15s, then denies it with Escape and sends `/exit`. Screens and keys go to `<out>/drive.log`.
- **Needs you / waiting:** `Notification` never fires in `-p` mode. Run interactive `claude` *without* `acceptEdits`, ask for a file edit, leave the permission prompt open, check the arena for the yellow "Needs you" state.
- **VS Code Simple Browser:** Cmd+Shift+P, "Simple Browser: Show", `http://localhost:5473/arena`, then run a prompt from the Claude Code extension in the scratch project.
