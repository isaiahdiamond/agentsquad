import path from "node:path"
import type { AgentEvent, AgentState } from "@agentsquad/shared"

export type Out = Omit<AgentEvent, "id" | "ts">

type Agent = { id: string; type: string; state?: AgentState; timer?: NodeJS.Timeout }
type Session = {
  cwd: string
  agents: Map<string, Agent>
  rawIds: Map<string, string>
  counts: Map<string, number>
  spawnText: Map<string, string[]>
  turnDone: boolean
  pending: Promise<void>
  seenAt: number
}

const STATE: Record<string, AgentState> = {
  Read: "reading",
  Glob: "searching", Grep: "searching", WebFetch: "searching", WebSearch: "searching",
  Edit: "writing", Write: "writing", NotebookEdit: "writing", MultiEdit: "writing",
  Bash: "running",
}
const DELEGATE = new Set(["Agent", "Task"])
const THINK_MS = 2000
const IDLE_MS = 30 * 60_000
const END_WAIT_MS = 5500

const sessions = new Map<string, Session>()

export function cut(s: string, n = 60) {
  const one = s.replace(/\s+/g, " ").trim()
  return one.length > n ? one.slice(0, n - 1) + "…" : one
}

function targetOf(input: any, cwd: string): string | undefined {
  if (!input || typeof input !== "object") return undefined
  const file = input.file_path ?? input.notebook_path
  if (typeof file === "string") {
    const rel = path.relative(cwd, file)
    const p = rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel : file
    return p.length > 60 ? "…" + p.slice(-59) : p
  }
  const other = input.command ?? input.pattern ?? input.url ?? input.query ?? input.path
  return typeof other === "string" ? cut(other) : undefined
}

function firstLine(s: unknown, n = 120) {
  if (typeof s !== "string") return undefined
  const line = s.split("\n").map((l) => l.replace(/[*#`_]/g, "").trim()).find(Boolean)
  return line ? cut(line, n) : undefined
}

function failed(response: any) {
  if (!response || typeof response !== "object") return false
  if (response.is_error === true || response.interrupted === true) return true
  const code = response.exit_code ?? response.exitCode ?? response.returnCode
  return typeof code === "number" && code !== 0
}

export function handleHook(raw: any, emit: (e: Out) => void, reports: (sessionId: string) => Promise<void>) {
  if (!raw || typeof raw !== "object" || typeof raw.session_id !== "string") return
  const sessionId: string = raw.session_id
  const now = Date.now()
  for (const [id, old] of sessions) {
    if (now - old.seenAt < IDLE_MS) continue
    for (const a of old.agents.values()) clearTimeout(a.timer)
    sessions.delete(id)
  }
  let s = sessions.get(sessionId)
  if (!s) {
    s = { cwd: raw.cwd ?? process.cwd(), agents: new Map(), rawIds: new Map(), counts: new Map(), spawnText: new Map(), turnDone: false, pending: Promise.resolve(), seenAt: now }
    sessions.set(sessionId, s)
  }
  const session = s
  session.seenAt = now

  const send = (agent: Agent, e: Omit<Out, "sessionId" | "agentId" | "agentType">) => {
    if (e.state) agent.state = e.state
    emit({ sessionId, agentId: agent.id, agentType: agent.type, ...e })
  }

  const lead = () => {
    let a = session.agents.get("lead")
    if (!a) session.agents.set("lead", (a = { id: "lead", type: "lead" }))
    return a
  }

  const think = (agent: Agent) => {
    clearTimeout(agent.timer)
    agent.timer = setTimeout(() => {
      if (session.turnDone) return
      if (agent.state === "waiting" || agent.state === "error" || agent.state === "done") return
      send(agent, { kind: "tool_start", state: "thinking" })
    }, THINK_MS)
  }

  const spawn = (rawId: string, type: string) => {
    const n = (session.counts.get(type) ?? 0) + 1
    session.counts.set(type, n)
    const agent: Agent = { id: `${type}-${n}`, type }
    session.rawIds.set(rawId, agent.id)
    session.agents.set(agent.id, agent)
    const text = session.spawnText.get(type)?.shift()
    send(agent, { kind: "spawn", tool: "Agent", parentId: "lead", text })
    think(agent)
    return agent
  }

  const actor = () => {
    if (typeof raw.agent_id !== "string") return lead()
    const id = session.rawIds.get(raw.agent_id)
    const known = id ? session.agents.get(id) : undefined
    return known ?? spawn(raw.agent_id, raw.agent_type ?? "subagent")
  }

  const endTurn = () => {
    if (session.turnDone) return
    session.turnDone = true
    for (const a of session.agents.values()) clearTimeout(a.timer)
    send(lead(), { kind: "agent_done", state: "done" })
    session.pending = reports(sessionId)
  }

  const tool: string | undefined = raw.tool_name
  const target = targetOf(raw.tool_input, session.cwd)

  switch (raw.hook_event_name) {
    case "SessionStart": {
      send(lead(), { kind: "session_start", state: "idle" })
      break
    }
    case "UserPromptSubmit": {
      session.turnDone = false
      const l = lead()
      send(l, { kind: "prompt", text: typeof raw.prompt === "string" ? cut(raw.prompt, 300) : undefined })
      send(l, { kind: "tool_start", state: "thinking" })
      break
    }
    case "PreToolUse": {
      if (!tool) break
      const agent = actor()
      clearTimeout(agent.timer)
      if (DELEGATE.has(tool)) {
        const type = raw.tool_input?.subagent_type ?? "general-purpose"
        const text = cut(raw.tool_input?.description ?? raw.tool_input?.prompt ?? "", 120)
        session.spawnText.set(type, [...(session.spawnText.get(type) ?? []), text])
        break
      }
      send(agent, { kind: "tool_start", state: STATE[tool] ?? "thinking", tool, target })
      break
    }
    case "PostToolUse":
    case "PostToolUseFailure": {
      if (!tool) break
      const agent = actor()
      think(agent)
      if (DELEGATE.has(tool)) break
      const bad = raw.hook_event_name === "PostToolUseFailure" ? raw.is_interrupt !== true : failed(raw.tool_response)
      if (bad) send(agent, { kind: "tool_end", tool, target, state: "error", text: firstLine(raw.error) })
      else if (agent.state === "waiting") send(agent, { kind: "tool_end", tool, target, state: "thinking" })
      else send(agent, { kind: "tool_end", tool, target })
      break
    }
    case "SubagentStart": {
      if (typeof raw.agent_id === "string" && !session.rawIds.has(raw.agent_id)) spawn(raw.agent_id, raw.agent_type ?? "subagent")
      break
    }
    case "SubagentStop": {
      if (typeof raw.agent_id !== "string") break
      const agent = actor()
      clearTimeout(agent.timer)
      send(agent, { kind: "agent_done", state: "done", text: firstLine(raw.last_assistant_message) })
      think(lead())
      break
    }
    case "Notification": {
      if (session.turnDone) break
      const agent = actor()
      clearTimeout(agent.timer)
      send(agent, { kind: "tool_start", state: "waiting", text: firstLine(raw.message) })
      break
    }
    case "Stop": {
      endTurn()
      break
    }
    case "SessionEnd": {
      sessions.delete(sessionId)
      endTurn()
      const capped = new Promise<void>((r) => setTimeout(r, END_WAIT_MS).unref())
      void Promise.race([session.pending, capped]).then(() => send(lead(), { kind: "session_end", state: "idle" }))
      break
    }
  }
}
