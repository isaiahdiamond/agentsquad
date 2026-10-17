import fs from "node:fs"
import http from "node:http"
import path from "node:path"
import { WebSocketServer, WebSocket } from "ws"
import type { AgentEvent } from "@agentsquad/shared"
import { handleHook, type Out } from "./hook"
import { createNarrator, narratorMode } from "./narrator"
import { ROOT, deploy, loadState, undeploy } from "./deploy"

const PORT = Number(process.env.PORT ?? 4317)
const RUNS = path.join(ROOT, "demo/runs")
fs.mkdirSync(RUNS, { recursive: true })

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" })
  res.end(JSON.stringify(body))
}

async function readJson(req: http.IncomingMessage): Promise<unknown> {
  let raw = ""
  for await (const chunk of req) raw += chunk
  try {
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function broadcast(data: string, except?: WebSocket) {
  for (const client of wss.clients) {
    if (client !== except && client.readyState === WebSocket.OPEN) client.send(data)
  }
}

let seq = 0
function emit(e: Out) {
  const event: AgentEvent = { id: `${e.sessionId}-${Date.now().toString(36)}-${seq++}`, ts: Date.now(), ...e }
  const line = JSON.stringify(event)
  fs.appendFile(path.join(RUNS, `${e.sessionId.replace(/[^\w.-]/g, "_")}.jsonl`), line + "\n", () => {})
  broadcast(line)
  narrator.feed(event)
}

const narrator = createNarrator(emit)

function runFile(name: string) {
  if (!/^[\w.-]+\.jsonl$/.test(name) || name.includes("..")) return null
  const file = path.join(RUNS, name)
  return fs.existsSync(file) ? file : null
}

function readRun(file: string): AgentEvent[] {
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).flatMap((l) => {
    try {
      return [JSON.parse(l)]
    } catch {
      return []
    }
  })
}

let replayTimers: NodeJS.Timeout[] = []
function replay(events: AgentEvent[], speed: number) {
  for (const t of replayTimers) clearTimeout(t)
  const start = events[0]?.ts ?? 0
  replayTimers = events.map((e) => setTimeout(() => broadcast(JSON.stringify({ ...e, ts: Date.now() })), (e.ts - start) / speed))
  return events.length ? (events[events.length - 1].ts - start) / speed : 0
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`)
  const route = `${req.method} ${url.pathname}`

  try {
    if (route === "POST /hook") {
      handleHook(await readJson(req), emit, narrator.reports)
      return send(res, 200, { ok: true })
    }
    const json = (req.headers["content-type"] ?? "").split(";")[0].trim() === "application/json"
    if ((route === "POST /deploy" || route === "POST /undeploy") && !json) {
      return send(res, 415, { error: "content-type must be application/json" })
    }
    if (route === "POST /deploy") return send(res, 200, deploy((await readJson(req)) as any))
    if (route === "POST /undeploy") return send(res, 200, undeploy())
    if (route === "GET /state") {
      const state = loadState()
      return send(res, 200, { squad: state.squad, scene: state.squad?.scene ?? null, target: state.target })
    }
    if (route === "GET /runs") {
      const runs = fs.readdirSync(RUNS).filter((f) => f.endsWith(".jsonl")).map((file) => {
        const events = readRun(path.join(RUNS, file))
        const first = events[0]?.ts ?? 0
        const last = events[events.length - 1]?.ts ?? 0
        return { file, events: events.length, startedAt: first, durationMs: last - first }
      })
      return send(res, 200, runs.sort((a, b) => b.startedAt - a.startedAt))
    }
    if (req.method === "GET" && url.pathname.startsWith("/replay/")) {
      const file = runFile(decodeURIComponent(url.pathname.slice("/replay/".length)))
      if (!file) return send(res, 404, { error: "no such run" })
      const speed = Number(url.searchParams.get("speed") ?? 1)
      const events = readRun(file)
      const durationMs = replay(events, speed > 0 && speed <= 100 ? speed : 1)
      return send(res, 200, { ok: true, events: events.length, durationMs })
    }
    send(res, 404, { error: "not found" })
  } catch (err) {
    send(res, 400, { error: err instanceof Error ? err.message : String(err) })
  }
})

const wss = new WebSocketServer({ server, path: "/ws" })

// Anything a client sends (for now, only `npm run mock`) is relayed to every other client.
wss.on("connection", (socket) => {
  socket.on("message", (data) => broadcast(data.toString(), socket))
})

server.listen(PORT, "127.0.0.1", () => {
  console.log(`agentsquad server on http://127.0.0.1:${PORT} (ws at /ws)`)
  console.log(narratorMode())
})
