# In-World HUD

> Status (2026-10-17, Arena): **sections 1–7 built** on branch `worktree-agent-acc84ebf332e5527d` (one commit per milestone). Section 8 (ambience) not started. Deviations: the stand-up camera targets the lead at 1.3x and Follow centers 75% of the way toward the event so the scene keeps context; the toast backlog keeps at most two lines; an error chip/nameplate goes red (not in the table).
>
> Original status: planned — a big arena change the user queued for after the current proportion work. A working draft like every vault note; edit as we learn. See "Architect notes" at the end.

Goal: the scene is the whole screen and status lives inside it. No fixed sidebars or stat bars on the arena page. Reference: a 3D agent world ("The Commons") where all UI floats over a full-bleed world, labels are attached to buildings and characters, and panels appear only during events. We keep our 2D pixel style and dark glass UI.

## 1. Full-bleed stage

- The arena stage fills the viewport. Scale the 2688x1520 stage to **cover** (crop edges) instead of contain (letterbox). Keep the scaling rules from [[Arena Art]]: one transform for the whole stage, pixelated rendering.
- Remove the top stats bar and the right Activity/Files sidebar from the arena page.
- App nav (Builder, Arena, Report) becomes a small pill top-left, collapsed to the wordmark until hovered.

## 2. Floating chrome

All chrome is small glass pills over the scene: background `rgba(11,13,18,0.6)`, `backdrop-filter: blur(12px)`, 1px border `rgba(255,255,255,0.08)`, radius 999px for pills and 14px for cards, Inter 13px.

| Where | What |
|---|---|
| Top left | Wordmark, then mission title (trimmed prompt) and timer |
| Top right | Team chips: small round portraits. Grey = on call, ring in accent color = working, yellow ring + pulse = needs you, green check = done. Click a chip to pan the camera to that agent |
| Bottom left | Mode caption, serif-free, 15px: "Standing by", "Mission: add dark mode", "3 agents working", "Waiting for you", "Mission complete" |
| Bottom center | Narration toast, one at a time, 3.5s, fades: "Lead assembled the team", "Test Agent found a failing test", "Waiting for you: approve in terminal", "All tests passing" |
| Bottom right | "Log" pill opens the drawer. "Follow" toggle for the camera |

## 3. Labels in the world

- **Building signs** on the campus map: small glass sign anchored above each door. Line 1 building name ("Lab"), line 2 who's inside as tiny portraits. Yellow border when someone inside needs you, small flame icon on error.
- **Agent nameplates**: tiny label above each agent's head, role plus current verb: "Frontend · editing", "Test · running tests". 11px, one line, follows the agent.
- **Speech bubbles** only for key moments: task assigned (on spawn), needs you, done. Max one bubble per agent, 4s, and never overlapping: if two bubbles collide, push the later one up until it clears. No half-transparent stacked bubbles.
- Narration text from the narrator goes to the nameplate verb and the Log, not to a bubble every time.

## 4. Event panels (appear, then close)

| Event | Panel |
|---|---|
| Prompt received | "Mission briefing" card slides in from the right: the task, then one row per assigned agent with portrait and its task line as delegations arrive. Auto-closes 6s after the last delegation, reopens from the Log |
| Needs you | Small card at bottom center above the toast: who is waiting, the message, "Approve in your terminal" |
| Mission done | "Mission complete" card: time, files changed, tool calls, per-agent one-liners, buttons "View report" and "Replay". Stays until closed |

## 5. Stand-up moment

On prompt, before work starts:
1. Camera eases to the lead at the clock tower plaza (600ms)
2. Each delegated agent portals in around the lead in a half circle (see [[Session Flow]] portal timeline)
3. Each says its task in a bubble, staggered
4. Toast: "Lead assembled the team"
5. Agents walk to their buildings, camera eases back out

Indoor scenes (office, beach) do the same around the lead's spot, then agents walk to desks.

## 6. Camera

- Default: whole scene in view
- Follow mode (on by default during a mission): gentle pan and zoom up to 1.3x toward the newest event (portal, building that just got busy), 800ms ease, never faster than once every 3s
- Any manual drag or scroll turns Follow off until the user re-enables it

## 7. Log drawer

Slides over the right 360px of the scene, glass card. Tabs: Activity (the old feed, with real relative times like "12s ago" instead of "now"), Files (file, agent). Closed by default.

## 8. Ambience (polish, after the above works)

- Campus water shimmer: a looping overlay of a few moving light pixels on the lake
- Slight scene tint that drifts from day to dusk over a long session
- Occasional bird crossing the campus

## Done when

- No black bars at any window size, no fixed sidebars
- With the Log closed you can still tell who is doing what from nameplates, chips and signs
- Bubbles never overlap
- A prompt produces the stand-up moment and the briefing card
- "Needs you" is visible from the map view without opening anything

## Architect notes (reconcile before building)

- **Overlaps [[Session Flow]]:** the stand-up moment, portal spawns, mission states and On-call tray all live there. Build them together as one arena round; the team chips here replace that doc's On-call tray.
- **Cover vs. contain:** cover crops scene edges at some window shapes, so building doors/desk stations near the edges may go off-screen. Keep a safe area (stations and doors inside the central ~80%) or clamp the camera so the active agent stays visible.
- **The calm activity log (Gemini) feeds this:** narration becomes nameplate verbs, toasts and the Log tab instead of a constantly scrolling sidebar — which is exactly the "less sporadic" goal. Do the Gemini narrator before or with this.
- **Accent:** chips use the blue accent `#5A8FE6`, "needs you" yellow, done green, per [[Decisions]].
