# Session Flow: Standby, Missions and Portal Spawns

> Status: **planned, not started** (queued after the Arena Art round and the Gemini activity log). Like every note in this vault, it's a working draft: edit it as the team learns. See "Architect notes" at the end for where it differs from what the code does today.

How the arena behaves from deploy to done. The scene only reacts to Claude Code hook events. Nothing in Claude happens until the user types a prompt.

## States

```
deployed ──SessionStart──▶ connected ──UserPromptSubmit──▶ mission ──Stop──▶ connected (next prompt)
```

| State | Lead | Team | HUD |
|---|---|---|---|
| deployed (no Claude session yet) | Standing at the lead spot, idle bob | Not in the scene. Greyed portraits in an "On call" tray at the bottom | "Waiting for Claude Code. Run `claude` in this project." with a copy button. Note: "Deploy before starting Claude, or restart it" |
| connected (session, no prompt yet) | Looks up, small "!" then idle | Same tray, portraits lit | "Connected. Give your lead a task in Claude Code." |
| mission | Planning, working, delegating | Spawn via portal when delegated, work at desks | Mission title from the prompt, timer, active agents |
| mission done | Green check, "Done" bubble | Return to tray | "Mission complete" chip with View report button |

A session can run many missions. Each `UserPromptSubmit` starts a new one.

## Hook to event mapping (add to the Bridge)

| Hook | Event | Data to forward |
|---|---|---|
| SessionStart | `session_start` | session id |
| UserPromptSubmit | `prompt` | prompt text, trimmed to 80 chars for the bubble |
| PreToolUse on `Task` or `Agent` | `spawn` | `tool_input.subagent_type` as agentType, `tool_input.description` (or first line of `tool_input.prompt`) as `text` |
| PreToolUse / PostToolUse other tools | `tool_start` / `tool_end` | as before |
| Notification | state `waiting` | message |
| SubagentStop | `agent_done` | agent |
| Stop | `session_end` for the mission | |

If `subagent_type` is not one of the deployed roster ids, show it as a generic agent rather than dropping it.

## Lead "thank you" moment

On `prompt`:
1. Lead faces the camera, bubble "Got it." for 1.2s
2. Bubble changes to the trimmed task text for 3s
3. Lead switches to thinking, then follows tool events as usual

## Portal spawn (on `spawn`)

Built in code. Optional art: `art/fx/portal.png`, a static isometric glowing floor ring that code rotates and pulses.

Spawn point: a free spot about 1.5 sprite widths beside the lead. In campus view, beside the building door the agent will enter.

Timeline, about 1.2s:

| t (ms) | What happens |
|---|---|
| 0 | Delegation line draws from lead to the spawn point in the agent's accent color. Tray portrait flashes |
| 0-250 | Portal ring scales from 0 to full on the floor, slow rotation |
| 150-450 | Light beam column fades in above the ring, full scene height, pixelated noise texture, agent accent color at low opacity |
| 400-750 | Agent falls down the beam from the top of the scene, ease-in |
| 750-850 | Lands: 2-frame squash (scaleY 0.85 then 1), ring of 6-8 pixel dust squares bursts out |
| 850-1200 | Beam and portal shrink and fade. Agent bubble shows its task text for 3s |
| then | Agent walks to its desk station (see [[Arena Art]]) |

Several spawns in one burst: stagger each by 300ms so it reads as a squad assembling.

Despawn on `agent_done`: stand up, walk back next to the lead, short beam up (reverse of the fall, 500ms), portrait returns to tray with a check mark.

Pixel rules apply to effects too: snap effect positions to whole scene pixels, no blur filters, no anti-aliased gradients on the beam (use stepped bands or dithering).

## Viewing in VS Code

No extension needed. Cmd/Ctrl+Shift+P, "Simple Browser: Show", enter the arena URL. The Claude Code VS Code extension runs the same project hooks, so the arena updates the same way. Verify once: run a prompt from the extension and confirm `session_start` and `prompt` reach the server.

## Edge cases

- Claude does all the work itself and never delegates: team stays in the tray, lead does everything. Expected. The demo prompt names the agents to avoid this.
- Arena opened after the session already started: on load, call `GET /state` and jump straight to the right state with agents already at desks, no portals.
- Prompt arrives while a mission is running (user interrupts): end the current mission quietly, start the new one.
- No events for 60s during a mission: lead shows "..." so the scene never looks frozen.

## Done when

- Fresh deploy shows the lead alone with the "Waiting for Claude Code" hint
- Running `claude` flips the hint to connected
- Typing a task triggers "Got it" and the task bubble
- A delegation produces the full portal sequence and the agent ends up typing at a desk
- Finishing returns everyone to the tray and shows Mission complete
- Same flow works when the arena is opened in VS Code's Simple Browser

## Architect notes (reconcile before building)

- **Stop vs session end.** Today (see [[Decisions]] Event conventions, "Turns"): `Stop` sends lead `agent_done` + per-turn `REPORT:` lines, and `session_end` is only sent on `SessionEnd`, because Stop fires after every turn. This doc's "mission" model fits that: treat a turn (prompt → Stop) as a mission; don't emit `session_end` on Stop or the arena will think the whole session ended. Proposal: add no new event kind; the arena starts a mission on `prompt` and ends it on lead `agent_done`.
- **Spawn timing.** The Bridge currently emits `spawn` on `SubagentStart` (verified in hooks/FINDINGS.md; it carries the real `agent_id`). PreToolUse on `Agent` fires slightly earlier but has no agent id yet. Keep SubagentStart for the event; PreToolUse could start the portal early if the delay is noticeable.
- **Tool name.** Claude Code 2.1.302 delegates with `Agent` (never saw `Task`); the server already accepts both.
- **State snapshot.** "Arena opened after the session started" needs `/state` to return live agents, not just the deployed squad. That's a Bridge addition (a contract note in [[Contracts]] when built).
- **URL.** In dev the arena is `http://localhost:5173/arena` (Vite); the server on 4317 has no UI. A production build served by the server would make 4317 work.
- **Reviewer pairing** (user to-do): the reviewer should join the agent it reviews instead of going to its own building; fold into the spawn/desk placement when building this.
