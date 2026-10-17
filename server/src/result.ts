import fs from "node:fs"
import path from "node:path"
import { ROOT, loadState, targetDir } from "./deploy"

export type ResultFile = { path: string; agentId: string; action: "created" | "edited" }
export type ResultUrl = { url: string; source: "bash" | "report" | "command"; up?: boolean }
export type Result = {
  sessionId: string
  target: string
  missionPrompt: string
  startedAt: number
  endedAt: number
  files: ResultFile[]
  urls: ResultUrl[]
  preview: { url: string; entry: string; dir: string } | null
  run: { command: string; cwd: string; ran: boolean } | null
}

type Mission = {
  target: string
  base: string
  cwd: string
  prompt: string
  startedAt: number
  files: Map<string, ResultFile>
  urls: Map<string, ResultUrl>
  run?: { command: string; cwd: string }
  guessed: string[]
}

const FILE = path.join(ROOT, "demo/result.json")
const OUTPUT_TOOLS = new Set(["Bash", "BashOutput", "TaskOutput"])
const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"])
const BUNDLERS = ["vite", "next", "react-scripts", "parcel", "webpack", "astro", "@sveltejs/kit", "nuxt", "@angular/cli"]
const MAX_FILES = 200
const missions = new Map<string, Mission>()
let last: Result | null = load()

function load(): Result | null {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"))
  } catch {
    return null
  }
}

function save() {
  fs.writeFile(FILE, JSON.stringify(last, null, 2) + "\n", () => {})
}

function real(p: string): string {
  try {
    return fs.realpathSync(p)
  } catch {
    const up = path.dirname(p)
    return up === p ? p : path.join(real(up), path.basename(p))
  }
}

function inside(file: string, dir: string) {
  const rel = path.relative(dir, file)
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel : null
}

function mission(sessionId: string, cwd?: string) {
  let m = missions.get(sessionId)
  if (!m) {
    const target = loadState().target ?? targetDir()
    const base = real(target)
    m = { target, base, cwd: cwd ? real(cwd) : base, prompt: "", startedAt: Date.now(), files: new Map(), urls: new Map(), guessed: [] }
    missions.set(sessionId, m)
  }
  return m
}

export function begin(sessionId: string, cwd: string, prompt: string) {
  missions.delete(sessionId)
  mission(sessionId, cwd).prompt = prompt.trim().slice(0, 2000)
}

export function noteFile(sessionId: string, cwd: string, agentId: string, tool: string, input: any, response: any) {
  if (!WRITE_TOOLS.has(tool)) return
  const m = mission(sessionId, cwd)
  const raw = input?.file_path ?? input?.notebook_path
  if (typeof raw !== "string") return
  const abs = path.resolve(m.cwd, raw)
  const rel = inside(abs, m.base) ?? inside(real(abs), m.base)
  if (!rel) return
  const prev = m.files.get(rel)
  const created = tool === "Write" && response?.type === "create"
  m.files.delete(rel)
  if (m.files.size < MAX_FILES) m.files.set(rel, { path: rel, agentId, action: prev?.action === "created" || created ? "created" : "edited" })
}

const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g
const LOCAL_URL = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\])(?::\d{1,5})?(?:\/[^\s"'`<>)\]}]*)?/g

function strings(v: unknown, out: string[] = [], depth = 0): string[] {
  if (typeof v === "string") out.push(v)
  else if (v && typeof v === "object" && depth < 4) for (const x of Object.values(v)) strings(x, out, depth + 1)
  return out
}

export function urlsIn(text: string) {
  const own = `:${process.env.PORT ?? 4317}`
  return [...text.replace(ANSI, "").matchAll(LOCAL_URL)]
    .map((m) => m[0].replace(/[.,;:!?*_]+$/, "").replace("0.0.0.0", "localhost").replace(/\[::1?\]/, "localhost"))
    .map((u) => (/^https?:\/\/[^/]+$/.test(u) ? u + "/" : u))
    .filter((u) => {
      try {
        return !new URL(u).host.endsWith(own)
      } catch {
        return false
      }
    })
}

export function noteText(sessionId: string, cwd: string, value: unknown, source: "bash" | "report", tool?: string) {
  if (tool && !OUTPUT_TOOLS.has(tool)) return
  const m = mission(sessionId, cwd)
  for (const url of strings(value).flatMap(urlsIn)) if (!m.urls.has(url)) m.urls.set(url, { url, source })
}

const SERVER = [
  /^(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:dev|start|serve|preview)\b/,
  /^(?:npx\s+|bunx\s+|pnpm\s+(?:exec|dlx)\s+)?vite(?:\s|$)/,
  /^(?:npx\s+)?next\s+(?:dev|start)\b/,
  /^(?:npx\s+)?astro\s+(?:dev|preview)\b/,
  /^python3?\s+-m\s+http\.server\b/,
  /^(?:npx|bunx|pnpm\s+dlx)\s+(?:-y\s+)?(?:serve|http-server|live-server|vite)\b/,
  /^(?:http-server|live-server|serve)\b/,
  /^php\s+-S\b/,
  /^(?:flask\s+run|uvicorn|rails\s+s(?:erver)?)\b/,
]
const DEFAULT_PORT: [RegExp, number][] = [
  [/\bvite\b/, 5173], [/\bastro\b/, 4321], [/\bnext\b/, 3000], [/http\.server/, 8000], [/\bhttp-server\b/, 8080],
  [/\blive-server\b/, 8080], [/\bserve\b/, 3000], [/\bflask\b/, 5000], [/\buvicorn\b/, 8000], [/\brails\b/, 3000],
  [/\breact-scripts\s+start\b/, 3000],
]

function scripts(dir: string): Record<string, string> {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"))
    return pkg?.scripts && typeof pkg.scripts === "object" ? pkg.scripts : {}
  } catch {
    return {}
  }
}

function portOf(cmd: string, dir: string, depth = 0): number | undefined {
  const flag = cmd.match(/(?:--port[ =]|-p\s+|-l\s+|--listen[ =]|\bPORT=)(?:tcp:\/\/)?(?:[\w.]+:)?(\d{2,5})\b/) ?? cmd.match(/http\.server\s+(\d{2,5})\b/) ?? cmd.match(/php\s+-S\s+[\w.]+:(\d{2,5})/)
  if (flag) return Number(flag[1])
  const script = cmd.replace(/^(?:\w+=\S*\s+)*/, "").match(/^(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(\w[\w:-]*)/)?.[1]
  if (script && depth < 3) {
    const body = scripts(dir)[script]
    return body ? portOf(body, dir, depth + 1) : undefined
  }
  return DEFAULT_PORT.find(([re]) => re.test(cmd))?.[1]
}

function segments(command: string) {
  const out = [""]
  let quote = ""
  for (let i = 0; i < command.length; i++) {
    const c = command[i]
    if (quote) {
      if (c === "\\" && quote === '"') out[out.length - 1] += c + (command[++i] ?? "")
      else {
        if (c === quote) quote = ""
        out[out.length - 1] += c
      }
    } else if (c === '"' || c === "'") {
      quote = c
      out[out.length - 1] += c
    } else if (";|\n".includes(c) || (c === "&" && command[i + 1] === "&")) {
      if (command[i + 1] === c) i++
      out.push("")
    } else out[out.length - 1] += c
  }
  return out
}

export function noteCommand(sessionId: string, cwd: string, command: unknown) {
  if (typeof command !== "string") return
  const m = mission(sessionId, cwd)
  let dir = m.cwd
  for (const piece of segments(command)) {
    const full = piece.replace(/\s+\d*>&\d/g, "").replace(/\s*(?:\d?>>?|&>)\s*\S+/g, "").replace(/\s*&\s*$/, "").trim().replace(/^nohup\s+/, "")
    const part = full.replace(/^(?:\w+=\S*\s+)*/, "")
    const cd = part.match(/^cd\s+("[^"]+"|'[^']+'|\S+)$/)
    if (cd) {
      dir = path.resolve(dir, cd[1].replace(/^["']|["']$/g, ""))
      continue
    }
    if (!SERVER.some((re) => re.test(part)) || /^(?:npx\s+)?(?:vite|next|astro)\s+(?:build|optimize)\b/.test(part)) continue
    m.run = { command: full, cwd: dir }
    const port = portOf(full, dir)
    if (port && port !== Number(process.env.PORT ?? 4317) && port !== Number(process.env.WEB_PORT ?? 5173)) m.guessed.push(`http://localhost:${port}/`)
  }
}

function needsBundler(dir: string) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    if (BUNDLERS.some((b) => b in deps)) return true
  } catch {}
  try {
    return /<script[^>]+src=["']\/?src\/[^"']+\.(?:jsx|tsx|ts|vue|svelte)["']/.test(fs.readFileSync(path.join(dir, "index.html"), "utf8"))
  } catch {
    return false
  }
}

function previewDir(m: Mission) {
  const fresh = (f: string) => {
    try {
      return fs.statSync(f).mtimeMs >= m.startedAt - 2000
    } catch {
      return false
    }
  }
  const has = (d: string) => fs.existsSync(path.join(d, "index.html"))
  const written = [...m.files.keys()].map((f) => path.join(m.base, f))
  const ancestors = new Set([m.base])
  for (const f of written) for (let d = path.dirname(f); inside(d, m.base); d = path.dirname(d)) ancestors.add(d)
  if (m.run) ancestors.add(m.run.cwd)
  const byDepth = (a: string, b: string) => a.split(path.sep).length - b.split(path.sep).length
  const built = [...ancestors].flatMap((d) => ["dist", "build", "out"].map((b) => path.join(d, b))).filter((d) => fresh(path.join(d, "index.html")))
  const builtWritten = [...m.files.keys()].filter((f) => /(^|\/)(dist|build|out)\/index\.html$/.test(f)).map((f) => path.dirname(path.join(m.base, f)))
  const pages = written.filter((f) => path.basename(f) === "index.html").map(path.dirname).filter((d) => has(d) && !needsBundler(d))
  const root = has(m.base) && !needsBundler(m.base) ? [m.base] : []
  return [...builtWritten, ...built.sort(byDepth), ...pages.sort(byDepth), ...root].find((d) => has(d) && (d === m.base || inside(d, m.base)))
}

const shown = (m: Mission, p: string) => (p === m.base ? m.target : inside(p, m.base) ? path.join(m.target, path.relative(m.base, p)) : p)

function suggestRun(m: Mission): Result["run"] {
  if (m.run) return { command: m.run.command, cwd: shown(m, m.run.cwd), ran: true }
  const dirs = [...new Set([...m.files.keys()].filter((f) => path.basename(f) === "package.json").map((f) => path.join(m.base, path.dirname(f))))]
  for (const dir of [...dirs, m.base]) {
    const s = scripts(dir)
    const name = ["dev", "start", "serve", "preview"].find((k) => s[k])
    if (name) return { command: name === "start" ? "npm start" : `npm run ${name}`, cwd: shown(m, dir), ran: false }
  }
  return null
}

export async function checkUp(urls: ResultUrl[]) {
  await Promise.all(urls.map(async (u) => {
    try {
      await fetch(u.url, { method: "HEAD", signal: AbortSignal.timeout(1000), redirect: "manual" })
      u.up = true
    } catch {
      u.up = false
    }
  }))
}

export function finish(sessionId: string) {
  const m = missions.get(sessionId)
  if (!m) return
  missions.delete(sessionId)
  const urls = [...m.urls.values()]
  if (!urls.length) for (const url of new Set(m.guessed)) urls.push({ url, source: "command" })
  const dir = previewDir(m)
  last = {
    sessionId,
    target: m.target,
    missionPrompt: m.prompt,
    startedAt: m.startedAt,
    endedAt: Date.now(),
    files: [...m.files.values()],
    urls,
    preview: dir ? { url: "/api/preview/index.html", entry: "index.html", dir: path.relative(m.base, dir) } : null,
    run: suggestRun(m),
  }
  save()
  const mine = last
  void checkUp(urls).then(() => last === mine && save())
}

export function noteReport(sessionId: string, text: string) {
  if (!last || last.sessionId !== sessionId) return
  const fresh = urlsIn(text).filter((url) => !last!.urls.some((u) => u.url === url)).map((url): ResultUrl => ({ url, source: "report" }))
  if (!fresh.length) return
  last.urls = [...last.urls.filter((u) => u.source !== "command"), ...fresh]
  save()
  const mine = last
  void checkUp(fresh).then(() => last === mine && save())
}

export async function latestResult() {
  if (last) await checkUp(last.urls)
  return last
}

export function resultFor(sessionId: string, since: number) {
  if (!last || last.sessionId !== sessionId || last.endedAt < since) return undefined
  const best = last.urls.find((u) => u.up) ?? last.urls[0]
  return { files: last.files.length, url: best?.url ?? null, preview: last.preview?.url ?? null, run: last.run?.command ?? null }
}

export function previewRoot() {
  const state = loadState()
  if (!state.squad || !state.target || !last?.preview) return null
  if (real(state.target) !== real(last.target)) return null
  return path.join(real(last.target), last.preview.dir)
}
