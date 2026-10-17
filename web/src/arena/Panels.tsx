import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import type { Squad } from "@agentsquad/shared"
import { GLASS, titleOf, useNow } from "./Hud"
import { Portrait } from "./Sprite"
import { ago, clock, who, type Agent, type Arena } from "./store"
import { nameOf } from "./world"

const CARD = `pointer-events-auto rounded-[14px] ${GLASS} text-[13px] text-text shadow-[0_16px_40px_rgba(0,0,0,.35)]`

function Close({ onClick }: { onClick: () => void }) {
  return (
    <button className="-mr-1 rounded-md p-1 text-muted transition-colors hover:text-text" onClick={onClick} aria-label="Close">
      <svg viewBox="0 0 16 16" className="h-4 w-4"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" /></svg>
    </button>
  )
}

// The agents the lead handed work to in this mission, in the order the delegations arrived.
export function delegated(arena: Arena) {
  return Object.values(arena.agents)
    .filter((a) => a.type !== "lead" && a.task && a.firstAt >= arena.promptAt - 500)
    .sort((a, b) => a.firstAt - b.firstAt)
}

export function Briefing({ arena, squad, onClose }: { arena: Arena; squad: Squad | null; onClose: () => void }) {
  const rows = delegated(arena)
  return (
    <motion.div
      className={`w-[340px] p-4 ${CARD}`}
      initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-muted">Mission briefing</span>
        <Close onClick={onClose} />
      </div>
      <p className="mt-1 text-[14px] font-semibold leading-snug">{arena.prompt ? titleOf(arena.prompt, 140) : "Waiting for a task"}</p>
      <div className="mt-3 flex flex-col gap-2.5">
        {!rows.length && <p className="text-muted">The lead is planning who takes what.</p>}
        <AnimatePresence initial={false}>
          {rows.map((a) => {
            const w = who(a.type, squad)
            return (
              <motion.div key={a.id} className="flex items-start gap-2.5" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                <Portrait who={w} seed={a.type} size={30} className="rounded-full ring-2" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: w.color }} />
                    {nameOf(a, arena, squad)}
                  </div>
                  <p className="leading-snug text-muted">{a.task}</p>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export function NeedsYou({ agent, arena, squad }: { agent: Agent; arena: Arena; squad: Squad | null }) {
  const w = who(agent.type, squad)
  const message = agent.waitText || (agent.narration && agent.narrationAt >= agent.sayAt - 500 ? agent.narration : "") || "Needs your permission to continue."
  return (
    <motion.div
      className={`flex w-[min(540px,90vw)] items-center gap-3 border-amber-300/70 p-3 pr-4 ${CARD}`}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.25 }}
    >
      <div className="relative shrink-0">
        <Portrait who={w} seed={agent.type} size={36} className="rounded-full ring-2 ring-amber-400" />
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[10px] font-extrabold text-[#0b0d12] ring-2 ring-[#0b0d12]">!</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{nameOf(agent, arena, squad)} is waiting for you</div>
        <p className="line-clamp-2 leading-snug text-muted" title={message}>{message}</p>
      </div>
      <span className="shrink-0 rounded-full bg-amber-400 px-2.5 py-1 text-[12px] font-semibold text-[#0b0d12]">Approve in your terminal</span>
    </motion.div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[20px] font-semibold tabular-nums">{value}</span>
      <span className="text-[12px] text-muted">{label}</span>
    </div>
  )
}

export function Complete({ arena, squad, finished, onClose, onReport, onReplay }: {
  arena: Arena; squad: Squad | null; finished: number; onClose: () => void; onReport: () => void; onReplay: () => void
}) {
  const agents = Object.values(arena.agents).sort((a, b) => a.order - b.order)
  const changed = new Set(arena.files.filter((f) => f.changed).map((f) => f.path)).size
  return (
    <motion.div
      className={`w-[min(460px,90vw)] p-5 ${CARD}`}
      initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[15px] font-semibold">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500">
            <svg viewBox="0 0 10 10" className="w-3"><path d="M2 5.2 L4.2 7.4 L8 2.8" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
          </span>
          Mission complete
        </span>
        <Close onClick={onClose} />
      </div>
      {arena.prompt && <p className="mt-1 leading-snug text-muted">{titleOf(arena.prompt, 120)}</p>}
      <div className="mt-4 grid grid-cols-3 rounded-xl bg-white/[0.04] py-3">
        <Stat label="Time" value={clock(finished - (arena.promptAt || arena.startAt))} />
        <Stat label="Files changed" value={changed} />
        <Stat label="Tool calls" value={arena.toolCount} />
      </div>
      <div className="mt-4 flex max-h-[38vh] flex-col gap-2.5 overflow-y-auto">
        {agents.map((a) => {
          const w = who(a.type, squad)
          const line = (a.report ?? "").split("\n")[0] || a.doneText || "Done."
          return (
            <div key={a.id} className="flex items-start gap-2.5">
              <Portrait who={w} seed={a.type} size={28} className="rounded-full" />
              <div className="min-w-0">
                <div className="font-semibold">{nameOf(a, arena, squad)}</div>
                <p className="leading-snug text-muted">{line}</p>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="rounded-full border border-white/[0.12] px-4 py-2 font-medium text-text transition-colors hover:border-accent" onClick={onReplay}>Replay</button>
        <button className="rounded-full bg-accent px-4 py-2 font-semibold text-on-accent transition-colors hover:bg-accent-strong" onClick={onReport}>View report</button>
      </div>
    </motion.div>
  )
}

export function LogDrawer({ arena, squad, onBriefing, onClose }: { arena: Arena; squad: Squad | null; onBriefing: () => void; onClose: () => void }) {
  const [tab, setTab] = useState<"activity" | "files">("activity")
  const now = useNow(1000)
  const tabClass = (t: string) => `rounded-full px-3 py-1 font-medium transition-colors ${tab === t ? "bg-white/[0.1] text-text" : "text-muted hover:text-text"}`
  return (
    <motion.div
      className={`flex h-full w-[360px] max-w-[calc(100vw-32px)] flex-col ${CARD}`}
      initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <div className="flex items-center gap-1 border-b border-white/[0.06] px-3 py-2.5">
        <button className={tabClass("activity")} onClick={() => setTab("activity")}>Activity</button>
        <button className={tabClass("files")} onClick={() => setTab("files")}>
          Files <span className="ml-1 tabular-nums text-faint">{arena.files.length}</span>
        </button>
        <span className="flex-1" />
        {arena.prompt && <button className="rounded-full px-2.5 py-1 text-[12px] text-muted transition-colors hover:text-text" onClick={onBriefing}>Briefing</button>}
        <Close onClick={onClose} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {tab === "activity" && !arena.feed.length && <p className="px-1 py-2 text-muted">Nothing yet. Activity shows up here as the squad works.</p>}
        {tab === "activity" && arena.feed.map((f) => {
          const w = who(f.agentType, squad)
          const a = arena.agents[f.agentId]
          return (
            <div key={f.id} className="flex items-start gap-2.5 rounded-lg px-1 py-2">
              <Portrait who={w} seed={f.agentType} size={24} className="mt-0.5 rounded-full" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[12px] font-semibold" style={{ color: w.color }}>{a ? nameOf(a, arena, squad) : w.name}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-faint">{ago(now - f.at)}</span>
                </div>
                <p className="leading-snug text-text/90">{f.text}</p>
              </div>
            </div>
          )
        })}
        {tab === "files" && !arena.files.length && <p className="px-1 py-2 text-muted">No files touched yet.</p>}
        {tab === "files" && arena.files.map((f) => {
          const w = who(f.agentType, squad)
          return (
            <div key={`${f.agentId}:${f.path}`} className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-[12px]" title={f.path}>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${f.changed ? "bg-accent" : "bg-faint"}`} title={f.changed ? "Changed" : "Read"} />
              <span className={`min-w-0 flex-1 truncate font-mono ${f.changed ? "text-text" : "text-muted"}`}>{f.path}</span>
              <span className="shrink-0 text-[11px] font-medium" style={{ color: w.color }}>{w.name.replace(/ Agent$/, "")}</span>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
