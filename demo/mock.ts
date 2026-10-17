// Plays a scripted ~60s fake session over /ws on a loop, so the web app can be built without Claude Code.
import { WebSocket } from "ws"
import type { AgentEvent } from "@agentsquad/shared"

const URL = process.env.WS_URL ?? "ws://localhost:4317/ws"

type Step = [seconds: number, event: Omit<AgentEvent, "id" | "ts" | "sessionId">]

const lead = { agentId: "lead", agentType: "lead" }
const fe = { agentId: "frontend-dev-1", agentType: "frontend-dev" }
const te = { agentId: "test-engineer-1", agentType: "test-engineer" }
const rv = { agentId: "reviewer-1", agentType: "reviewer" }

const script: Step[] = [
  [0, { ...lead, kind: "session_start", state: "idle" }],
  [1, { ...lead, kind: "prompt", text: "Add a dark mode toggle with tests, and have it reviewed." }],
  [2, { ...lead, kind: "tool_start", state: "thinking" }],
  [3, { ...lead, kind: "narration", text: "Planning who handles the toggle and the tests." }],
  [5, { ...lead, kind: "tool_start", state: "reading", tool: "Read", target: "src/App.tsx" }],
  [6, { ...lead, kind: "tool_end", tool: "Read", target: "src/App.tsx" }],
  [7, { ...fe, kind: "spawn", tool: "Agent", parentId: "lead", text: "Add a dark mode toggle to the header." }],
  [8, { ...te, kind: "spawn", tool: "Agent", parentId: "lead", text: "Write tests for the dark mode toggle." }],
  [8.5, { ...lead, kind: "tool_start", state: "waiting" }],
  [9, { ...fe, kind: "tool_start", state: "searching", tool: "Glob", target: "src/**/*.tsx" }],
  [10, { ...fe, kind: "tool_end", tool: "Glob", target: "src/**/*.tsx" }],
  [10, { ...te, kind: "tool_start", state: "reading", tool: "Read", target: "package.json" }],
  [11, { ...fe, kind: "narration", text: "Looking for where the header lives." }],
  [11, { ...te, kind: "tool_end", tool: "Read", target: "package.json" }],
  [12, { ...fe, kind: "tool_start", state: "reading", tool: "Read", target: "src/components/Header.tsx" }],
  [13, { ...te, kind: "narration", text: "Checking which test runner the project uses." }],
  [14, { ...fe, kind: "tool_end", tool: "Read", target: "src/components/Header.tsx" }],
  [14, { ...te, kind: "tool_start", state: "searching", tool: "Grep", target: "describe\\(" }],
  [15, { ...te, kind: "tool_end", tool: "Grep", target: "describe\\(" }],
  [16, { ...fe, kind: "tool_start", state: "writing", tool: "Edit", target: "src/components/Header.tsx" }],
  [17, { ...fe, kind: "narration", text: "Adding a sun and moon toggle to the header." }],
  [20, { ...fe, kind: "tool_end", tool: "Edit", target: "src/components/Header.tsx" }],
  [21, { ...fe, kind: "tool_start", state: "writing", tool: "Write", target: "src/hooks/useTheme.ts" }],
  [22, { ...te, kind: "tool_start", state: "writing", tool: "Write", target: "src/components/Header.test.tsx" }],
  [23, { ...te, kind: "narration", text: "Writing a test that clicks the toggle twice." }],
  [24, { ...fe, kind: "tool_end", tool: "Write", target: "src/hooks/useTheme.ts" }],
  [25, { ...fe, kind: "tool_start", state: "writing", tool: "Edit", target: "src/index.css" }],
  [26, { ...fe, kind: "narration", text: "Adding dark colors to the stylesheet." }],
  [28, { ...fe, kind: "tool_end", tool: "Edit", target: "src/index.css" }],
  [29, { ...te, kind: "tool_end", tool: "Write", target: "src/components/Header.test.tsx" }],
  [30, { ...fe, kind: "agent_done", state: "done", text: "Toggle added to the header." }],
  [31, { ...te, kind: "tool_start", state: "running", tool: "Bash", target: "npm test" }],
  [32, { ...te, kind: "narration", text: "Running the test suite." }],
  [36, { ...te, kind: "tool_end", tool: "Bash", target: "npm test" }],
  [37, { ...te, kind: "narration", text: "All four tests pass." }],
  [38, { ...te, kind: "agent_done", state: "done", text: "Tests written and passing." }],
  [39, { ...lead, kind: "narration", text: "Sending both changes to the reviewer." }],
  [40, { ...rv, kind: "spawn", tool: "Agent", parentId: "lead", text: "Review the dark mode toggle and its tests." }],
  [41, { ...rv, kind: "tool_start", state: "reading", tool: "Read", target: "src/components/Header.tsx" }],
  [42, { ...rv, kind: "narration", text: "Reading the new header code." }],
  [44, { ...rv, kind: "tool_end", tool: "Read", target: "src/components/Header.tsx" }],
  [45, { ...rv, kind: "tool_start", state: "reading", tool: "Read", target: "src/hooks/useTheme.ts" }],
  [47, { ...rv, kind: "tool_end", tool: "Read", target: "src/hooks/useTheme.ts" }],
  [48, { ...rv, kind: "tool_start", state: "searching", tool: "Grep", target: "localStorage" }],
  [49, { ...rv, kind: "narration", text: "Checking the theme is saved between visits." }],
  [50, { ...rv, kind: "tool_end", tool: "Grep", target: "localStorage" }],
  [52, { ...rv, kind: "agent_done", state: "done", text: "Looks good. Approved." }],
  [53, { ...lead, kind: "narration", text: "Dark mode is in, tested and reviewed." }],
  [54, { ...lead, kind: "agent_done", state: "done" }],
  [55, { ...lead, kind: "narration", text: "REPORT: Planned the work and handed it to three specialists.\nRead App.tsx once." }],
  [55, { ...fe, kind: "narration", text: "REPORT: Built the dark mode toggle.\nChanged 3 files." }],
  [55, { ...te, kind: "narration", text: "REPORT: Wrote and ran the toggle tests.\nAll four pass." }],
  [55, { ...rv, kind: "narration", text: "REPORT: Reviewed the changes and approved them.\nNo edits made." }],
  [56, { ...lead, kind: "session_end", state: "idle" }],
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
