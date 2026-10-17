import type { AgentEvent, AgentState } from "@agentsquad/shared"
import { WAITING } from "./narrator"
import { resultFor } from "./result"

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
  promptEvent?: AgentEvent
  agents: Map<string, LiveAgent>
}

const MISSION_IDLE_MS = 5 * 60_000
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
  if (!s && e.kind === "narration") return
  if (!s) {
    const joined = e.kind !== "session_start" && e.kind !== "prompt"
    s = { sessionId: e.sessionId, startedAt: e.ts, lastEventAt: e.ts, phase: joined ? "mission" : "connected", mission: joined ? { prompt: "", startedAt: e.ts, endedAt: null } : null, agents: new Map() }
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
  if (e.state && a.state === "waiting" && e.state !== "waiting" && a.status === WAITING) a.status = undefined
  if (e.state) a.state = e.state
  if (e.kind === "prompt" && e.agentId === "lead") {
    s.phase = "mission"
    s.mission = { prompt: e.text ?? "", startedAt: e.ts, endedAt: null }
    s.promptEvent = e
    for (const [id, other] of s.agents) if (other.done && id !== "lead") s.agents.delete(id)
    Object.assign(a, { done: false, task: e.text, status: undefined, report: undefined, since: e.ts })
  }
  if (e.kind === "spawn") Object.assign(a, { parentId: e.parentId, task: e.text, since: e.ts, done: false, state: e.state ?? "idle", status: a.done ? undefined : a.status })
  if (e.kind === "agent_done") {
    a.done = true
    if (e.agentId === "lead") {
      s.phase = "done"
      if (s.mission) s.mission.endedAt = e.ts
    }
  }
}

function latestSession() {
  for (const [id, s] of sessions) {
    if (Date.now() - s.lastEventAt > (s.phase === "mission" ? MISSION_IDLE_MS : IDLE_MS)) sessions.delete(id)
  }
  return [...sessions.values()].sort((a, b) => b.lastEventAt - a.lastEventAt)[0]
}

export function missionPrompt() {
  const s = latestSession()
  return s?.phase === "mission" ? s.promptEvent : undefined
}

export function snapshot() {
  const latest = latestSession()
  return {
    connected: !!latest,
    lastHookAt,
    live: latest
      ? {
          sessionId: latest.sessionId,
          startedAt: latest.startedAt,
          lastEventAt: latest.lastEventAt,
          phase: latest.phase,
          mission: latest.mission?.endedAt ? { ...latest.mission, result: resultFor(latest.sessionId, latest.mission.startedAt) ?? null } : latest.mission,
          agents: [...latest.agents.values()],
        }
      : null,
  }
}
