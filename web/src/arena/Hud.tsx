import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import type { Squad } from "@agentsquad/shared"
import { Portrait } from "./Sprite"
import { roster } from "../builder/roster"
import { clock, who, type Agent, type Arena } from "./store"

function useNow() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-text">{children}</span>
    </div>
  )
}

export function TopBar({ arena, squad, title, connected }: { arena: Arena; squad: Squad | null; title: string; connected: boolean }) {
  const now = useNow()
  const elapsed = arena.startAt ? (arena.endAt || now) - arena.startAt : 0
  const active = Object.values(arena.agents).filter((a) => !a.doneAt)
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-bg px-4 py-2.5">
      <div className="mr-2 flex items-center gap-2.5">
        <span className="relative flex h-2.5 w-2.5" title={connected ? "Live" : "Reconnecting"}>
          {connected && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />}
          <span className={`relative h-2.5 w-2.5 rounded-full ${connected ? "bg-emerald-400" : "bg-red-500"}`} />
        </span>
        <span className="text-[15px] font-semibold text-text">{title}</span>
      </div>
      <Stat label="Time">{clock(elapsed)}</Stat>
      <Stat label="Tool calls">{arena.toolCount}</Stat>
      <Stat label="Active">
        <span className="flex items-center gap-2">
          {active.length}
          <span className="flex -space-x-1">
            {active.map((a) => <Portrait key={a.id} who={who(a.type, squad)} seed={a.type} size={22} className="rounded-md ring-2 ring-panel" />)}
          </span>
        </span>
      </Stat>
    </div>
  )
}

function base(path?: string) {
  return path?.split("/").pop() ?? ""
}

// A short status from the agent's state when it hasn't narrated yet.
function verb(a: Agent) {
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

function status(a: Agent) {
  if (a.doneAt) return a.doneText || "Done"
  return a.narration || verb(a)
}

// The latest text, but never changing more than once per 1.5s: rapid updates settle on the newest one.
function useSettled(text: string) {
  const [shown, setShown] = useState(text)
  const last = useRef(0)
  useEffect(() => {
    if (text === shown) return
    const t = setTimeout(() => {
      last.current = Date.now()
      setShown(text)
    }, Math.max(0, last.current + 1500 - Date.now()))
    return () => clearTimeout(t)
  }, [text, shown])
  return shown
}

function Dot({ a }: { a?: Agent }) {
  if (a?.doneAt) {
    return (
      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500">
        <svg viewBox="0 0 10 10" className="w-2.5"><path d="M2 5.2 L4.2 7.4 L8 2.8" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
      </span>
    )
  }
  const tone = !a || a.state === "idle" ? "bg-faint" : a.state === "waiting" ? "bg-amber-400" : a.state === "error" ? "bg-red-500" : "bg-accent"
  return (
    <span className="relative flex h-3.5 w-3.5 items-center justify-center">
      {a && a.state !== "idle" && <span className={`absolute inset-0.5 animate-ping rounded-full opacity-40 ${tone}`} />}
      <span className={`relative h-2 w-2 rounded-full ${tone}`} />
    </span>
  )
}

function Row({ type, agent, squad }: { type: string; agent?: Agent; squad: Squad | null }) {
  const w = who(type, squad)
  const text = useSettled(agent ? status(agent) : "On call")
  return (
    <div className={`flex items-center gap-3 rounded-xl px-2 py-2.5 transition-opacity duration-500 ${agent ? "" : "opacity-45"}`}>
      <Portrait who={w} seed={type} size={36} className="rounded-lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-semibold text-text">{w.name}</span>
          <Dot a={agent} />
        </div>
        <div className="relative mt-0.5 h-[1.35em] overflow-hidden text-[13px] leading-[1.35em]">
          <AnimatePresence initial={false}>
            <motion.p
              key={text} className={`absolute inset-x-0 top-0 truncate ${agent?.state === "error" && !agent.doneAt ? "text-red-300" : agent?.state === "waiting" ? "text-amber-200" : "text-muted"}`}
              title={text}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {text}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// One fixed row per squad member (the whole roster when no squad is deployed): lead first, then specialists in roster order. Rows never move; only the status line changes.
export function Rail({ arena, squad }: { arena: Arena; squad: Squad | null }) {
  const [open, setOpen] = useState(false)
  const order = (t: string) => {
    const i = roster.findIndex((r) => r.id === t)
    return i < 0 ? 99 : i
  }
  const seen = Object.values(arena.agents).map((a) => a.type).filter((t) => t !== "lead")
  const types = ["lead", ...new Set([...(squad?.members.map((m) => m.id) ?? roster.map((r) => r.id)), ...seen])].sort((a, b) => (a === "lead" ? -1 : b === "lead" ? 1 : order(a) - order(b)))
  const latest = (t: string) => Object.values(arena.agents).filter((a) => a.type === t).sort((a, b) => b.firstAt - a.firstAt)[0]
  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-line bg-panel">
      <h2 className="px-4 pb-1 pt-4 text-sm font-semibold text-text">Team</h2>
      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        {types.map((t) => <Row key={t} type={t} agent={latest(t)} squad={squad} />)}
      </div>
      <button
        className="flex items-center justify-between border-t border-line px-4 py-3 text-sm font-semibold text-text hover:bg-panel-2"
        onClick={() => setOpen((o) => !o)} aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          Files
          <span className="rounded-md bg-panel-2 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted">{arena.files.length}</span>
        </span>
        <svg viewBox="0 0 16 16" className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}><path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className="max-h-[40%] overflow-y-auto px-2 pb-3">
          {!arena.files.length && <p className="px-2 py-2 text-sm text-faint">No files touched yet.</p>}
          {arena.files.map((f) => {
            const w = who(f.agentType, squad)
            return (
              <div key={`${f.agentId}:${f.path}`} className="flex items-center gap-2 rounded-lg px-2 py-1 text-[12px]" title={f.path}>
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${f.changed ? "bg-accent" : "bg-faint"}`} title={f.changed ? "Changed" : "Read"} />
                <span className={`min-w-0 flex-1 truncate font-mono ${f.changed ? "text-text" : "text-muted"}`}>{f.path}</span>
                <span className="shrink-0 text-[11px] font-medium" style={{ color: w.color }}>{w.name.replace(/ Agent$/, "")}</span>
              </div>
            )
          })}
        </div>
      )}
    </aside>
  )
}
