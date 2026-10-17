import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { Character, Squad } from "@agentsquad/shared"

export const ROOT = fileURLToPath(new URL("../../", import.meta.url))
const STATE_FILE = path.join(ROOT, "demo/state.json")
const EMIT = path.join(ROOT, "hooks/emit.mjs")
const START = "<!-- agentsquad:start -->"
const END = "<!-- agentsquad:end -->"
const HOOK_EVENTS = [
  "SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "PostToolUseFailure",
  "SubagentStart", "SubagentStop", "Stop", "Notification", "SessionEnd",
]

type State = {
  squad: Squad | null
  target: string | null
  agentFiles: string[]
  backedUpAgents: string[]
  createdClaudeMd: boolean
  createdSettings: boolean
}

const empty = (): State => ({ squad: null, target: null, agentFiles: [], backedUpAgents: [], createdClaudeMd: false, createdSettings: false })

export function loadState(): State {
  try {
    return { ...empty(), ...JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) }
  } catch {
    return empty()
  }
}

function saveState(state: State) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n")
}

export function targetDir() {
  return path.resolve(process.env.TARGET ?? path.join(ROOT, "demo/target"))
}

function hookCommand() {
  const port = process.env.PORT && process.env.PORT !== "4317" ? `AGENTSQUAD_PORT=${process.env.PORT} ` : ""
  return `${port}node "${EMIT}"`
}

const isOurs = (h: any) => typeof h?.command === "string" && h.command.includes(EMIT)

function agentFile(c: Character) {
  const lines = ["---", `name: ${c.id}`, `description: ${JSON.stringify(c.description ?? "")}`]
  if (c.tools?.length) lines.push(`tools: ${c.tools.join(", ")}`)
  lines.push(`model: ${c.model || "inherit"}`, "---", "", (c.prompt ?? "").trim(), "")
  return lines.join("\n")
}

function teamSection(squad: Squad) {
  const hasReviewer = squad.members.some((m) => m.id === "reviewer")
  const roster = squad.members.map((m) => `- **${m.id}** (${m.name}, ${m.role}): ${(m.description ?? "").replace(/\s+/g, " ").trim()}`)
  const finish = hasReviewer
    ? "- Always have **reviewer** check the changes before you finish. Never finish without it."
    : "- Before finishing, re-read the changed files yourself."
  return [
    START,
    "## Your team",
    "",
    `You are ${squad.lead.name}, the lead. You have a squad of specialist subagents. Delegate work to them by name with the Agent tool (\`subagent_type\` set to the name in bold) instead of doing it yourself:`,
    "",
    ...roster,
    "",
    "Rules:",
    "- Give each piece of work to the specialist whose description fits. Only do it yourself if nobody fits.",
    "- Run specialists in parallel when their work does not overlap.",
    finish,
    END,
  ].join("\n")
}

function withoutSection(text: string) {
  const a = text.indexOf(START)
  const b = text.indexOf(END)
  if (a === -1 || b === -1 || b < a) return text
  return (text.slice(0, a).trimEnd() + "\n\n" + text.slice(b + END.length).trimStart()).trim() + "\n"
}

function readJson(file: string): any {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return {}
  }
}

function stripHooks(settings: any) {
  if (!settings.hooks || typeof settings.hooks !== "object") return settings
  for (const event of Object.keys(settings.hooks)) {
    const groups = Array.isArray(settings.hooks[event]) ? settings.hooks[event] : []
    const kept = groups
      .map((g: any) => ({ ...g, hooks: Array.isArray(g?.hooks) ? g.hooks.filter((h: any) => !isOurs(h)) : g?.hooks }))
      .filter((g: any) => !Array.isArray(g.hooks) || g.hooks.length > 0)
    if (kept.length) settings.hooks[event] = kept
    else delete settings.hooks[event]
  }
  if (!Object.keys(settings.hooks).length) delete settings.hooks
  return settings
}

export function deploy(squad: Squad) {
  const target = targetDir()
  if (!squad?.lead || !Array.isArray(squad.members)) throw new Error("body must be a Squad")
  for (const m of squad.members) if (!/^[a-z0-9][a-z0-9-]*$/.test(m.id ?? "")) throw new Error(`bad member id: ${m.id}`)

  const prev = loadState()
  const state: State = prev.target === target ? prev : { ...empty(), target }
  if (prev.target && prev.target !== target) undeploy()
  state.target = target
  state.squad = squad
  const files: { path: string; content: string }[] = []
  const write = (rel: string, content: string) => {
    const abs = path.join(target, rel)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, content)
    files.push({ path: rel, content })
  }

  const agentsDir = path.join(target, ".claude/agents")
  const ids = squad.members.map((m) => m.id)
  for (const old of state.agentFiles) if (!ids.includes(old)) removeAgent(agentsDir, old, state)
  for (const m of squad.members) {
    const file = path.join(agentsDir, `${m.id}.md`)
    if (!state.agentFiles.includes(m.id) && fs.existsSync(file)) {
      fs.copyFileSync(file, file + ".agentsquad-bak")
      state.backedUpAgents.push(m.id)
    }
    write(`.claude/agents/${m.id}.md`, agentFile(m))
  }
  state.agentFiles = ids

  const claudeMd = path.join(target, "CLAUDE.md")
  const hadClaudeMd = fs.existsSync(claudeMd)
  if (!hadClaudeMd) state.createdClaudeMd = true
  const before = hadClaudeMd ? withoutSection(fs.readFileSync(claudeMd, "utf8")).trim() : ""
  write("CLAUDE.md", (before ? before + "\n\n" : "") + teamSection(squad) + "\n")

  const settingsFile = path.join(target, ".claude/settings.json")
  const backup = settingsFile + ".agentsquad-bak"
  if (!fs.existsSync(settingsFile)) state.createdSettings = true
  else if (!state.createdSettings && !fs.existsSync(backup)) fs.copyFileSync(settingsFile, backup)
  const settings = stripHooks(readJson(settingsFile))
  settings.hooks ??= {}
  for (const event of HOOK_EVENTS) {
    settings.hooks[event] = [...(settings.hooks[event] ?? []), { matcher: "", hooks: [{ type: "command", command: hookCommand() }] }]
  }
  write(".claude/settings.json", JSON.stringify(settings, null, 2) + "\n")

  saveState(state)
  return { target, files }
}

function removeAgent(agentsDir: string, id: string, state: State) {
  const file = path.join(agentsDir, `${id}.md`)
  fs.rmSync(file, { force: true })
  if (state.backedUpAgents.includes(id)) {
    fs.renameSync(file + ".agentsquad-bak", file)
    state.backedUpAgents = state.backedUpAgents.filter((b) => b !== id)
  }
}

export function undeploy() {
  const state = loadState()
  const target = state.target ?? targetDir()
  const agentsDir = path.join(target, ".claude/agents")
  const removed: string[] = []
  for (const id of state.agentFiles) {
    removeAgent(agentsDir, id, state)
    removed.push(`.claude/agents/${id}.md`)
  }
  try {
    if (!fs.readdirSync(agentsDir).length) fs.rmdirSync(agentsDir)
  } catch {}

  const claudeMd = path.join(target, "CLAUDE.md")
  if (fs.existsSync(claudeMd)) {
    const rest = withoutSection(fs.readFileSync(claudeMd, "utf8"))
    if (state.createdClaudeMd && !rest.trim()) fs.rmSync(claudeMd)
    else fs.writeFileSync(claudeMd, rest)
    removed.push("CLAUDE.md")
  }

  const settingsFile = path.join(target, ".claude/settings.json")
  const backup = settingsFile + ".agentsquad-bak"
  if (fs.existsSync(settingsFile)) {
    const settings = stripHooks(readJson(settingsFile))
    const original = fs.existsSync(backup) ? fs.readFileSync(backup, "utf8") : null
    if (state.createdSettings && !Object.keys(settings).length) fs.rmSync(settingsFile)
    else if (original !== null && JSON.stringify(readJson(backup)) === JSON.stringify(settings)) fs.writeFileSync(settingsFile, original)
    else fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + "\n")
    removed.push(".claude/settings.json")
  }
  fs.rmSync(backup, { force: true })
  try {
    if (!fs.readdirSync(path.join(target, ".claude")).length) fs.rmdirSync(path.join(target, ".claude"))
  } catch {}

  saveState(empty())
  return { target, removed }
}
