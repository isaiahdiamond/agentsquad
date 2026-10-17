import type { AgentEvent, AgentState, Look, Scene, Squad } from "@agentsquad/shared"
import { roster } from "../builder/roster"

export type Received = AgentEvent & { at: number }

// The live part of GET /state (see vault/Contracts.md).
export type LiveAgent = {
  agentId: string; agentType: string; parentId?: string; state: AgentState; done: boolean; since: number; task?: string; status?: string; report?: string
}
export type Live = {
  sessionId: string; startedAt: number; lastEventAt: number; phase: "connected" | "mission" | "done"
  mission: { prompt: string; startedAt: number; endedAt: number | null } | null
  agents: LiveAgent[]
}
export type ServerState = { squad: Squad | null; scene: string | null; connected?: boolean; hooksSinceDeploy?: boolean; live?: Live | null }

// An arena opened mid-session is seeded from the /state snapshot, merged with whatever /ws already delivered.
export type Seed = { kind: "seed"; live: Live; at: number }
export type Action = Received | Seed

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
  // A bubble that changes text in place: each line shows for its ms, starting at sayAt. Replaces say while it runs.
  sayLines?: [string, number][]
  report?: string
  doneText?: string
  waitText?: string
  files: string[]
  changed: string[]
  tools: number
  firstAt: number
  // The latest spawn: the first one, or the time a finished subagent was resumed (SendMessage) and came back.
  spawnAt: number
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

const freshAgent = (id: string, type: string, at: number, order: number): Agent => ({
  id, type, state: "idle", narrationAt: 0, sayAt: 0, files: [], changed: [], tools: 0, firstAt: at, spawnAt: at, lastAt: at, pulseAt: 0, fixedAt: 0, doneAt: 0, order,
})

// "Fix the header toggle and…": at most n characters, cut on a word.
export function trimText(text: string, n = 80) {
  const t = text.replace(/\s+/g, " ").trim()
  if (t.length <= n) return t
  return t.slice(0, n - 1).replace(/\s+\S*$/, "").replace(/[…\s]+$/, "") + "…"
}

function seed(prev: Arena, { live, at }: Seed): Arena {
  if (prev.sessionId && prev.sessionId !== live.sessionId && Object.keys(prev.agents).length) return prev
  const m = live.mission
  const s: Arena = { ...prev, sessionId: live.sessionId, agents: { ...prev.agents }, startAt: prev.startAt || live.startedAt, lastAt: Math.max(prev.lastAt, live.lastEventAt) }
  if (m && (!s.promptAt || s.promptAt > m.startedAt)) {
    s.promptAt = m.startedAt
    if (m.prompt) s.prompt = s.prompt || m.prompt
  }
  for (const g of live.agents) {
    const old = s.agents[g.agentId]
    const a: Agent = old ? { ...old } : freshAgent(g.agentId, g.agentType, g.since, Object.keys(s.agents).length)
    if (!old) {
      a.state = g.done ? "done" : g.state
      a.lastAt = live.lastEventAt
      if (g.done) a.doneAt = Math.max(g.since, m?.endedAt ?? live.lastEventAt)
      if (g.agentType !== "lead") s.spawns++
    }
    // Agents first seen on /ws after the tab opened keep their state, but get the spawn time and task from before.
    if (g.since < a.spawnAt - 1000) {
      a.firstAt = Math.min(a.firstAt, g.since)
      a.spawnAt = g.since
    }
    a.task = a.task || g.task
    if (g.status && !a.narration) {
      a.narration = g.status
      a.narrationAt = at
    }
    if (g.report && !a.report) a.report = g.report
    s.agents[g.agentId] = a
  }
  return s
}

export function reduce(prev: Arena, act: Action): Arena {
  if (act.kind === "seed") return seed(prev, act)
  const e = act
  if (prev.seen.includes(e.id)) return prev
  // Another session can only take over once this one is finished or has gone quiet for a minute.
  if (prev.sessionId && e.sessionId !== prev.sessionId) {
    if (!finishedAt(prev) && e.at - prev.lastAt < 60000) return prev
    prev = emptyArena()
  }
  const seen = [...prev.seen.slice(-299), e.id]
  // Claude Code delivers background-agent completions as a prompt. That is not a new mission: nothing resets, but the
  // lead picks the turn back up (it keeps working until the next Stop).
  if (e.kind === "prompt" && e.text?.trimStart().startsWith("<task-notification>")) {
    const lead = prev.agents.lead
    if (!lead?.doneAt) return { ...prev, seen, lastAt: e.at }
    return { ...prev, seen, lastAt: e.at, endAt: 0, agents: { ...prev.agents, lead: { ...lead, doneAt: 0, doneText: undefined, state: "thinking", lastAt: e.at } } }
  }
  // A late narration for an agent that is done or was never seen would bring back a ghost that never finishes.
  // REPORT lines for finished agents are still recorded.
  const known = prev.agents[e.agentId]
  if (e.kind === "narration" && (!known || (known.doneAt && !e.text?.startsWith("REPORT:")))) return { ...prev, seen }
  if (e.kind === "session_start") prev = { ...emptyArena(), sessionId: e.sessionId, startAt: e.at }
  // A new prompt starts a fresh mission once the last one is over; specialists still working are kept, never wiped.
  const working = Object.values(prev.agents).some((g) => g.type !== "lead" && !g.doneAt)
  if (e.kind === "prompt" && (prev.endAt || prev.agents.lead?.doneAt)) {
    if (!working) prev = { ...emptyArena(), sessionId: e.sessionId, startAt: e.at }
    else {
      const lead = prev.agents.lead
      prev = { ...prev, endAt: 0, agents: lead ? { ...prev.agents, lead: { ...lead, doneAt: 0, doneText: undefined, state: "thinking" } } : prev.agents }
    }
  }
  const s: Arena = { ...prev, agents: { ...prev.agents }, lastAt: e.at, seen }
  if (!s.startAt) s.startAt = e.at
  if (!s.sessionId) s.sessionId = e.sessionId

  const old = s.agents[e.agentId]
  const a: Agent = old ? { ...old } : freshAgent(e.agentId, e.agentType, e.at, Object.keys(s.agents).length)
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

  // A prompt replayed to a tab that joined mid-mission keeps its own time, so the timer and briefing line up.
  const late = e.ts > 0 && e.ts < e.at && e.at - e.ts < 6 * 3600_000 ? e.at - e.ts : 0
  if (e.kind === "session_start") {
    a.say = "!"
    a.sayAt = e.at
    a.sayLines = [["!", 1200]]
  }
  if (e.kind === "prompt") {
    s.prompt = e.text
    s.promptAt = e.at - late
    if (a.state === "waiting") {
      a.state = "thinking"
      a.waitText = undefined
      a.narration = undefined
    }
    focus()
    // The lead faces the camera: "Got it.", then the task, then it starts thinking.
    if (late < 4000 && e.text) {
      a.say = "Got it."
      a.sayAt = e.at
      a.sayLines = [["Got it.", 1200], [trimText(e.text), 3000]]
    }
  }
  if (e.kind === "spawn") {
    s.spawns = (s.spawns ?? 0) + 1
    // A finished subagent resumed with SendMessage spawns again under the same id: it comes back as a new delegation.
    if (old?.doneAt) {
      a.spawnAt = e.at
      a.report = undefined
      a.narration = undefined
      a.waitText = undefined
    }
    a.doneAt = 0
    a.sayLines = undefined
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
    a.sayLines = undefined
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
      a.sayLines = undefined
      a.waitText = e.kind !== "narration" && e.text ? e.text : undefined
      toast("Waiting for you: approve in your terminal", "wait")
      focus()
    }
    // Leaving "waiting" (approved, timed out, or a new prompt): drop the needs-you text with it.
    if (a.state === "waiting" && e.state !== "waiting") {
      a.waitText = undefined
      a.narration = undefined
      if (a.sayLines === undefined && a.say === "Needs your OK.") a.say = undefined
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
  const t = Math.floor(Math.max(0, ms) / 1000)
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
