import http from "node:http"
import { WebSocketServer, WebSocket } from "ws"
import type { Squad } from "@agentsquad/shared"

const PORT = Number(process.env.PORT ?? 4317)

// Phase 0 stubs. The Bridge stream replaces each one with the real behavior in vault/streams/Bridge.md.
let lastSquad: Squad | null = null

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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`)
  const route = `${req.method} ${url.pathname}`

  if (route === "POST /hook") {
    await readJson(req)
    return send(res, 200, { ok: true })
  }
  if (route === "POST /deploy") {
    lastSquad = (await readJson(req)) as Squad | null
    return send(res, 200, { files: [] })
  }
  if (route === "POST /undeploy") {
    lastSquad = null
    return send(res, 200, { ok: true })
  }
  if (route === "GET /runs") return send(res, 200, [])
  if (req.method === "GET" && url.pathname.startsWith("/replay/")) {
    return send(res, 404, { error: "no recorded runs yet" })
  }
  if (route === "GET /state") {
    return send(res, 200, { squad: lastSquad, scene: lastSquad?.scene ?? null })
  }
  send(res, 404, { error: "not found" })
})

const wss = new WebSocketServer({ server, path: "/ws" })

// Anything a client sends (for now, only `npm run mock`) is relayed to every other client.
wss.on("connection", (socket) => {
  socket.on("message", (data) => {
    for (const client of wss.clients) {
      if (client !== socket && client.readyState === WebSocket.OPEN) client.send(data.toString())
    }
  })
})

server.listen(PORT, () => console.log(`agentsquad server on http://localhost:${PORT} (ws at /ws)`))
