import type { AgentEvent, AgentState, Look, Scene, Squad } from "@agentsquad/shared"
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
  say?: string
  sayAt: number
  report?: string
  doneText?: string
  waitText?: string
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
export type Toast = { id: string; agentId: string; agentType: string; text: string; tone: "info" | "wait" | "error" | "done"; named: boolean; at: number }
export type FileTouch = { path: string; agentId: string; agentType: string; changed: boolean; at: number }

export type Arena = {
  sessionId?: string
  prompt?: string
  promptAt: number
  focusId?: string
  focusAt: number
  toasts: Toast[]
  startAt: number
  endAt: number
  toolCount: number
  spawns: number
  agents: Record<string, Agent>
  feed: FeedItem[]
  files: FileTouch[]
  spans: Span[]
  open: Record<string, number>
  lastAt: number
  reportAt: number
  seen: string[]
  feedN: number
}

export const emptyArena = (): Arena => ({
  startAt: 0, promptAt: 0, focusAt: 0, toasts: [], endAt: 0, toolCount: 0, spawns: 0, agents: {}, feed: [], files: [], spans: [], open: {}, lastAt: 0, reportAt: 0, seen: [], feedN: 0,
})

const FILE_TOOLS = ["Read", "Edit", "Write", "NotebookEdit", "MultiEdit"]
const CHANGE_TOOLS = ["Edit", "Write", "NotebookEdit", "MultiEdit"]

export function reduce(prev: Arena, e: Received): Arena {
  if (prev.seen.includes(e.id)) return prev
  // Another session can only take over once this one is finished or has gone quiet for a minute.
  if (prev.sessionId && e.sessionId !== prev.sessionId) {
    if (!finishedAt(prev) && e.at - prev.lastAt < 60000) return prev
    prev = emptyArena()
  }
  if (e.kind === "session_start") prev = { ...emptyArena(), sessionId: e.sessionId, startAt: e.at }
  if (e.kind === "prompt" && (prev.endAt || prev.agents.lead?.doneAt)) prev = { ...emptyArena(), sessionId: e.sessionId, startAt: e.at }
  const s: Arena = { ...prev, agents: { ...prev.agents }, lastAt: e.at, seen: [...prev.seen.slice(-299), e.id] }
  if (!s.startAt) s.startAt = e.at
  if (!s.sessionId) s.sessionId = e.sessionId

  const old = s.agents[e.agentId]
  const a: Agent = old ? { ...old } : {
    id: e.agentId, type: e.agentType, state: "idle", narrationAt: 0, sayAt: 0, files: [], changed: [], tools: 0,
    firstAt: e.at, lastAt: e.at, pulseAt: 0, fixedAt: 0, doneAt: 0, order: Object.keys(s.agents).length,
  }
  s.agents[e.agentId] = a
  a.lastAt = e.at
  const toast = (text: string, tone: Toast["tone"], named = false) => {
    s.toasts = [...(s.toasts ?? []).slice(-19), { id: `${e.id}:t`, agentId: a.id, agentType: a.type, text, tone, named, at: e.at }]
  }
  const focus = () => {
    s.focusId = a.id
    s.focusAt = e.at
  }
  const feed = (text: string) => {
    s.feed = [{ id: `${e.id}:${s.feedN++}`, agentId: a.id, agentType: a.type, text, at: e.at }, ...s.feed].slice(0, 60)
  }

  if (e.kind === "prompt") {
    s.prompt = e.text
    s.promptAt = e.at
    focus()
  }
  if (e.kind === "spawn") {
    s.spawns = (s.spawns ?? 0) + 1
    a.doneAt = 0
    a.doneText = undefined
    a.task = e.text
    a.say = e.text
    a.sayAt = e.at
    a.state = e.state ?? "thinking"
    focus()
    if (e.text) feed(`New task: ${e.text}`)
  }
  if (e.kind === "tool_start") {
    if (e.tool) {
      if (a.state === "error") a.fixedAt = e.at
      if (!a.doneAt && (a.state === "error" || a.state === "waiting")) a.state = "thinking"
      s.toolCount++
      a.tools++
      a.tool = e.tool
      a.target = e.target
      a.pulseAt = e.at
      if (a.type !== "lead" || !s.focusAt || e.at - s.focusAt > 4000) focus()
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
    if (e.text.startsWith("REPORT:")) {
      a.report = e.text.slice(7).trim()
      s.reportAt = e.at
    } else if (!a.doneAt) {
      a.narration = e.text
      a.narrationAt = e.at
      if (a.type === "lead" && a.state !== "waiting") toast(e.text, "info")
      if (a.state === "waiting" && e.at - a.sayAt < 3000) a.say = e.text
      feed(e.text)
    }
  }
  if (e.kind === "agent_done") {
    a.state = "done"
    a.doneAt = e.at
    a.doneText = e.text
    a.say = e.text || "Done."
    a.sayAt = e.at
    if (a.type !== "lead") {
      toast("finished", "done", true)
      focus()
    }
    feed(e.text ? `Done: ${e.text}` : "Done.")
  }
  if (e.kind === "session_end") s.endAt = e.at

  if (e.state && !a.doneAt) {
    if (e.state === "error" && a.state !== "error") {
      const what = e.kind !== "narration" && e.text ? e.text : `Hit an error${e.target ? ` on ${e.target}` : e.tool ? ` in ${e.tool}` : ""}`
      feed(e.kind !== "narration" && e.text ? `Error: ${e.text}` : `${what}.`)
      a.waitText = what
      toast(e.kind !== "narration" && e.text ? `hit an error: ${e.text}` : "hit an error", "error", true)
      focus()
    }
    if (e.state === "waiting" && a.state !== "waiting") {
      feed("Waiting for you.")
      a.say = "Needs your OK."
      a.sayAt = e.at
      a.waitText = e.kind !== "narration" && e.text ? e.text : undefined
      toast("Waiting for you: approve in your terminal", "wait")
      focus()
    }
    a.state = e.state
  }
  return s
}

export type Who = { type: string; name: string; role: string; color: string; look?: Look; lead: boolean }

export const LEAD_COLOR = "#f5c542"

export function who(type: string, squad: Squad | null): Who {
  if (type === "lead") {
    return {
      type,
      name: squad?.lead.name || "Lead",
      role: squad?.lead.role || "Lead Agent",
      color: LEAD_COLOR,
      look: squad?.lead.look ?? undefined,
      lead: true,
    }
  }
  const c = squad?.members.find((m) => m.id === type) ?? roster.find((r) => r.id === type)
  if (!c) {
    const name = type.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    return { type, name: /agent$/i.test(name) ? name : `${name} Agent`, role: "Specialist", color: "#94a3b8", lead: false }
  }
  return { type, name: c.name, role: c.role, color: c.color, lead: false }
}

// The turn is over on session_end, or when the lead is done and no specialist is still working.
export function finishedAt(arena: Arena) {
  const real = arena.startAt > 0 && (arena.toolCount > 0 || arena.spawns > 0)
  if (!real) return 0
  if (arena.endAt) return arena.endAt
  const all = Object.values(arena.agents)
  const lead = arena.agents.lead
  if (!lead?.doneAt || all.some((a) => !a.doneAt)) return 0
  return Math.max(...all.map((a) => a.doneAt))
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
  if (t < 60) return `${Math.max(1, t)}s ago`
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

function validReport(r: unknown): r is Report {
  const a = (r as Report | null)?.arena
  if (!a || typeof a !== "object" || !a.agents || typeof a.agents !== "object") return false
  if (![a.feed, a.files, a.spans].every(Array.isArray) || typeof a.startAt !== "number") return false
  return Object.values(a.agents).every((g) => g && typeof g.type === "string" && Array.isArray(g.files) && Array.isArray(g.changed))
}

export function loadReport(): Report | null {
  if (saved) return saved
  try {
    const raw = sessionStorage.getItem(KEY)
    const r = raw ? JSON.parse(raw) : null
    return validReport(r) ? r : null
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
