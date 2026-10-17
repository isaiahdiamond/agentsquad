import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import type { Squad } from "@agentsquad/shared"
import { Portrait } from "./Sprite"
import { ago, clock, who, type Arena } from "./store"

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

export function Rail({ arena, squad }: { arena: Arena; squad: Squad | null }) {
  const now = useNow()
  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-line bg-panel">
      <h2 className="px-4 pb-2 pt-4 text-xs font-semibold uppercase tracking-wider text-muted">Activity</h2>
      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        {!arena.feed.length && <p className="px-2 py-4 text-sm text-faint">Waiting for the squad to start...</p>}
        <AnimatePresence initial={false}>
          {arena.feed.map((f) => {
            const w = who(f.agentType, squad)
            return (
              <motion.div key={f.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 rounded-xl px-2 py-2.5 hover:bg-panel-2">
                <Portrait who={w} seed={f.agentType} size={36} className="rounded-lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 truncate text-[13px] font-semibold text-text">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: w.color }} />
                      {w.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-faint">{ago(now - f.at)}</span>
                  </div>
                  <p className="mt-0.5 text-[13px] leading-snug text-muted">{f.text}</p>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
      <h2 className="border-t border-line px-4 pb-2 pt-4 text-xs font-semibold uppercase tracking-wider text-muted">Files</h2>
      <div className="max-h-[32%] overflow-y-auto px-2 pb-3">
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
    </aside>
  )
}
