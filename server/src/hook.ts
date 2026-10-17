import path from "node:path"
import type { AgentEvent, AgentState } from "@agentsquad/shared"

export type Out = Omit<AgentEvent, "id" | "ts">

type Agent = { id: string; type: string; state?: AgentState; timer?: NodeJS.Timeout; toolAt?: number }
type Session = {
  cwd: string
  agents: Map<string, Agent>
  rawIds: Map<string, string>
  counts: Map<string, number>
  spawnText: Map<string, { text: string; at: number }[]>
  resumeText: Map<string, { text: string; at: number }>
  turnDone: boolean
  stopped: boolean
  endTimer?: NodeJS.Timeout
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
const TEAM_END_MS = 8000
const STALL_MS = 5 * 60_000
const TOOL_STALL_MS: Record<string, number> = { Bash: 5 * 60_000 }
const SPAWN_WAIT_MS = 15_000
const WAIT_MS = 60_000
const RESUME_TEXT = "Picking up where it left off"
const NOT_A_PROMPT = /^\s*<(task-notification|agent-message)[\s>]/

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
    s = { cwd: raw.cwd ?? process.cwd(), agents: new Map(), rawIds: new Map(), counts: new Map(), spawnText: new Map(), resumeText: new Map(), turnDone: false, stopped: false, pending: Promise.resolve(), seenAt: now }
    sessions.set(sessionId, s)
  }
  const session = s
  session.seenAt = now
  clearTimeout(session.endTimer)

  const send = (agent: Agent, e: Omit<Out, "sessionId" | "agentId" | "agentType">) => {
    if (e.state) agent.state = e.state
    emit({ sessionId, agentId: agent.id, agentType: agent.type, ...e })
  }

  const lead = () => {
    let a = session.agents.get("lead")
    if (!a) session.agents.set("lead", (a = { id: "lead", type: "lead" }))
    return a
  }

  const think = (agent: Agent, ms = THINK_MS) => {
    clearTimeout(agent.timer)
    agent.timer = setTimeout(() => {
      if (session.turnDone) return
      if (agent.state === "waiting" || agent.state === "error" || agent.state === "done") return
      agent.toolAt = undefined
      send(agent, { kind: "tool_start", state: "thinking" })
    }, ms)
  }

  const spawn = (rawId: string, type: string) => {
    const n = (session.counts.get(type) ?? 0) + 1
    session.counts.set(type, n)
    const agent: Agent = { id: `${type}-${n}`, type }
    session.rawIds.set(rawId, agent.id)
    session.agents.set(agent.id, agent)
    const text = session.spawnText.get(type)?.shift()?.text
    send(agent, { kind: "spawn", tool: "Agent", parentId: "lead", text })
    think(agent)
    return agent
  }

  const resume = (agent: Agent, rawId: string) => {
    const key = [...session.resumeText.keys()].find((k) => k && (k === agent.type || rawId.startsWith(k)))
    const text = key ? session.resumeText.get(key)!.text : RESUME_TEXT
    if (key) session.resumeText.delete(key)
    clearTimeout(agent.timer)
    agent.state = undefined
    agent.toolAt = undefined
    send(agent, { kind: "spawn", tool: "Agent", parentId: "lead", text })
    think(agent)
  }

  const actor = () => {
    if (typeof raw.agent_id !== "string") return lead()
    const id = session.rawIds.get(raw.agent_id)
    const known = id ? session.agents.get(id) : undefined
    return known ?? spawn(raw.agent_id, raw.agent_type || "subagent")
  }

  const busy = () =>
    [...session.agents.values()].some((a) => a.id !== "lead" && a.state !== "done") ||
    [...session.spawnText.values()].some((q) => q.some((p) => Date.now() - p.at < SPAWN_WAIT_MS)) ||
    [...session.resumeText.values()].some((p) => Date.now() - p.at < SPAWN_WAIT_MS)

  const endTurn = () => {
    if (session.turnDone) return
    session.turnDone = true
    session.stopped = false
    for (const a of session.agents.values()) {
      clearTimeout(a.timer)
      a.toolAt = undefined
    }
    send(lead(), { kind: "agent_done", state: "done" })
    session.pending = reports(sessionId)
  }

  const tool: string | undefined = raw.tool_name
  const target = targetOf(raw.tool_input, session.cwd)
  const LATE = ["PreToolUse", "PostToolUse", "PostToolUseFailure", "SubagentStart", "Notification", "Stop"]
  if (session.turnDone && LATE.includes(raw.hook_event_name)) return

  switch (raw.hook_event_name) {
    case "SessionStart": {
      send(lead(), { kind: "session_start", state: "idle" })
      break
    }
    case "UserPromptSubmit": {
      const l = lead()
      if (typeof raw.prompt === "string" && NOT_A_PROMPT.test(raw.prompt)) {
        if (session.turnDone) break
        session.stopped = false
        send(l, { kind: "tool_start", state: "thinking" })
        break
      }
      session.turnDone = false
      session.stopped = false
      session.spawnText.clear()
      session.resumeText.clear()
      for (const a of session.agents.values()) {
        if (a.id === "lead" || a.state !== "waiting") continue
        clearTimeout(a.timer)
        a.toolAt = undefined
        send(a, { kind: "tool_start", state: "thinking" })
      }
      send(l, { kind: "prompt", text: cut(typeof raw.prompt === "string" ? raw.prompt : "", 80) })
      send(l, { kind: "tool_start", state: "thinking" })
      break
    }
    case "PreToolUse": {
      if (!tool) break
      const agent = actor()
      clearTimeout(agent.timer)
      if (DELEGATE.has(tool)) {
        const type = raw.tool_input?.subagent_type ?? "general-purpose"
        const text = firstLine(raw.tool_input?.description) ?? firstLine(raw.tool_input?.prompt) ?? ""
        session.spawnText.set(type, [...(session.spawnText.get(type) ?? []), { text, at: now }])
        break
      }
      if (tool === "SendMessage") {
        const to = raw.tool_input?.to
        const text = firstLine(raw.tool_input?.summary) ?? firstLine(raw.tool_input?.message) ?? RESUME_TEXT
        if (typeof to === "string") session.resumeText.set(to, { text, at: now })
        break
      }
      send(agent, { kind: "tool_start", state: STATE[tool] ?? "thinking", tool, target })
      agent.toolAt = now
      think(agent, TOOL_STALL_MS[tool] ?? 15_000)
      break
    }
    case "PostToolUse":
    case "PostToolUseFailure": {
      if (!tool) break
      const agent = actor()
      const stalled = !agent.toolAt
      agent.toolAt = undefined
      think(agent)
      if (DELEGATE.has(tool)) {
        const type = raw.tool_input?.subagent_type ?? "general-purpose"
        if (raw.hook_event_name === "PostToolUseFailure") session.spawnText.get(type)?.pop()
        break
      }
      if (tool === "SendMessage") {
        if (!raw.tool_response?.resumedAgentId) session.resumeText.delete(raw.tool_input?.to)
        break
      }
      const bad = raw.hook_event_name === "PostToolUseFailure" ? raw.is_interrupt !== true : failed(raw.tool_response)
      if (bad) send(agent, { kind: "tool_end", tool, target, state: "error", text: firstLine(raw.error) })
      else if (agent.state === "waiting" || stalled) send(agent, { kind: "tool_end", tool, target, state: "thinking" })
      else send(agent, { kind: "tool_end", tool, target })
      break
    }
    case "SubagentStart": {
      if (typeof raw.agent_id !== "string") break
      const id = session.rawIds.get(raw.agent_id)
      const known = id ? session.agents.get(id) : undefined
      if (!known) spawn(raw.agent_id, raw.agent_type || "subagent")
      else if (known.state === "done") resume(known, raw.agent_id)
      break
    }
    case "SubagentStop": {
      const id = typeof raw.agent_id === "string" ? session.rawIds.get(raw.agent_id) : undefined
      const agent = id ? session.agents.get(id) : undefined
      if (!agent || agent.state === "done") break
      clearTimeout(agent.timer)
      agent.toolAt = undefined
      send(agent, { kind: "agent_done", state: "done", text: firstLine(raw.last_assistant_message) })
      if (!session.stopped) think(lead())
      break
    }
    case "Notification": {
      if (raw.notification_type === "idle_prompt" || raw.notification_type === "auth_success") break
      const asking = [...session.agents.values()].filter((a) => a.toolAt && a.state !== "done").sort((a, b) => b.toolAt! - a.toolAt!)[0]
      const agent = asking ?? actor()
      clearTimeout(agent.timer)
      send(agent, { kind: "tool_start", state: "waiting", text: firstLine(raw.message) })
      agent.timer = setTimeout(() => {
        if (session.turnDone || agent.state !== "waiting") return
        agent.toolAt = undefined
        send(agent, { kind: "tool_start", state: agent.id === "lead" ? "idle" : "thinking" })
      }, WAIT_MS)
      break
    }
    case "Stop": {
      if (busy()) session.stopped = true
      else endTurn()
      break
    }
    case "SessionEnd": {
      sessions.delete(sessionId)
      endTurn()
      const capped = new Promise<void>((r) => setTimeout(r, END_WAIT_MS).unref())
      void Promise.race([session.pending, capped]).then(() => send(lead(), { kind: "session_end", state: "idle" }))
      return
    }
  }
  const settle = () => {
    if (busy() && Date.now() - session.seenAt < STALL_MS) session.endTimer = setTimeout(settle, TEAM_END_MS)
    else endTurn()
  }
  if (session.stopped && !session.turnDone) session.endTimer = setTimeout(settle, TEAM_END_MS)
}
