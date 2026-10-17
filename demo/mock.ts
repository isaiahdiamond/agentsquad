// Plays a scripted ~60s fake session over /ws on a loop, so the web app can be built without Claude Code.
import { WebSocket } from "ws"
import type { AgentEvent } from "@agentsquad/shared"

const URL = process.env.WS_URL ?? `ws://localhost:${process.env.PORT ?? 4317}/ws`

type Step = [seconds: number, event: Omit<AgentEvent, "id" | "ts" | "sessionId">]

const lead = { agentId: "lead", agentType: "lead" }
const fe = { agentId: "frontend-dev-1", agentType: "frontend-dev" }
const be = { agentId: "backend-dev-1", agentType: "backend-dev" }
const te = { agentId: "test-engineer-1", agentType: "test-engineer" }
const rv = { agentId: "reviewer-1", agentType: "reviewer" }

const script: Step[] = [
  [0, { ...lead, kind: "session_start", state: "idle" }],
  [1, { ...lead, kind: "prompt", text: "Add a dark mode toggle that remembers the user's choice, with tests, and have it reviewed." }],
  [1.5, { ...lead, kind: "tool_start", state: "thinking" }],
  [2.5, { ...lead, kind: "narration", text: "Planning who takes the UI, the API and the tests." }],
  [4, { ...lead, kind: "tool_start", state: "reading", tool: "Read", target: "src/App.tsx" }],
  [5, { ...lead, kind: "tool_end", tool: "Read", target: "src/App.tsx" }],
  [5.5, { ...lead, kind: "tool_start", state: "searching", tool: "Grep", target: "theme" }],
  [6.5, { ...lead, kind: "tool_end", tool: "Grep", target: "theme" }],
  [7, { ...fe, kind: "spawn", tool: "Agent", parentId: "lead", text: "Add a dark mode toggle to the header." }],
  [7.5, { ...be, kind: "spawn", tool: "Agent", parentId: "lead", text: "Add an API route that saves the theme choice." }],
  [8, { ...te, kind: "spawn", tool: "Agent", parentId: "lead", text: "Write tests for the toggle and the route." }],
  [8.5, { ...lead, kind: "tool_start", state: "thinking" }],
  [9, { ...lead, kind: "narration", text: "Three specialists are on it." }],
  [9, { ...fe, kind: "tool_start", state: "searching", tool: "Glob", target: "src/**/*.tsx" }],
  [9.5, { ...be, kind: "tool_start", state: "reading", tool: "Read", target: "server/routes.ts" }],
  [10, { ...fe, kind: "tool_end", tool: "Glob", target: "src/**/*.tsx" }],
  [10, { ...te, kind: "tool_start", state: "reading", tool: "Read", target: "package.json" }],
  [11, { ...fe, kind: "narration", text: "Looking for where the header lives." }],
  [11, { ...be, kind: "tool_end", tool: "Read", target: "server/routes.ts" }],
  [11, { ...te, kind: "tool_end", tool: "Read", target: "package.json" }],
  [11.5, { ...be, kind: "narration", text: "Reading how the existing routes are set up." }],
  [12, { ...te, kind: "narration", text: "Checking which test runner the project uses." }],
  [12, { ...fe, kind: "tool_start", state: "reading", tool: "Read", target: "src/components/Header.tsx" }],
  [12.5, { ...be, kind: "tool_start", state: "searching", tool: "Grep", target: "router.get\\(" }],
  [13, { ...te, kind: "tool_start", state: "searching", tool: "Grep", target: "describe\\(" }],
  [13.5, { ...fe, kind: "tool_end", tool: "Read", target: "src/components/Header.tsx" }],
  [13.5, { ...be, kind: "tool_end", tool: "Grep", target: "router.get\\(" }],
  [14, { ...te, kind: "tool_end", tool: "Grep", target: "describe\\(" }],
  [14.5, { ...fe, kind: "tool_start", state: "writing", tool: "Edit", target: "src/components/Header.tsx" }],
  [14.5, { ...be, kind: "tool_start", state: "writing", tool: "Write", target: "server/routes/theme.ts" }],
  [15, { ...fe, kind: "narration", text: "Adding a sun and moon button to the header." }],
  [15, { ...te, kind: "tool_start", state: "writing", tool: "Write", target: "src/components/Header.test.tsx" }],
  [15.5, { ...be, kind: "narration", text: "Writing a route that stores the theme." }],
  [16, { ...te, kind: "narration", text: "Writing a test that clicks the toggle twice." }],
  [18, { ...fe, kind: "tool_end", tool: "Edit", target: "src/components/Header.tsx" }],
  [18.5, { ...be, kind: "tool_end", tool: "Write", target: "server/routes/theme.ts" }],
  [19, { ...fe, kind: "tool_start", state: "writing", tool: "Write", target: "src/hooks/useTheme.ts" }],
  [19, { ...be, kind: "tool_start", state: "writing", tool: "Edit", target: "server/index.ts" }],
  [19, { ...te, kind: "tool_end", tool: "Write", target: "src/components/Header.test.tsx" }],
  [19.5, { ...fe, kind: "narration", text: "Writing a hook that tracks the theme." }],
  [20, { ...be, kind: "narration", text: "Registering the new route." }],
  [20, { ...lead, kind: "tool_start", state: "waiting", text: "Claude needs your permission to use Bash" }],
  [20.5, { ...lead, kind: "narration", text: "Waiting for your OK to install a test helper." }],
  [21, { ...fe, kind: "tool_end", tool: "Write", target: "src/hooks/useTheme.ts" }],
  [21, { ...be, kind: "tool_end", tool: "Edit", target: "server/index.ts" }],
  [21.5, { ...te, kind: "tool_start", state: "writing", tool: "Write", target: "server/routes/theme.test.ts" }],
  [22, { ...fe, kind: "tool_start", state: "writing", tool: "Edit", target: "src/index.css" }],
  [22.5, { ...te, kind: "narration", text: "Adding a test for the theme route." }],
  [23, { ...fe, kind: "narration", text: "Adding dark colors to the stylesheet." }],
  [23, { ...be, kind: "tool_start", state: "running", tool: "Bash", target: "npx tsc --noEmit" }],
  [24, { ...be, kind: "narration", text: "Type-checking the server." }],
  [24, { ...lead, kind: "tool_start", state: "running", tool: "Bash", target: "npm install -D @testing-library/user-event" }],
  [24, { ...te, kind: "tool_end", tool: "Write", target: "server/routes/theme.test.ts" }],
  [24.5, { ...lead, kind: "narration", text: "Installing the test helper." }],
  [25, { ...fe, kind: "tool_end", tool: "Edit", target: "src/index.css" }],
  [26, { ...be, kind: "tool_end", tool: "Bash", target: "npx tsc --noEmit" }],
  [26, { ...lead, kind: "tool_end", tool: "Bash", target: "npm install -D @testing-library/user-event" }],
  [26.5, { ...be, kind: "agent_done", state: "done", text: "Theme route added and type-checks." }],
  [26.5, { ...lead, kind: "tool_start", state: "thinking" }],
  [27, { ...fe, kind: "agent_done", state: "done", text: "Toggle added to the header." }],
  [27.5, { ...te, kind: "tool_start", state: "running", tool: "Bash", target: "npm test" }],
  [28, { ...te, kind: "narration", text: "Running the test suite." }],
  [31, { ...te, kind: "tool_end", state: "error", tool: "Bash", target: "npm test", text: "1 failed: theme is lost after reload" }],
  [31.5, { ...te, kind: "narration", text: "One test fails: the theme is lost on reload." }],
  [33, { ...lead, kind: "narration", text: "A test is failing. The test engineer is on it." }],
  [36, { ...te, kind: "tool_start", state: "writing", tool: "Edit", target: "src/hooks/useTheme.ts" }],
  [36.5, { ...te, kind: "narration", text: "Saving the theme to localStorage." }],
  [38, { ...te, kind: "tool_end", tool: "Edit", target: "src/hooks/useTheme.ts" }],
  [38.5, { ...te, kind: "tool_start", state: "running", tool: "Bash", target: "npm test" }],
  [39, { ...te, kind: "narration", text: "Running the tests again." }],
  [41.5, { ...te, kind: "tool_end", tool: "Bash", target: "npm test" }],
  [42, { ...te, kind: "narration", text: "All six tests pass." }],
  [43, { ...te, kind: "agent_done", state: "done", text: "Fixed the reload bug. All tests pass." }],
  [43.5, { ...lead, kind: "narration", text: "Sending everything to the reviewer." }],
  [44, { ...rv, kind: "spawn", tool: "Agent", parentId: "lead", text: "Review the toggle, the route and the tests." }],
  [44.5, { ...lead, kind: "tool_start", state: "thinking" }],
  [45, { ...rv, kind: "tool_start", state: "reading", tool: "Read", target: "src/components/Header.tsx" }],
  [46, { ...rv, kind: "narration", text: "Reading the new header code." }],
  [47, { ...rv, kind: "tool_end", tool: "Read", target: "src/components/Header.tsx" }],
  [47.5, { ...rv, kind: "tool_start", state: "reading", tool: "Read", target: "server/routes/theme.ts" }],
  [48.5, { ...rv, kind: "narration", text: "Checking the route validates its input." }],
  [49, { ...rv, kind: "tool_end", tool: "Read", target: "server/routes/theme.ts" }],
  [49.5, { ...rv, kind: "tool_start", state: "searching", tool: "Grep", target: "localStorage" }],
  [50, { ...rv, kind: "narration", text: "Making sure the theme survives a reload." }],
  [51, { ...rv, kind: "tool_end", tool: "Grep", target: "localStorage" }],
  [52, { ...rv, kind: "agent_done", state: "done", text: "Looks good. Approved." }],
  [52.5, { ...lead, kind: "narration", text: "Dark mode is in, tested and reviewed." }],
  [53, { ...lead, kind: "agent_done", state: "done" }],
  [54, { ...lead, kind: "narration", text: "REPORT: Planned the work and handed it to four specialists.\n3 tool calls, 1 file touched, 53s active." }],
  [54, { ...fe, kind: "narration", text: "REPORT: Edited 3 files: Header.tsx, useTheme.ts, index.css.\n5 tool calls, 3 files touched, 20s active." }],
  [54, { ...be, kind: "narration", text: "REPORT: Edited 2 files: theme.ts, index.ts.\n5 tool calls, 3 files touched, 19s active." }],
  [54, { ...te, kind: "narration", text: "REPORT: Edited 3 files: Header.test.tsx, theme.test.ts, useTheme.ts. Hit 1 error along the way.\n7 tool calls, 4 files touched, 35s active." }],
  [54, { ...rv, kind: "narration", text: "REPORT: Read 2 files and approved the changes.\n3 tool calls, 2 files touched, 8s active." }],
  [55, { ...lead, kind: "session_end", state: "idle" }],
]

const LOOP_SECONDS = 60
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function connect(): Promise<WebSocket> {
  return new Promise((resolve) => {
    const ws = new WebSocket(URL)
    ws.once("open", () => resolve(ws))
    ws.once("error", async () => {
      console.log(`waiting for server at ${URL}...`)
      await sleep(1000)
      resolve(connect())
    })
  })
}

let ws = await connect()
console.log(`mock connected to ${URL}, looping a ${LOOP_SECONDS}s session (Ctrl+C to stop)`)

for (let run = 1; ; run++) {
  const sessionId = `mock-${Date.now()}`
  const start = Date.now()
  console.log(`run ${run}: ${sessionId}`)
  for (const [i, [at, step]] of script.entries()) {
    await sleep(Math.max(0, start + at * 1000 - Date.now()))
    if (ws.readyState !== WebSocket.OPEN) ws = await connect()
    const event: AgentEvent = { id: `${sessionId}-${i}`, ts: Date.now(), sessionId, ...step }
    ws.send(JSON.stringify(event))
  }
  await sleep(Math.max(0, start + LOOP_SECONDS * 1000 - Date.now()))
}
