// POSTs raw Claude Code hook payloads to /hook so the real normalizer and narrator run end to end.
// npm run replay-hooks                 recorded samples in hooks/samples/*.jsonl, paced like a real session
// npm run replay-hooks -- --scripted   the mock's dark mode session, converted to raw hooks
// --speed 2 plays twice as fast
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { script } from "./script"

const HOOK_URL = process.env.HOOK_URL ?? `http://127.0.0.1:${process.env.PORT ?? 4317}/hook`
const SAMPLES = path.join(path.dirname(fileURLToPath(import.meta.url)), "../hooks/samples")
const CWD = "/demo/target"
const args = process.argv.slice(2)
const speed = Number(args[args.indexOf("--speed") + 1]) || 1
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms / speed))

const GAP: Record<string, number> = {
  SessionStart: 0, UserPromptSubmit: 800, PreToolUse: 1600, PostToolUse: 1400, PostToolUseFailure: 1400,
  SubagentStart: 200, SubagentStop: 1200, Notification: 500, Stop: 1500, SessionEnd: 1500,
}

async function post(raw: unknown) {
  try {
    await fetch(HOOK_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(raw) })
  } catch {
    console.log(`no server at ${HOOK_URL}`)
    process.exit(1)
  }
}

function inputFor(tool: string | undefined, target: string | undefined) {
  if (!target) return {}
  if (tool === "Bash") return { command: target }
  if (tool === "Grep" || tool === "Glob") return { pattern: target }
  return { file_path: `${CWD}/${target}` }
}

function scripted(sessionId: string): [number, any][] {
  const out: [number, any][] = []
  const base = { session_id: sessionId, cwd: CWD }
  for (const [at, e] of script) {
    const ms = at * 1000
    const who = e.agentId === "lead" ? {} : { agent_id: `raw-${e.agentId}`, agent_type: e.agentType }
    const tool = { tool_name: e.tool, tool_input: inputFor(e.tool, e.target) }
    if (e.kind === "session_start") out.push([ms, { ...base, hook_event_name: "SessionStart", source: "startup" }])
    if (e.kind === "prompt") out.push([ms, { ...base, hook_event_name: "UserPromptSubmit", prompt: e.text }])
    if (e.kind === "spawn") {
      out.push([ms, { ...base, hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { subagent_type: e.agentType, description: e.text, prompt: e.text } }])
      out.push([ms + 100, { ...base, ...who, hook_event_name: "SubagentStart" }])
    }
    if (e.kind === "tool_start" && e.state === "waiting") out.push([ms, { ...base, hook_event_name: "Notification", message: e.text, notification_type: "permission_prompt" }])
    if (e.kind === "tool_start" && e.tool) out.push([ms, { ...base, ...who, ...tool, hook_event_name: "PreToolUse" }])
    if (e.kind === "tool_end" && e.state === "error") out.push([ms, { ...base, ...who, ...tool, hook_event_name: "PostToolUseFailure", error: `Exit code 1\n${e.text ?? ""}`, is_interrupt: false }])
    else if (e.kind === "tool_end") out.push([ms, { ...base, ...who, ...tool, hook_event_name: "PostToolUse", tool_response: {} }])
    if (e.kind === "agent_done" && e.agentId !== "lead") out.push([ms, { ...base, ...who, hook_event_name: "SubagentStop", last_assistant_message: e.text }])
    if (e.kind === "agent_done" && e.agentId === "lead") out.push([ms, { ...base, hook_event_name: "Stop" }])
    if (e.kind === "session_end") out.push([ms + 3000, { ...base, hook_event_name: "SessionEnd", reason: "other" }])
  }
  return out.sort((a, b) => a[0] - b[0])
}

function recorded(file: string, sessionId: string): [number, any][] {
  let at = 0
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => {
    const raw = JSON.parse(line)
    at += GAP[raw.hook_event_name] ?? 1000
    return [at, { ...raw, session_id: sessionId }]
  })
}

async function play(name: string, steps: [number, any][]) {
  console.log(`replaying ${name}: ${steps.length} hooks to ${HOOK_URL}`)
  const start = Date.now()
  for (const [at, raw] of steps) {
    await sleep(Math.max(0, at - (Date.now() - start) * speed))
    await post(raw)
  }
}

const stamp = Date.now().toString(36)
if (args.includes("--scripted")) {
  await play("scripted dark mode session", scripted(`replay-scripted-${stamp}`))
} else {
  for (const file of fs.readdirSync(SAMPLES).filter((f) => f.endsWith(".jsonl")).sort()) {
    await play(file, recorded(path.join(SAMPLES, file), `replay-${path.basename(file, ".jsonl")}-${stamp}`))
    await sleep(3000)
  }
}
await sleep(4000)
console.log("replay done")
