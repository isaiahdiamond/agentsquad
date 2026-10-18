import { useEffect, useRef, useState } from "react"
import { NavLink } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import type { Squad } from "@agentsquad/shared"
import { Portrait, useSettled } from "./Sprite"
import { clock, who, type Agent, type Arena, type Toast } from "./store"
import { nameOf, squadStatus, statusLine, teamOf } from "./world"

export const GLASS = "border border-white/[0.08] bg-[rgba(14,14,16,0.6)] backdrop-blur-[12px]"

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

const link = ({ isActive }: { isActive: boolean }) => `rounded-full px-2.5 py-1 transition-colors ${isActive ? "bg-white/[0.08] text-text" : "text-muted hover:text-text"}`

// The app nav, collapsed to the wordmark until hovered or focused.
export function NavPill({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className={`flex h-9 items-center rounded-full pl-4 pr-1.5 text-[13px] ${GLASS}`}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
    >
      <span className="pr-2.5 font-semibold text-text">Agent Viz</span>
      <nav className={`flex items-center gap-0.5 overflow-hidden transition-[max-width,opacity] duration-200 ${open ? "max-w-[260px] opacity-100" : "max-w-0 opacity-0"}`}>
        <NavLink to="/builder" className={link}>Builder</NavLink>
        <NavLink to="/arena" className={link}>Arena</NavLink>
        <NavLink to="/report" className={link}>Report</NavLink>
      </nav>
      {children}
    </div>
  )
}

// "Add a dark mode toggle that remembers…": the prompt's first sentence, cut on a word.
export function titleOf(prompt?: string, max = 46) {
  if (!prompt) return ""
  const first = prompt.split(/(?<=[.!?])\s|\n/)[0].replace(/[.!?]+$/, "").trim()
  if (first.length <= max) return first
  return first.slice(0, max).replace(/\s+\S*$/, "") + "…"
}

export function MissionPill({ arena, finished, connected }: { arena: Arena; finished: number; connected: boolean }) {
  const now = useNow()
  const start = arena.promptAt
  const title = titleOf(arena.prompt)
  return (
    <div className={`flex h-9 items-center gap-2.5 rounded-full px-3.5 text-[13px] ${GLASS}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${connected ? "bg-emerald-400" : "bg-red-500"}`} title={connected ? "Live" : "Reconnecting"} />
      <span className="max-w-[38vw] truncate font-medium text-text" title={arena.prompt}>{title || (connected ? "No mission yet" : "Reconnecting")}</span>
      {start > 0 && <span className="tabular-nums text-muted">{clock((finished || now) - start)}</span>}
    </div>
  )
}

// What the squad is doing, in one line.
export function modeOf(arena: Arena, finished: number, connected: boolean, standby?: Standby | null) {
  if (!connected) return "Reconnecting to the server"
  if (finished) return "Mission complete"
  if (standby === "waiting") return "Waiting for Claude Code"
  if (standby === "connected") return "Connected"
  const agents = Object.values(arena.agents)
  if (agents.some((a) => !a.doneAt && a.state === "waiting")) return "Waiting for you"
  const working = agents.filter((a) => !a.doneAt && a.state !== "idle").length
  if (working > 1) return `${working} agents working`
  if (arena.prompt) return `Mission: ${titleOf(arena.prompt, 40).replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase())}`
  return "Standing by"
}

export type Standby = "waiting" | "connected" | "nosquad"

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const t = document.createElement("textarea")
    t.value = text
    document.body.appendChild(t)
    t.select()
    document.execCommand("copy")
    t.remove()
  }
}

function CopyCommand({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await copyText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-white/[0.12] bg-black/40 py-0.5 pl-2 pr-0.5 align-middle">
      <code className="font-mono text-[13px] text-text">{text}</code>
      <button
        className="rounded px-1.5 py-0.5 text-[11px] font-medium text-muted transition-colors hover:bg-white/[0.08] hover:text-text"
        onClick={copy} aria-label={`Copy ${text}`} title={`Copy ${text}`}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  )
}

// Before a mission: no squad yet, deployed but Claude Code not running, or connected and waiting for a task.
export function StandbyHint({ kind }: { kind: Standby }) {
  return (
    <motion.div
      className={`pointer-events-auto flex max-w-[min(560px,90vw)] flex-col items-center gap-1 rounded-[14px] px-4 py-2.5 text-center text-[13px] text-text ${GLASS}`}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }}
    >
      {kind === "waiting" && (
        <>
          <span className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
            Waiting for Claude Code. Run <CopyCommand text="claude" /> in this project.
          </span>
          <span className="text-[12px] text-muted">Deploy before starting Claude, or restart it</span>
        </>
      )}
      {kind === "connected" && (
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
          Connected. Give your lead a task in Claude Code.
        </span>
      )}
      {kind === "nosquad" && (
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full bg-faint" />
          No squad deployed yet.
          <NavLink to="/builder" className="font-semibold text-text underline decoration-white/30 underline-offset-2 hover:decoration-white">Build your squad</NavLink>
        </span>
      )}
    </motion.div>
  )
}

export function ModeCaption({ text }: { text: string }) {
  return (
    <div className={`relative h-10 overflow-hidden rounded-full px-4 text-[15px] font-medium text-text ${GLASS}`}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={text} className="flex h-10 items-center whitespace-nowrap"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}

function Chip({ type, agent, label, squad, onPick }: { type: string; agent?: Agent; label: string; squad: Squad | null; onPick: (id: string) => void }) {
  const [hover, setHover] = useState(false)
  const w = who(type, squad)
  const done = !!agent?.doneAt
  const waiting = !done && agent?.state === "waiting"
  const error = !done && agent?.state === "error"
  const working = !!agent && !done && agent.state !== "idle"
  const ring = waiting ? "ring-amber-400" : error ? "ring-red-500" : working ? "ring-accent" : done ? "ring-emerald-500/70" : "ring-white/10"
  const status = useSettled(agent ? statusLine(agent) : "On call", !!agent && (done || waiting || error))
  return (
    <div className="relative" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        className={`relative block rounded-full ring-2 transition-[box-shadow,opacity] ${ring} ${agent ? "" : "opacity-45 grayscale"}`}
        onClick={() => agent && onPick(agent.id)} aria-label={`${label}: ${status}`}
      >
        {waiting && <motion.span className="absolute -inset-1 rounded-full ring-2 ring-amber-400" animate={{ opacity: [0.9, 0], scale: [1, 1.35] }} transition={{ duration: 1.2, repeat: Infinity }} />}
        <Portrait who={w} seed={type} size={30} className="rounded-full" />
        {done && (
          <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-[#050505]">
            <svg viewBox="0 0 10 10" className="w-2"><path d="M2 5.2 L4.2 7.4 L8 2.8" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
          </span>
        )}
        {waiting && <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[9px] font-extrabold text-[#050505] ring-2 ring-[#050505]">!</span>}
      </button>
      <AnimatePresence>
        {hover && (
          <motion.div
            className="absolute right-0 top-[calc(100%+10px)] z-20 w-64 rounded-[14px] border border-white/[0.08] bg-[rgba(14,14,16,0.92)] px-3 py-2.5 text-[13px]"
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          >
            <div className="flex items-center gap-1.5 font-semibold text-text">
              <span className="h-2 w-2 rounded-full" style={{ background: w.color }} />
              {label}
            </div>
            <p className={`mt-0.5 leading-snug ${waiting ? "text-amber-200" : error ? "text-red-300" : "text-muted"}`}>{status}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// One chip per agent instance (two Frontend agents = two chips), plus one greyed chip per squad member still on call.
export function TeamChips({ arena, squad, onPick, connected = true }: { arena: Arena; squad: Squad | null; onPick: (id: string) => void; connected?: boolean }) {
  const team = teamOf(arena, squad)
  const groups = squadStatus(arena, squad)
  const lastPick = useRef<Record<string, string>>({})
  const statuses = [
    { key: "needs", label: "Need you", dot: "bg-amber-400" },
    { key: "working", label: "Working", dot: "bg-sky-400" },
    { key: "idle", label: "Idle", dot: "bg-zinc-400" },
    { key: "done", label: "Done", dot: "bg-emerald-400" },
  ] as const
  const total = Object.values(groups).reduce((n, group) => n + group.length, 0)
  return (
    <div className="flex max-w-[calc(100vw-32px)] flex-col items-end gap-2">
    <div className={`flex items-center gap-2 rounded-full p-1.5 ${GLASS}`}>
      {team.map((t) => (
        <Chip key={t.key} type={t.type} agent={t.agent} squad={squad} onPick={onPick} label={t.agent ? nameOf(t.agent, arena, squad) : who(t.type, squad).name} />
      ))}
    </div>
    {total > 0 && (
      <div className={`grid grid-cols-2 items-center gap-2 rounded-2xl p-3 text-[16px] sm:flex sm:flex-wrap ${GLASS} ${connected ? "" : "opacity-60"}`}
        aria-label={connected ? "Squad status" : "Last known squad status"} title={connected ? "Squad status" : "Reconnecting: last known counts"}>
        {statuses.map(({ key, label, dot }) => {
          const group = groups[key]
          const ids = group.flatMap((slot) => slot.agent ? [slot.agent.id] : [])
          const names = group.map((slot) => slot.agent ? nameOf(slot.agent, arena, squad) : who(slot.type, squad).name)
          return (
            <button key={key} type="button" disabled={!ids.length} title={names.length ? names.join(", ") : `No agents ${label.toLowerCase()}`}
              aria-label={`${label}: ${group.length} agent${group.length === 1 ? "" : "s"}${ids.length ? ". Click to find them." : ""}`}
              onClick={() => {
                const id = ids[(ids.indexOf(lastPick.current[key]) + 1) % ids.length]
                lastPick.current[key] = id
                onPick(id)
              }}
              className={`flex min-h-11 items-center justify-center gap-2.5 rounded-xl bg-white/[0.04] px-3 py-2 font-semibold transition-colors enabled:hover:bg-white/[0.08] enabled:hover:text-white focus-visible:outline-2 focus-visible:outline-white ${key === "needs" && group.length ? "font-medium text-amber-300" : "text-muted"}`}>
              <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${group.length ? dot : "bg-white/15"}`} />
              <span className="text-[20px] font-bold tabular-nums">{group.length}</span><span>{label}</span>
            </button>
          )
        })}
        {!connected && <span className="text-faint">Last known</span>}
      </div>
    )}
    </div>
  )
}

const TONE: Record<Toast["tone"], string> = { info: "bg-accent", wait: "bg-amber-400", error: "bg-red-500", done: "bg-emerald-400" }

// One narration line at a time, 3.5s each. A backlog never grows past two waiting lines: older ones are dropped.
export function Toaster({ items, arena, squad, since }: { items: Toast[]; arena: Arena; squad: Squad | null; since: number }) {
  const [cur, setCur] = useState<Toast | null>(null)
  const seen = useRef(new Set<string>())
  useEffect(() => {
    if (!cur) return
    const t = setTimeout(() => setCur(null), 3500)
    return () => clearTimeout(t)
  }, [cur])
  useEffect(() => {
    if (cur) return
    const pending = items.filter((t) => !seen.current.has(t.id) && t.at >= since && Date.now() - t.at < 12000).sort((a, b) => a.at - b.at)
    pending.slice(0, -2).forEach((t) => seen.current.add(t.id))
    const next = pending.slice(-2)[0]
    if (!next) return
    seen.current.add(next.id)
    setCur(next)
  }, [cur, items])
  const named = cur && arena.agents[cur.agentId]
  const text = cur ? (cur.named ? `${named ? nameOf(named, arena, squad) : who(cur.agentType, squad).name} ${cur.text}` : cur.text) : ""
  return (
    <AnimatePresence>
      {cur && (
        <motion.div
          key={cur.id} className={`flex max-w-[min(560px,80vw)] items-center gap-2.5 rounded-full px-4 py-2.5 text-[13px] text-text ${GLASS}`}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }}
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${TONE[cur.tone]}`} />
          <span className="truncate">{text}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Pill({ on, onClick, children, label, title }: { on?: boolean; onClick: () => void; children: React.ReactNode; label?: string; title?: string }) {
  return (
    <button
      className={`flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium transition-colors ${GLASS} ${on ? "text-text ring-1 ring-accent/70" : "text-muted hover:text-text"}`}
      onClick={onClick} aria-pressed={on} aria-label={label} title={title}
    >
      {children}
    </button>
  )
}
