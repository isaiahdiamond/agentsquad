import type { AgentEvent, AgentState } from "@agentsquad/shared"

type LiveAgent = {
  agentId: string
  agentType: string
  parentId?: string
  state: AgentState
  task?: string
  status?: string
  report?: string
  done: boolean
  since: number
}

type Live = {
  sessionId: string
  startedAt: number
  lastEventAt: number
  phase: "connected" | "mission" | "done"
  mission: { prompt: string; startedAt: number; endedAt: number | null } | null
  agents: Map<string, LiveAgent>
}

const IDLE_MS = 30 * 60_000
const sessions = new Map<string, Live>()
let lastHookAt: number | null = null

export function sawHook() {
  lastHookAt = Date.now()
}

export function track(e: AgentEvent) {
  if (e.kind === "session_end") {
    sessions.delete(e.sessionId)
    return
  }
  let s = sessions.get(e.sessionId)
  if (!s) {
    s = { sessionId: e.sessionId, startedAt: e.ts, lastEventAt: e.ts, phase: "connected", mission: null, agents: new Map() }
    sessions.set(e.sessionId, s)
  }
  s.lastEventAt = e.ts
  let a = s.agents.get(e.agentId)
  if (!a && e.kind === "narration") return
  if (!a) {
    a = { agentId: e.agentId, agentType: e.agentType, state: "idle", done: false, since: e.ts }
    s.agents.set(e.agentId, a)
  }
  if (e.kind === "narration") {
    if (e.text?.startsWith("REPORT:")) a.report = e.text.slice(7).trim()
    else a.status = e.text
    return
  }
  if (e.state) a.state = e.state
  if (e.kind === "prompt" && e.agentId === "lead") {
    s.phase = "mission"
    s.mission = { prompt: e.text ?? "", startedAt: e.ts, endedAt: null }
    for (const [id, other] of s.agents) if (other.done && id !== "lead") s.agents.delete(id)
    Object.assign(a, { done: false, task: e.text, status: undefined, report: undefined, since: e.ts })
  }
  if (e.kind === "spawn") Object.assign(a, { parentId: e.parentId, task: e.text, since: e.ts, done: false })
  if (e.kind === "agent_done") {
    a.done = true
    if (e.agentId === "lead") {
      s.phase = "done"
      if (s.mission) s.mission.endedAt = e.ts
    }
  }
}

export function snapshot() {
  for (const [id, s] of sessions) if (Date.now() - s.lastEventAt > IDLE_MS) sessions.delete(id)
  const latest = [...sessions.values()].sort((a, b) => b.lastEventAt - a.lastEventAt)[0]
  return {
    connected: !!latest,
    lastHookAt,
    live: latest
      ? {
          sessionId: latest.sessionId,
          startedAt: latest.startedAt,
          lastEventAt: latest.lastEventAt,
          phase: latest.phase,
          mission: latest.mission,
          agents: [...latest.agents.values()],
        }
      : null,
  }
}
