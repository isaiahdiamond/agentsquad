import path from "node:path"
import type { AgentEvent } from "@agentsquad/shared"
import type { Out } from "./hook"

const BATCH_MS = 1500
const BATCH_MAX = 4
const MODEL = "claude-haiku-5-5"
const FILE_TOOLS = new Set(["Read", "Edit", "Write", "NotebookEdit", "MultiEdit"])
const EDIT_TOOLS = new Set(["Edit", "Write", "NotebookEdit", "MultiEdit"])

type Batch = { events: AgentEvent[]; timer: NodeJS.Timeout }

const name = (t: string) => path.basename(t)

function count(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}

export function template(events: AgentEvent[]) {
  const last = events[events.length - 1]
  const failure = [...events].reverse().find((e) => e.state === "error")
  if (failure?.tool === "Bash") return `${failure.target ?? "A command"} failed`
  if (failure) return `Hit an error${failure.target ? ` on ${name(failure.target)}` : ""}`
  const same = events.filter((e) => e.state === last.state)
  const targets = [...new Set(same.map((e) => e.target).filter((t): t is string => !!t))]
  const one = targets.length === 1 ? name(targets[0]) : undefined
  switch (last.state) {
    case "reading": return one ? `Reading ${one}` : `Reading ${count(targets.length, "file")}`
    case "writing": return one ? `Editing ${one}` : `Editing ${count(targets.length, "file")}`
    case "running": return `Running ${last.target ?? "a command"}`
    case "searching": return one ? `Searching for ${one}` : `Searching the code`
    default: return `Using ${last.tool ?? "a tool"}`
  }
}

const cache = new Map<string, string>()

async function modelLine(agentType: string, fallback: string, events: AgentEvent[]) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return fallback
  const actions = events.map((e) => `${e.tool}${e.target ? ` ${e.target}` : ""}${e.state === "error" ? " (failed)" : ""}`).join("; ")
  const input = `${agentType}|${actions}`
  const hit = cache.get(input)
  if (hit) return hit
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 40,
        messages: [{
          role: "user",
          content: `You narrate a coding agent whose role is "${agentType}". Its latest actions: ${actions}. Reply with one plain sentence under 12 words, present tense, first person, saying what it is doing. No quotes, no emoji.`,
        }],
      }),
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return fallback
    const body: any = await res.json()
    const text = typeof body?.content?.[0]?.text === "string" ? body.content[0].text.trim().split("\n")[0] : ""
    if (!text) return fallback
    cache.set(input, text)
    return text
  } catch {
    return fallback
  }
}

export function createNarrator(emit: (e: Out) => void) {
  const batches = new Map<string, Batch>()
  const logs = new Map<string, AgentEvent[]>()
  const closed = new Set<string>()

  const drop = (prefix: string) => {
    for (const [key, batch] of batches) {
      if (!key.startsWith(prefix)) continue
      clearTimeout(batch.timer)
      batches.delete(key)
    }
  }

  const flush = (key: string) => {
    const batch = batches.get(key)
    if (!batch) return
    clearTimeout(batch.timer)
    batches.delete(key)
    const { sessionId, agentId, agentType } = batch.events[0]
    const line = template(batch.events)
    modelLine(agentType, line, batch.events).then((text) => {
      if (!closed.has(key)) emit({ sessionId, agentId, agentType, kind: "narration", text })
    })
  }

  const feed = (e: AgentEvent) => {
    if (e.kind === "narration") return
    const key = `${e.sessionId}|${e.agentId}`
    if (e.kind === "session_end") {
      logs.delete(e.sessionId)
      drop(e.sessionId + "|")
      for (const k of closed) if (k.startsWith(e.sessionId + "|")) closed.delete(k)
      return
    }
    if (e.kind === "agent_done") {
      clearTimeout(batches.get(key)?.timer)
      batches.delete(key)
      closed.add(key)
    } else {
      closed.delete(key)
    }
    const log = logs.get(e.sessionId) ?? []
    log.push(e)
    logs.set(e.sessionId, log)
    const narrate = (e.kind === "tool_start" && e.tool) || (e.kind === "tool_end" && e.state === "error")
    if (!narrate) return
    let batch = batches.get(key)
    if (!batch) {
      batch = { events: [], timer: setTimeout(() => flush(key), BATCH_MS) }
      batches.set(key, batch)
    }
    batch.events.push(e)
    if (batch.events.length >= BATCH_MAX) flush(key)
  }

  const reports = (sessionId: string): Out[] => {
    drop(sessionId + "|")
    const log = logs.get(sessionId) ?? []
    logs.delete(sessionId)
    const agents = new Map<string, AgentEvent[]>()
    for (const e of log) agents.set(e.agentId, [...(agents.get(e.agentId) ?? []), e])
    const out: Out[] = []
    for (const [agentId, events] of agents) {
      const tools = events.filter((e) => e.kind === "tool_start" && e.tool)
      const files = new Set(tools.filter((e) => FILE_TOOLS.has(e.tool!) && e.target).map((e) => e.target))
      const edited = [...new Set(tools.filter((e) => EDIT_TOOLS.has(e.tool!) && e.target).map((e) => name(e.target!)))]
      const commands = tools.filter((e) => e.tool === "Bash").length
      const failures = events.filter((e) => e.state === "error").length
      const spawns = log.filter((e) => e.kind === "spawn" && e.parentId === agentId).length
      const end = [...events].reverse().find((e) => e.kind === "agent_done") ?? events[events.length - 1]
      const seconds = Math.max(1, Math.round((end.ts - events[0].ts) / 1000))
      let first =
        edited.length ? `Edited ${count(edited.length, "file")}: ${edited.slice(0, 3).join(", ")}${edited.length > 3 ? "…" : ""}.`
        : commands ? `Ran ${count(commands, "command")}.`
        : files.size ? `Read ${count(files.size, "file")}.`
        : "Kept the plan moving."
      if (spawns) first = `Handed work to ${count(spawns, "specialist")}. ${first}`
      if (failures) first += ` Hit ${count(failures, "error")} along the way.`
      const second = `${count(tools.length, "tool call")}, ${count(files.size, "file")} touched, ${seconds}s active.`
      out.push({ sessionId, agentId, agentType: events[0].agentType, kind: "narration", text: `REPORT: ${first}\n${second}` })
    }
    return out
  }

  return { feed, reports }
}
