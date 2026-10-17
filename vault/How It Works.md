# How It Works

The whole thing from the user's side, then what happens underneath each step.

## The user's experience

1. In their project folder, they run `npx agentsquad` (during the hackathon: `npm run dev` from our repo with `TARGET=/path/to/project`).
2. A browser tab opens on the **Squad Builder**.
3. They design their lead agent: body, hair, hair color, outfit, hat, name.
4. They pick specialists from the roster ("I need a UI agent, a backend agent, a reviewer").
5. They pick a scene: UF Campus, The Bar, or Office.
6. They hit **Deploy Squad**.
7. They open a terminal in the same project and run `claude`, then type a task.
8. The browser switches to the **Arena**. The squad shows up in the chosen scene and works the task live.
9. When Claude finishes, the **Match Report** shows who did what.

## What happens underneath

### Deploy (step 6)

The builder sends the squad to our server: `POST /deploy`. The server writes three things into the target project:

- **One agent file per specialist** at `.claude/agents/<id>.md`. This is a real Claude Code subagent: a short header (name, description, tools, model) plus a system prompt. Claude Code loads these automatically.
- **A "Your team" section** appended to the project's `CLAUDE.md`, between `<!-- agentsquad:start -->` and `<!-- agentsquad:end -->` markers so we can replace it cleanly. It tells the main Claude to delegate to the specialists by name.
- **Hooks** in `.claude/settings.json` (backup saved first as `settings.json.agentsquad-bak`). Hooks are commands Claude Code runs automatically on events like "about to use a tool" and "subagent finished". Ours run `hooks/emit.mjs`.

Nothing is installed globally. Deleting those three things undoes everything. `npx agentsquad uninstall` does it for you.

### Running a task (step 7)

The user types a prompt in Claude Code. The main Claude (our "lead") reads `CLAUDE.md`, sees the team, and delegates. Delegation is a tool call (named `Task` or `Agent` depending on Claude Code version — handle both) with `subagent_type` set to one of our ids, like `frontend-dev`. Claude Code then runs that subagent using our `.claude/agents/frontend-dev.md` file.

### Live events (step 8)

```
Claude Code ──hook fires──▶ emit.mjs ──POST /hook──▶ server ──normalize──▶ AgentEvent
                                                                              │
Arena (browser) ◀──────────────── WebSocket /ws ◀───────── narrator adds bubbles
```

- Every tool call triggers a hook. Claude Code passes the hook a JSON blob on stdin (session id, tool name, tool input, and so on).
- `emit.mjs` forwards that blob to `http://localhost:4317/hook` and exits. It must never slow down or break Claude Code: 300ms timeout, always exit 0.
- The server turns raw hook JSON into an `AgentEvent` (see [[Contracts]]), saves it to `demo/runs/<session>.jsonl`, and broadcasts it over WebSocket.
- The Arena finds the character whose id matches `agentType` and animates it.
- The narrator batches events per agent and asks a fast model for a one-line plain-English description, sent as a `narration` event (the speech bubble).

### The unknown to verify first

Spawns are easy: the delegation tool call names the subagent. The open question is whether hook payloads tell us **which subagent** made each Read or Edit inside its work. The Bridge stream checks this in its first hour and writes the answer in [[Decisions]]. If hooks can't tell us, we read Claude Code's transcript files under `~/.claude/projects/` instead, which is how Pixel Agents does it.

### Replay

Every live run is saved as a `.jsonl` file. `GET /replay/<file>` plays it back over the same WebSocket with the original timing. The Arena can't tell the difference. This is the demo safety net and also how judges see it on the deployed site.

### Making Claude actually delegate

Claude often does small tasks itself instead of delegating. That would leave only the lead moving. Defenses:

- The `CLAUDE.md` team section says plainly: "For any UI work, delegate to frontend-dev. Always have reviewer check changes before finishing."
- The demo prompt names the agents: "Use frontend-dev to add a dark mode toggle, test-engineer to write tests, and reviewer to check both."
- Rehearse it 10 times on the demo repo. Track the hit rate in [[Decisions]].
