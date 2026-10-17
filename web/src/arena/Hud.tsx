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

function Chip({ children }: { children: React.ReactNode }) {
  return <div className="panel flex items-center gap-2 px-3 py-2 font-pixel text-[10px] text-gold-300">{children}</div>
}

export function TopBar({ arena, squad, title, connected }: { arena: Arena; squad: Squad | null; title: string; connected: boolean }) {
  const now = useNow()
  const elapsed = arena.startAt ? (arena.endAt || now) - arena.startAt : 0
  const active = Object.values(arena.agents).filter((a) => !a.doneAt)
  return (
    <div className="flex shrink-0 flex-wrap items-stretch gap-2 bg-navy-950 px-3 py-2">
      <Chip>
        <span className={`inline-block h-2 w-2 ${connected ? "bg-green-400" : "bg-red-500"}`} title={connected ? "live" : "reconnecting"} />
        {title}
      </Chip>
      <Chip><span className="text-slate-400">TIME</span> {clock(elapsed)}</Chip>
      <Chip><span className="text-slate-400">TOOL CALLS</span> {arena.toolCount}</Chip>
      <Chip>
        <span className="text-slate-400">ACTIVE</span> {active.length}
        <span className="flex gap-1">
          {active.map((a) => <Portrait key={a.id} who={who(a.type, squad)} seed={a.type} className="h-5 w-5 border" />)}
        </span>
      </Chip>
    </div>
  )
}

export function Rail({ arena, squad }: { arena: Arena; squad: Squad | null }) {
  const now = useNow()
  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l-[3px] border-gold-600 bg-navy-900">
      <h2 className="border-b-2 border-navy-700 px-4 py-3 font-pixel text-[11px] text-gold-400">Activity Feed</h2>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!arena.feed.length && <p className="px-4 py-6 font-ui text-xs text-slate-500">Waiting for the squad to start...</p>}
        <AnimatePresence initial={false}>
          {arena.feed.map((f) => {
            const w = who(f.agentType, squad)
            return (
              <motion.div
                key={f.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                className="flex gap-3 border-b border-navy-700 px-4 py-3"
              >
                <Portrait who={w} seed={f.agentType} className="h-9 w-9 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-pixel text-[9px]" style={{ color: w.color }}>{w.name}</span>
                    <span className="shrink-0 font-ui text-[10px] text-slate-500">{ago(now - f.at)}</span>
                  </div>
                  <p className="mt-1 font-ui text-[11px] leading-snug text-sky-200">{f.text}</p>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
      <h2 className="border-y-2 border-navy-700 px-4 py-3 font-pixel text-[11px] text-gold-400">Files</h2>
      <div className="max-h-[32%] overflow-y-auto pb-2">
        {!arena.files.length && <p className="px-4 py-3 font-ui text-xs text-slate-500">No files touched yet.</p>}
        {arena.files.map((f) => {
          const w = who(f.agentType, squad)
          return (
            <div key={`${f.agentId}:${f.path}`} className="flex items-center gap-2 px-4 py-1 font-ui text-[11px]" title={f.path}>
              <span className={`w-3 shrink-0 text-center ${f.changed ? "text-gold-400" : "text-slate-500"}`}>{f.changed ? "✎" : "◦"}</span>
              <span className="min-w-0 flex-1 truncate text-slate-200">{f.path}</span>
              <span className="shrink-0 font-pixel text-[8px]" style={{ color: w.color }}>{w.name.replace(/ Agent$/, "")}</span>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
