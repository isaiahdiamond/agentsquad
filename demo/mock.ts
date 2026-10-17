// Plays a scripted ~60s fake session over /ws on a loop, so the web app can be built without Claude Code.
import { WebSocket } from "ws"
import type { AgentEvent } from "@agentsquad/shared"
import { script } from "./script"

const URL = process.env.WS_URL ?? `ws://127.0.0.1:${process.env.PORT ?? 4317}/ws`

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
