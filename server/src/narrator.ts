import path from "node:path"
import type { AgentEvent } from "@agentsquad/shared"
import type { Out } from "./hook"
import { loadState } from "./deploy"

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent"
const TIMEOUT_MS = 2500
const SLOW_TIMEOUT_MS = 6000
const REPORT_TIMEOUT_MS = 3000
const DONE_WAIT_MS = 2000
const TICK_MS = 1000
const SETTLE_MS = 1500
const GAP_MS = 5000
const BATCH_GAP_MS = 4000
const WINDOW = 8
const CALLS_PER_MIN = 14
const COOL_MS = 15_000
const IDLE_MS = 30 * 60_000
const FILE_TOOLS = new Set(["Read", "Edit", "Write", "NotebookEdit", "MultiEdit"])
const EDIT_TOOLS = new Set(["Edit", "Write", "NotebookEdit", "MultiEdit"])
const WAITING = "Waiting for your approval"
const STOP = new Set(["the", "a", "an", "of", "to", "for", "on", "in", "and", "with", "its", "some"])

type Act = { tool: string; target?: string; result?: "ok" | "failed"; note?: string }
type Agent = {
  sessionId: string
  agentId: string
  agentType: string
  role: string
  task?: string
  acts: Act[]
  status?: string
  emittedAt: number
  dirtyAt?: number
  urgent?: "error"
  sig?: string
  closed: boolean
  seq: number
  seenAt: number
}

const name = (t: string) => path.basename(t)

function count(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}

const unescape = (t: string) => t.replace(/\\(.)/g, "$1")
const command = (t: string) => t.split(" ").filter((w, i) => i === 0 || !/[\/…\-"'$|&]/.test(w)).slice(0, 2).map(name).join(" ")

export function template(events: AgentEvent[]) {
  events = events.map((e) => (e.target && (e.tool === "Grep" || e.tool === "Glob") ? { ...e, target: unescape(e.target) } : e))
  const last = events[events.length - 1]
  const failure = [...events].reverse().find((e) => e.state === "error")
  if (failure?.tool === "Bash") return failure.target ? `Hit a failing ${command(failure.target)} run` : "Hit a failing command"
  if (failure) return `Hit an error${failure.target ? ` on ${name(failure.target)}` : ""}`
  if (last.tool === "Agent") return "Handing work to the team"
  const same = events.filter((e) => e.state === last.state)
  const targets = [...new Set(same.map((e) => e.target).filter((t): t is string => !!t))]
  const one = targets.length === 1 ? name(targets[0]) : undefined
  switch (last.state) {
    case "reading": return one ? `Reading ${one}` : `Reading ${count(targets.length, "file")}`
    case "writing": return one ? `Editing ${one}` : `Editing ${count(targets.length, "file")}`
    case "running": return last.target ? `Running ${command(last.target)}` : "Running a command"
    case "searching": return one ? `Searching for ${one}` : `Searching the code`
    default: return `Using ${last.tool ?? "a tool"}`
  }
}

function templateFromActs(acts: Act[]) {
  const last = acts[acts.length - 1]
  const recent = last.result === "failed" ? acts : acts.filter((a) => a.result !== "failed")
  if (!recent.length) return "Getting started"
  if (last.result === "ok" && last.tool === "Bash") return last.target ? `Checking the ${command(last.target)} results` : "Checking the results"
  return template(recent.map((a) => ({
    id: "", ts: 0, sessionId: "", agentId: "", agentType: "", kind: "tool_start" as const,
    tool: a.tool, target: a.target,
    state: a.result === "failed" ? "error" as const
      : a.tool === "Read" ? "reading" as const
      : EDIT_TOOLS.has(a.tool) ? "writing" as const
      : a.tool === "Bash" ? "running" as const
      : "searching" as const,
  })))
}

const cache = new Map<string, string>()
const stats = { calls: 0, cached: 0, fallbacks: 0, timeouts: 0, limited: 0, ms: [] as number[] }

function statsLine() {
  const ms = [...stats.ms].sort((a, b) => a - b)
  const pct = (p: number) => (ms.length ? ms[Math.min(ms.length - 1, Math.floor(ms.length * p))] : 0)
  return `narrator: ${stats.calls} calls, ${stats.cached} cached, ${stats.fallbacks} fallbacks (${stats.timeouts} timeouts, ${stats.limited} rate-limited), p50 ${pct(0.5)}ms p95 ${pct(0.95)}ms`
}

const STATUS_PROMPT = [
  "You write live status lines for AI coding agents on a team, shown to a person watching the team work.",
  "For each agent, say in plain everyday words what it is doing right now, in terms of the work, not the tools.",
  "Rules: present progressive (start with a verb ending in -ing), at most 7 words, no file paths or file extensions unless the file is the whole point, no quotes, no emojis, no ending punctuation.",
  "Good: Working on the header toggle. Writing tests for dark mode. Fixing a failing test. Reviewing the theme changes. Looking for where the header lives.",
  "If an agent's current status still describes its activity well, use exactly SAME for it.",
  "An agent marked JUST FAILED gets a line about the failure, like Hit a failing test.",
  "Reply with a JSON object mapping each agent id to its line.",
].join(" ")

const REPORT_PROMPT = [
  "You summarize what each AI coding agent on a team got done this turn, for a person watching the team.",
  "For every agent, write one plain sentence of at most 12 words that starts with a past-tense verb (never with The agent or I), about the work not the tools, no file paths, no emojis.",
  "Reply with a JSON object mapping each agent id to its sentence.",
].join(" ")

// The free tier allows 15 requests a minute, shared by every server using the key: status batches stop at 10, urgent lines at 13, REPORTs at 15.
const recentCalls: number[] = []
let coolUntil = 0

function hasBudget(reserve = 0) {
  while (recentCalls.length && Date.now() - recentCalls[0] > 60_000) recentCalls.shift()
  return Date.now() >= coolUntil && recentCalls.length < CALLS_PER_MIN - reserve
}

async function gemini(system: string, prompt: string, maxTokens: number, timeout: number, reserve: number) {
  const key = process.env.GEMINI_API_KEY
  if (!key) return undefined
  const input = `${system}\n${prompt}`
  const hit = cache.get(input)
  if (hit) {
    stats.cached++
    return hit
  }
  if (!hasBudget(reserve)) return undefined
  const start = Date.now()
  recentCalls.push(start)
  stats.calls++
  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: maxTokens,
          thinkingConfig: { thinkingLevel: "minimal" },
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(timeout),
    })
    stats.ms.push(Date.now() - start)
    if (stats.ms.length > 500) stats.ms.shift()
    if (res.status === 429) {
      const retry = Number(res.headers.get("retry-after"))
      coolUntil = Date.now() + (retry > 0 ? retry * 1000 : COOL_MS)
      stats.limited++
    }
    if (!res.ok) return undefined
    const body: any = await res.json()
    const parts: any[] = body?.candidates?.[0]?.content?.parts ?? []
    const text = parts.filter((p) => !p.thought && typeof p.text === "string").map((p) => p.text).join("").trim()
    if (!text) return undefined
    if (cache.size > 1000) cache.clear()
    cache.set(input, text)
    return text
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") stats.timeouts++
    return undefined
  }
}

async function geminiJson(system: string, prompt: string, maxTokens: number, timeout: number, reserve = 1): Promise<Record<string, unknown> | undefined> {
  if (!process.env.GEMINI_API_KEY) return undefined
  const reply = await gemini(system, prompt, maxTokens, timeout, reserve)
  try {
    const parsed = reply ? JSON.parse(reply) : undefined
    if (parsed && typeof parsed === "object") return parsed
  } catch {}
  stats.fallbacks++
  return undefined
}

const isSame = (t: unknown) => typeof t === "string" && t.replace(/[^a-z]/gi, "").toUpperCase() === "SAME"


function clean(text: unknown, maxWords: number) {
  if (typeof text !== "string" || isSame(text)) return undefined
  const line = text.split("\n").map((l) => l.trim()).find(Boolean) ?? ""
  const words = line
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/^["'`*\-\s]+|["'`*\s]+$/g, "")
    .replace(/[.!?;:,]+$/, "")
    .split(/\s+/)
    .filter(Boolean)
  if (!words.length || words.length > maxWords + 2) return undefined
  return words.join(" ")
}

const gist = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w)).join(" ")

function describe(a: Act) {
  const what = `${a.tool}${a.target ? ` ${a.target}` : ""}`
  if (a.result === "failed") return `${what} -> failed${a.note ? `: ${a.note}` : ""}`
  if (a.result === "ok" && a.tool === "Bash") return `${what} -> succeeded`
  return what
}

function roleOf(agentType: string) {
  if (agentType === "lead") return "team lead who plans the work and delegates to specialists"
  const member = loadState().squad?.members.find((m) => m.id === agentType)
  return member ? `${member.name}, ${member.role}` : agentType
}

export function createNarrator(emit: (e: Out) => void) {
  const agents = new Map<string, Agent>()
  const logs = new Map<string, AgentEvent[]>()
  let inFlight = false
  let urgentRun: Promise<void> | undefined
  let batchAt = 0

  const say = (a: Agent, text: string) => {
    if (a.status && gist(a.status) === gist(text)) return
    a.status = text
    a.emittedAt = Date.now()
    emit({ sessionId: a.sessionId, agentId: a.agentId, agentType: a.agentType, kind: "narration", text })
  }

  const agentFor = (e: AgentEvent) => {
    const key = `${e.sessionId}|${e.agentId}`
    let a = agents.get(key)
    if (!a) {
      a = { sessionId: e.sessionId, agentId: e.agentId, agentType: e.agentType, role: roleOf(e.agentType), acts: [], emittedAt: 0, seenAt: Date.now(), closed: false, seq: 0 }
      agents.set(key, a)
    }
    a.seenAt = Date.now()
    return a
  }

  const brief = (a: Agent, id: string) => [
    `Agent ${id}${a.urgent === "error" ? " (JUST FAILED)" : ""}`,
    `Role: ${a.role}`,
    a.task ? `Task: ${a.task}` : "",
    `Current status: ${a.status ?? "(none yet)"}`,
    a.acts.length ? `Recent activity, oldest first:\n${a.acts.map((x) => `- ${describe(x)}`).join("\n")}` : "",
  ].filter(Boolean).join("\n")

  // One Gemini call covers every agent in the batch, across sessions, keyed by per-batch ids (a1, a2, ...).
  const run = async (due: Agent[], fast: boolean) => {
    const batch = due
      .map((a) => ({ a, seq: a.seq, kind: a.urgent, sig: `${a.urgent ?? "status"}|${a.acts.map(describe).join("|")}` }))
      .filter((b) => b.sig !== b.a.sig)
      .map((b, i) => ({ ...b, id: `a${i + 1}`, brief: brief(b.a, `a${i + 1}`) }))
    for (const a of due) {
      a.dirtyAt = undefined
      a.urgent = undefined
    }
    if (!batch.length) return
    for (const b of batch) b.a.sig = b.sig
    const lines = await geminiJson(STATUS_PROMPT, batch.map((b) => b.brief).join("\n\n"), 24 * batch.length + 16, fast ? TIMEOUT_MS : SLOW_TIMEOUT_MS)
    for (const { a, seq, kind, id } of batch) {
      if (a.seq !== seq || a.closed) continue
      const raw = lines?.[id]
      if (lines && !kind && a.status && (raw === undefined || isSame(raw))) continue
      const fallback = a.acts.length ? templateFromActs(a.acts) : "Getting started"
      say(a, clean(raw, 7) ?? fallback)
    }
  }

  const runUrgent = () => {
    if (urgentRun) return urgentRun
    const due = [...agents.values()].filter((a) => a.urgent)
    if (!due.length) return Promise.resolve()
    urgentRun = run(due, true).finally(() => {
      urgentRun = undefined
      void runUrgent()
    })
    return urgentRun
  }

  const tick = async () => {
    const now = Date.now()
    for (const [key, a] of agents) {
      if (now - a.seenAt < IDLE_MS) continue
      agents.delete(key)
      logs.delete(a.sessionId)
    }
    void runUrgent()
    if (inFlight) return
    const due = [...agents.values()].filter((a) =>
      !a.urgent && !a.closed && a.dirtyAt !== undefined && now - a.dirtyAt >= SETTLE_MS && now - a.emittedAt >= GAP_MS)
    if (!due.length) return
    if (process.env.GEMINI_API_KEY && (now - batchAt < BATCH_GAP_MS || !hasBudget(4))) return
    inFlight = true
    batchAt = now
    await run(due, due.some((a) => !a.status))
    inFlight = false
  }
  setInterval(() => void tick(), TICK_MS).unref()

  const flag = (a: Agent, kind: "error") => {
    a.urgent = kind
    a.seq++
    void runUrgent()
  }

  const push = (a: Agent, act: Act) => {
    a.acts.push(act)
    if (a.acts.length > WINDOW) a.acts.shift()
    a.dirtyAt ??= Date.now()
  }

  const feed = (e: AgentEvent) => {
    if (e.kind === "narration") return
    if (e.kind === "session_end") {
      logs.delete(e.sessionId)
      for (const [key, a] of agents) if (a.sessionId === e.sessionId) agents.delete(key)
      return
    }
    const log = logs.get(e.sessionId) ?? []
    log.push(e)
    logs.set(e.sessionId, log)

    const a = agentFor(e)
    if (e.kind === "prompt" && e.agentId === "lead") {
      a.task = e.text
      a.acts = []
      a.sig = undefined
      a.status = undefined
    }
    if (e.kind === "spawn") {
      a.task = e.text
      if (e.parentId) push(agentFor({ ...e, agentId: e.parentId, agentType: "lead" }), { tool: "Agent", target: `${e.agentType}: ${e.text ?? ""}` })
      return
    }
    if (e.kind === "agent_done") {
      a.closed = true
      a.urgent = undefined
      a.dirtyAt = undefined
      a.seq++
      return
    }
    if (a.closed && e.kind !== "tool_start") return
    a.closed = false
    if (e.state === "waiting") {
      a.sig = "waiting"
      a.dirtyAt = undefined
      a.seq++
      say(a, WAITING)
      return
    }
    if (a.status === WAITING) a.status = undefined
    if (e.kind === "tool_start" && e.tool) push(a, { tool: e.tool, target: e.target })
    if (e.kind === "tool_end" && e.tool) {
      const open = [...a.acts].reverse().find((x) => !x.result && x.tool === e.tool && x.target === e.target)
      const result = e.state === "error" ? "failed" as const : "ok" as const
      if (open) Object.assign(open, { result, note: e.text })
      else push(a, { tool: e.tool, target: e.target, result, note: e.text })
      if (result === "failed") flag(a, "error")
      else if (e.tool === "Bash") a.dirtyAt ??= Date.now()
    }
  }

  const reports = async (sessionId: string) => {
    const log = logs.get(sessionId) ?? []
    logs.delete(sessionId)
    const worked = log.some((e) => e.kind === "prompt" || (e.kind === "tool_start" && e.tool) || e.kind === "spawn")
    const pending = runUrgent()
    if (worked) await Promise.race([pending, new Promise((r) => setTimeout(r, DONE_WAIT_MS).unref())])
    for (const [key, a] of agents) if (a.sessionId === sessionId && a.agentId !== "lead" && a.closed && !a.urgent) agents.delete(key)
    if (!worked) return
    const byAgent = new Map<string, AgentEvent[]>()
    for (const e of log) byAgent.set(e.agentId, [...(byAgent.get(e.agentId) ?? []), e])
    const facts = [...byAgent].map(([agentId, events]) => {
      const tools = events.filter((e) => e.kind === "tool_start" && e.tool)
      const files = new Set(tools.filter((e) => FILE_TOOLS.has(e.tool!) && e.target).map((e) => e.target))
      const edited = [...new Set(tools.filter((e) => EDIT_TOOLS.has(e.tool!) && e.target).map((e) => name(e.target!)))]
      const commands = tools.filter((e) => e.tool === "Bash").length
      const failures = events.filter((e) => e.state === "error").length
      const spawns = log.filter((e) => e.kind === "spawn" && e.parentId === agentId)
      const end = [...events].reverse().find((e) => e.kind === "agent_done") ?? events[events.length - 1]
      const seconds = Math.max(1, Math.round((end.ts - events[0].ts) / 1000))
      let first =
        edited.length ? `Edited ${count(edited.length, "file")}: ${edited.slice(0, 3).join(", ")}${edited.length > 3 ? "…" : ""}.`
        : commands ? `Ran ${count(commands, "command")}.`
        : files.size ? `Read ${count(files.size, "file")}.`
        : "Kept the plan moving."
      if (spawns.length) first = `Handed work to ${count(spawns.length, "specialist")}. ${first}`
      if (failures) first += ` Hit ${count(failures, "error")} along the way.`
      const second = `${count(tools.length, "tool call")}, ${count(files.size, "file")} touched, ${seconds}s active.`
      const agentType = events[0].agentType
      const task = agentId === "lead" ? events.find((e) => e.kind === "prompt")?.text : events.find((e) => e.kind === "spawn")?.text
      const lastFail = [...events].reverse().find((e) => e.state === "error")
      const recovered = lastFail ? events.slice(events.indexOf(lastFail) + 1).some((e) => e.kind === "tool_end" && e.state !== "error") : false
      const said = events.find((e) => e.kind === "agent_done" && e.text)?.text
      const brief = [
        `Agent ${agentId}`,
        `Role: ${roleOf(agentType)}`,
        task ? `Task: ${task}` : "",
        `Facts: ${first}${failures ? recovered ? " Recovered afterwards." : " Did not recover." : ""}`,
        spawns.length ? `Delegated: ${spawns.map((s) => `${s.agentType} (${s.text ?? ""})`).join("; ")}` : "",
        said ? `Its last message: ${said}` : "",
      ].filter(Boolean).join("\n")
      return { agentId, agentType, first, second, brief }
    })
    if (!facts.length) return
    const summaries = await geminiJson(REPORT_PROMPT, facts.map((f) => f.brief).join("\n\n"), 60 * facts.length, REPORT_TIMEOUT_MS, -1)
    for (const f of facts) {
      const summary = clean(summaries?.[f.agentId], 12) ?? f.first.replace(/\.$/, "")
      emit({ sessionId, agentId: f.agentId, agentType: f.agentType, kind: "narration", text: `REPORT: ${summary}.\n${f.second}` })
    }
    if (process.env.GEMINI_API_KEY) console.log(statsLine())
  }

  return { feed, reports }
}

export function narratorMode() {
  return process.env.GEMINI_API_KEY ? "narrator: Gemini on" : "narrator: no GEMINI_API_KEY, using template lines"
}
