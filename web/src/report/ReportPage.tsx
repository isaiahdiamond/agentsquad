import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Portrait } from "../arena/Sprite"
import { activeMs, clearReport, clock, loadReport, who } from "../arena/store"

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between font-pixel text-[10px]">
      <span className="text-slate-400">{label}</span>
      <span className="text-gold-300">{value}</span>
    </div>
  )
}

export default function ReportPage() {
  const navigate = useNavigate()
  const [report] = useState(loadReport)
  const [note, setNote] = useState("")

  const newTask = () => {
    clearReport()
    navigate("/arena")
  }
  const replay = async () => {
    try {
      let file = report?.arena.sessionId ? `${report.arena.sessionId}.jsonl` : undefined
      if (!file) {
        const runs: { file: string }[] = await fetch("/api/runs").then((r) => r.json())
        file = runs[0]?.file
      }
      if (!file) return setNote("No recorded runs yet.")
      navigate(`/arena?replay=${encodeURIComponent(file)}`)
    } catch {
      setNote("Could not reach the server.")
    }
  }

  if (!report) {
    return (
      <main className="flex min-h-[80vh] flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="panel px-10 py-8">
          <h1 className="font-pixel text-lg text-gold-400">No report yet</h1>
          <p className="mt-4 max-w-sm font-ui text-sm text-slate-300">Run a task in the Arena. When the squad finishes, the report shows up here.</p>
        </div>
        <button className="btn-gold text-xs" onClick={newTask}>Go to Arena</button>
      </main>
    )
  }

  const { arena, squad } = report
  const agents = Object.values(arena.agents).sort((a, b) => a.order - b.order)
  const mvp = [...agents].sort((a, b) => b.changed.length - a.changed.length || b.tools - a.tools)[0]
  const mvpId = mvp && mvp.changed.length > 0 ? mvp.id : null
  const start = arena.startAt
  const end = Math.max(arena.endAt, ...agents.map((a) => a.lastAt))
  const total = Math.max(1, end - start)
  const ticks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <main className="min-h-[calc(100vh-36px)] bg-[radial-gradient(ellipse_at_top,#1d3060_0%,#070d1f_70%)] px-6 py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="panel px-6 py-5 text-center">
          <h1 className="font-pixel text-2xl text-gold-400 drop-shadow-[3px_3px_0_#000] sm:text-4xl">Task complete</h1>
          {arena.prompt && <p className="mt-3 font-ui text-sm text-slate-300">"{arena.prompt}"</p>}
          <p className="mt-2 font-pixel text-[9px] text-slate-400">
            {clock(total)} total · {arena.toolCount} tool calls · {new Set(arena.files.filter((f) => f.changed).map((f) => f.path)).size} files changed
          </p>
        </motion.header>

        <section className="flex flex-wrap justify-center gap-4">
          {agents.map((a, i) => {
            const w = who(a.type, squad)
            const isMvp = a.id === mvpId
            return (
              <motion.article
                key={a.id} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.05, duration: 0.3 }}
                className={`panel relative flex w-[200px] flex-col gap-3 p-4 ${isMvp ? "ring-4 ring-gold-400/60" : ""}`}
              >
                {isMvp && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 border-2 border-black bg-gold-400 px-3 py-1 font-pixel text-[10px] text-navy-950 shadow-[2px_2px_0_#000]">
                    ★ MVP
                  </div>
                )}
                <Portrait who={w} seed={a.type} className="mx-auto h-24 w-24" />
                <div className="border-2 border-black px-2 py-1 text-center font-pixel text-[10px] text-white" style={{ background: w.color }}>
                  {w.name}
                </div>
                <p className="text-center font-ui text-[11px] text-slate-400">{w.role}</p>
                <div className="flex flex-col gap-2 border-y-2 border-navy-700 py-2">
                  <Stat label="CHANGED" value={a.changed.length} />
                  <Stat label="READ" value={a.files.filter((f) => !a.changed.includes(f)).length} />
                  <Stat label="TOOLS" value={a.tools} />
                  <Stat label="TIME" value={clock(activeMs(a, arena))} />
                </div>
                <p className="whitespace-pre-line font-ui text-[11px] leading-snug text-slate-200">
                  {a.report || a.doneText || a.narration || "No summary."}
                </p>
                {a.files.length > 0 && (
                  <ul className="font-ui text-[10px] text-slate-400">
                    {a.files.map((f) => (
                      <li key={f} className="truncate" title={f}>
                        <span className={a.changed.includes(f) ? "text-gold-400" : ""}>{a.changed.includes(f) ? "✎ " : "◦ "}</span>{f}
                      </li>
                    ))}
                  </ul>
                )}
              </motion.article>
            )
          })}
        </section>

        <section className="panel p-5">
          <h2 className="font-pixel text-[11px] text-gold-400">Activity timeline</h2>
          <div className="relative mt-4 border-2 border-black bg-navy-950" style={{ height: Math.max(28, agents.length * 10 + 8) }}>
            {arena.spans.map((s, i) => {
              const lane = agents.findIndex((a) => a.id === s.agentId)
              const left = ((s.start - start) / total) * 100
              const width = Math.max(0.6, ((s.end - s.start) / total) * 100)
              const color = who(agents[lane]?.type ?? "", squad).color
              return (
                <motion.div
                  key={i} className="absolute h-[8px]"
                  initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.4 + (left / 100) * 0.8, duration: 0.2 }}
                  style={{ left: `${left}%`, width: `${width}%`, top: 4 + lane * 10, background: color, originX: 0 }}
                />
              )
            })}
          </div>
          <div className="relative mt-1 h-4 font-pixel text-[8px] text-slate-400">
            {ticks.map((t) => (
              <span key={t} className="absolute" style={{ left: `${t * 100}%`, translate: `${-t * 100}% 0` }}>
                {clock(total * t)}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-4 font-ui text-xs text-slate-300">
            {agents.map((a) => {
              const w = who(a.type, squad)
              return (
                <span key={a.id} className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 border border-black" style={{ background: w.color }} />
                  {w.name}{a.id === mvpId ? " (MVP)" : ""}
                </span>
              )
            })}
          </div>
        </section>

        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-6">
            <button className="btn text-xs" onClick={replay}>↻ Replay</button>
            <button className="btn-gold text-xs" onClick={newTask}>▶ New task</button>
          </div>
          {note && <p className="font-ui text-xs text-slate-400">{note}</p>}
        </div>
      </div>
    </main>
  )
}
