import type { AgentEvent, AgentState, Scene, Squad } from "@agentsquad/shared"
import { roster } from "../builder/roster"

export type Received = AgentEvent & { at: number }

export type Agent = {
  id: string
  type: string
  state: AgentState
  tool?: string
  target?: string
  task?: string
  narration?: string
  narrationAt: number
  report?: string
  doneText?: string
  files: string[]
  changed: string[]
  tools: number
  firstAt: number
  lastAt: number
  pulseAt: number
  fixedAt: number
  doneAt: number
  order: number
}

export type FeedItem = { id: string; agentId: string; agentType: string; text: string; at: number }
export type Span = { agentId: string; start: number; end: number }
export type FileTouch = { path: string; agentId: string; agentType: string; changed: boolean; at: number }

export type Arena = {
  sessionId?: string
  prompt?: string
  startAt: number
  endAt: number
  toolCount: number
  agents: Record<string, Agent>
  feed: FeedItem[]
  files: FileTouch[]
  spans: Span[]
  open: Record<string, number>
}

export const emptyArena = (): Arena => ({
  startAt: 0, endAt: 0, toolCount: 0, agents: {}, feed: [], files: [], spans: [], open: {},
})

const FILE_TOOLS = ["Read", "Edit", "Write", "NotebookEdit", "MultiEdit"]
const CHANGE_TOOLS = ["Edit", "Write", "NotebookEdit", "MultiEdit"]

export function reduce(prev: Arena, e: Received): Arena {
  if (e.kind === "session_start") prev = { ...emptyArena(), sessionId: e.sessionId, startAt: e.at }
  const s: Arena = { ...prev, agents: { ...prev.agents } }
  if (!s.startAt) s.startAt = e.at
  if (!s.sessionId) s.sessionId = e.sessionId

  const old = s.agents[e.agentId]
  const a: Agent = old ? { ...old } : {
    id: e.agentId, type: e.agentType, state: "idle", narrationAt: 0, files: [], changed: [], tools: 0,
    firstAt: e.at, lastAt: e.at, pulseAt: 0, fixedAt: 0, doneAt: 0, order: Object.keys(s.agents).length,
  }
  s.agents[e.agentId] = a
  a.lastAt = e.at
  const feed = (text: string) => { s.feed = [{ id: e.id, agentId: a.id, agentType: a.type, text, at: e.at }, ...s.feed].slice(0, 60) }

  if (e.kind === "prompt") s.prompt = e.text
  if (e.kind === "spawn") {
    a.task = e.text
    a.state = e.state ?? "thinking"
    if (e.text) feed(`New task: ${e.text}`)
  }
  if (e.kind === "tool_start") {
    if (e.tool) {
      if (a.state === "error") a.fixedAt = e.at
      if (a.state === "error" || a.state === "waiting") a.state = "thinking"
      s.toolCount++
      a.tools++
      a.tool = e.tool
      a.target = e.target
      a.pulseAt = e.at
      s.open = { ...s.open, [a.id]: e.at }
      if (e.target && FILE_TOOLS.includes(e.tool)) {
        const changed = CHANGE_TOOLS.includes(e.tool)
        if (!a.files.includes(e.target)) a.files = [...a.files, e.target]
        if (changed && !a.changed.includes(e.target)) a.changed = [...a.changed, e.target]
        const i = s.files.findIndex((f) => f.path === e.target && f.agentId === a.id)
        const touch = { path: e.target, agentId: a.id, agentType: a.type, changed: changed || (i >= 0 && s.files[i].changed), at: e.at }
        s.files = [touch, ...s.files.filter((_, j) => j !== i)]
      }
    }
  }
  if (e.kind === "tool_end" && s.open[a.id]) {
    s.spans = [...s.spans, { agentId: a.id, start: s.open[a.id], end: e.at }]
    const { [a.id]: _, ...rest } = s.open
    s.open = rest
  }
  if (e.kind === "narration" && e.text) {
    if (e.text.startsWith("REPORT:")) a.report = e.text.slice(7).trim()
    else {
      a.narration = e.text
      a.narrationAt = e.at
      feed(e.text)
    }
  }
  if (e.kind === "agent_done") {
    a.state = "done"
    a.doneAt = e.at
    a.doneText = e.text
    feed(e.text ? `Done: ${e.text}` : "Done.")
  }
  if (e.kind === "session_end") s.endAt = e.at

  if (e.state && e.kind !== "agent_done") {
    if (e.state === "error" && a.state !== "error") feed(`Hit an error${e.target ? ` on ${e.target}` : e.tool ? ` in ${e.tool}` : ""}.`)
    if (e.state === "waiting" && a.state !== "waiting") feed("Waiting for you.")
    if (!(e.kind === "session_end" && a.state === "done")) a.state = e.state
  }
  return s
}

export type Who = { name: string; role: string; color: string; portrait: string; lead: boolean }

export const LEAD_COLOR = "#f5c542"

export function who(type: string, squad: Squad | null): Who {
  if (type === "lead") {
    return {
      name: squad?.lead.name || "Lead",
      role: squad?.lead.role || "Lead Agent",
      color: LEAD_COLOR,
      portrait: squad?.lead.portrait || "/art/roster/lead.png",
      lead: true,
    }
  }
  const c = squad?.members.find((m) => m.id === type) ?? roster.find((r) => r.id === type)
  if (!c) return { name: type, role: "Specialist", color: "#94a3b8", portrait: `/art/roster/${type}.png`, lead: false }
  return { name: c.name, role: c.role, color: c.color, portrait: c.portrait, lead: false }
}

export function buildingFor(scene: Scene, type: string) {
  const list = scene.buildings ?? []
  const i = list.findIndex((b) => b.roles.includes(type))
  return i >= 0 ? i : 0
}

export function activeMs(a: Agent, arena: Arena) {
  const end = a.doneAt || arena.endAt || a.lastAt
  const start = a.type === "lead" ? arena.startAt || a.firstAt : a.firstAt
  return Math.max(0, end - start)
}

export function clock(ms: number) {
  const t = Math.floor(ms / 1000)
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`
}

export function ago(ms: number) {
  const t = Math.floor(ms / 1000)
  if (t < 5) return "now"
  if (t < 60) return `${t}s ago`
  return `${Math.floor(t / 60)}m ago`
}

export type Report = { arena: Arena; squad: Squad | null }

const KEY = "agentsquad:report"
let saved: Report | null = null

export function saveReport(r: Report) {
  saved = r
  try {
    sessionStorage.setItem(KEY, JSON.stringify(r))
  } catch {}
}

export function loadReport(): Report | null {
  if (saved) return saved
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Report) : null
  } catch {
    return null
  }
}

export function clearReport() {
  saved = null
  try {
    sessionStorage.removeItem(KEY)
  } catch {}
}
