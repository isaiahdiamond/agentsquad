import { useEffect, useState } from "react"
import type { AgentEvent } from "@agentsquad/shared"

// Phase 0 placeholder: a plain list of incoming events to prove /ws is flowing.
export default function ArenaPage() {
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`)
    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (msg) => setEvents((prev) => [JSON.parse(msg.data), ...prev].slice(0, 200))
    return () => ws.close()
  }, [])

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">Arena</h1>
      <p className="mb-4 text-sm text-neutral-400">
        {connected ? "Connected to /ws" : "Not connected"} · {events.length} events
      </p>
      <ul className="space-y-1 font-mono text-xs">
        {events.map((e) => (
          <li key={e.id} className="flex gap-3">
            <span className="text-neutral-500">{new Date(e.ts).toLocaleTimeString()}</span>
            <span className="w-32 text-sky-400">{e.agentType}</span>
            <span className="w-24 text-amber-400">{e.kind}</span>
            <span className="w-20 text-emerald-400">{e.state ?? ""}</span>
            <span>{[e.tool, e.target, e.text].filter(Boolean).join(" · ")}</span>
          </li>
        ))}
      </ul>
    </main>
  )
}
