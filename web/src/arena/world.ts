import { createContext } from "react"
import type { MotionValue } from "framer-motion"
import type { Squad } from "@agentsquad/shared"
import { roster } from "../builder/roster"
import { who, type Agent, type Arena } from "./store"

// Where each character is right now, so the camera, chips and bubbles can find it. Keyed `${scene}:${agentId}`.
export type Pos = { x: MotionValue<number>; y: MotionValue<number>; o?: MotionValue<number>; dy?: MotionValue<number>; s: number }
export const positions = new Map<string, Pos>()

// The scene a character is drawn in (the map, a room, or an open interior).
export const Scope = createContext("")

const base = (path?: string) => path?.split("/").pop() ?? ""

export function roleOf(type: string, squad: Squad | null) {
  const w = who(type, squad)
  return w.lead ? "Lead" : w.name.replace(/ Agent$/, "")
}

// "Frontend", or "Frontend 2" for the second agent of a type.
export function labelOf(a: Agent, arena: Arena, squad: Squad | null) {
  const same = Object.values(arena.agents).filter((g) => g.type === a.type).sort((p, q) => p.order - q.order)
  const n = same.indexOf(a) + 1
  return n > 1 ? `${roleOf(a.type, squad)} ${n}` : roleOf(a.type, squad)
}

// "Frontend Agent", or "Frontend Agent 2"; the lead's own name.
export function nameOf(a: Agent, arena: Arena, squad: Squad | null) {
  const w = who(a.type, squad)
  if (w.lead) return w.name
  const same = Object.values(arena.agents).filter((g) => g.type === a.type).sort((p, q) => p.order - q.order)
  const n = same.indexOf(a) + 1
  return n > 1 ? `${w.name} ${n}` : w.name
}

// A short status from the agent's state when it hasn't narrated yet.
export function stateLine(a: Agent) {
  if (a.doneAt) return a.doneText || "Done"
  if (a.state === "waiting") return "Needs your OK"
  if (a.state === "error") return "Hit an error"
  if (a.state === "reading") return a.target ? `Reading ${base(a.target)}` : "Reading"
  if (a.state === "writing") return a.target ? `Editing ${base(a.target)}` : "Writing code"
  if (a.state === "running") return "Running a command"
  if (a.state === "searching") return "Searching the code"
  if (a.state === "thinking") return a.task ? a.task : "Thinking"
  return "Ready"
}

export function statusLine(a: Agent) {
  if (a.doneAt) return a.doneText || "Done"
  if (a.state === "waiting" || a.state === "error") return a.waitText || stateLine(a)
  return a.narration || stateLine(a)
}

const TAIL = new Set(["a", "an", "the", "to", "for", "and", "of", "on", "in", "with", "that", "is", "its", "from", "by", "at", "are", "is", "was", "were", "be", "has", "have", "will", "can", "where", "who", "which"])

// A narration line cut to a nameplate verb: first clause, up to five words, no dangling little words.
export function shorten(text: string) {
  const clause = text.split(/[.:;,!?(]| - | — /)[0].trim()
  let words = clause.split(/\s+/).filter(Boolean)
  while (words.length > 5 || (words.length > 2 && words.join(" ").length > 26)) words = words.slice(0, -1)
  while (words.length > 1 && TAIL.has(words[words.length - 1].toLowerCase())) words = words.slice(0, -1)
  const s = words.join(" ")
  return /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s
}

const STATE_VERB: Record<string, string> = {
  reading: "reading", writing: "editing", running: "running a command", searching: "searching", thinking: "thinking", idle: "on call",
}

// The nameplate verb: urgent states first, then the latest narration if it's newer than the last tool, else the tool verb.
export function verbOf(a: Agent) {
  if (a.doneAt) return "done"
  if (a.state === "waiting") return "needs you"
  if (a.state === "error") return "hit an error"
  if (a.state === "running" && /\btest/.test(a.target ?? "")) return "running tests"
  if (a.narration && a.narrationAt >= a.pulseAt - 1500) return shorten(a.narration)
  if (a.state === "writing" && a.target) return `editing ${base(a.target)}`
  if (a.state === "reading" && a.target) return `reading ${base(a.target)}`
  return STATE_VERB[a.state] ?? a.state
}

// Lead first, then the squad (or whole roster) in roster order, then any other type that shows up. One entry per agent instance;
// a type nobody has spawned yet gets one "on call" entry.
export function teamOf(arena: Arena, squad: Squad | null) {
  const order = (t: string) => {
    const i = roster.findIndex((r) => r.id === t)
    return i < 0 ? 99 : i
  }
  const agents = Object.values(arena.agents).sort((a, b) => a.order - b.order)
  const squadTypes = (squad?.members.map((m) => m.id) ?? roster.map((r) => r.id)).sort((a, b) => order(a) - order(b))
  const types = [...new Set(["lead", ...squadTypes, ...agents.map((a) => a.type)])]
  return types.flatMap((t) => {
    const mine = agents.filter((a) => a.type === t)
    return mine.length ? mine.map((a) => ({ key: a.id, type: t, agent: a as Agent | undefined })) : [{ key: t, type: t, agent: undefined }]
  })
}
