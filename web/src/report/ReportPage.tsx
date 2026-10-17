import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Portrait } from "../arena/Sprite"
import { activeMs, clearReport, clock, loadReport, who } from "../arena/store"

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-xl bg-panel-2 px-2 py-2">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="text-base font-semibold tabular-nums text-text">{value}</div>
    </div>
  )
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-6">
      <span className="text-2xl font-semibold tabular-nums text-text">{value}</span>
      <span className="text-xs text-muted">{label}</span>
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
      <main className="flex min-h-[80vh] flex-col items-center justify-center gap-6 bg-bg p-6 text-center">
        <div className="card px-10 py-8">
          <h1 className="text-xl font-semibold text-text">No report yet</h1>
          <p className="mt-2 max-w-sm text-sm text-muted">Run a task in the Arena. When the squad finishes, the report shows up here.</p>
        </div>
        <button className="btn-primary" onClick={newTask}>Go to Arena</button>
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
  const changed = new Set(arena.files.filter((f) => f.changed).map((f) => f.path)).size

  return (
    <main className="min-h-[calc(100vh-36px)] bg-bg px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <motion.header initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="card flex flex-col items-center gap-5 px-6 py-7 text-center">
          <div className="flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Task complete
          </div>
          {arena.prompt ? <h1 className="max-w-3xl text-2xl font-semibold leading-snug text-text sm:text-3xl">{arena.prompt}</h1> : <h1 className="text-3xl font-semibold text-text">Match report</h1>}
          <div className="flex flex-wrap justify-center divide-x divide-line">
            <Summary label="Total time" value={clock(total)} />
            <Summary label="Tool calls" value={arena.toolCount} />
            <Summary label="Files changed" value={changed} />
            <Summary label="Agents" value={agents.length} />
          </div>
        </motion.header>

        <section className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
          {agents.map((a, i) => {
            const w = who(a.type, squad)
            const isMvp = a.id === mvpId
            return (
              <motion.article
                key={a.id} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.05, duration: 0.3 }}
                className={`card relative flex flex-col gap-4 p-5 ${isMvp ? "border-accent/60 shadow-[0_0_0_1px_rgba(90,143,230,.35)]" : ""}`}
              >
                {isMvp && (
                  <div className="absolute right-4 top-4 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-on-accent">MVP</div>
                )}
                <div className="flex items-center gap-3">
                  <Portrait who={w} seed={a.type} size={64} className="rounded-xl" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[15px] font-semibold text-text">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: w.color }} />
                      <span className="truncate">{w.name}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">{w.role}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="Changed" value={a.changed.length} />
                  <Stat label="Read" value={a.files.filter((f) => !a.changed.includes(f)).length} />
                  <Stat label="Tools" value={a.tools} />
                  <Stat label="Time" value={clock(activeMs(a, arena))} />
                </div>
                <p className="whitespace-pre-line text-[13px] leading-relaxed text-text/90">
                  {a.report || a.doneText || a.narration || "No summary."}
                </p>
                {a.files.length > 0 && (
                  <ul className="flex flex-col gap-1 border-t border-line pt-3">
                    {a.files.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs" title={f}>
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${a.changed.includes(f) ? "bg-accent" : "bg-faint"}`} />
                        <span className={`truncate font-mono ${a.changed.includes(f) ? "text-text" : "text-muted"}`}>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.article>
            )
          })}
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text">Activity timeline</h2>
          <div className="relative mt-4 flex gap-4">
            <div className="flex shrink-0 flex-col gap-1.5">
              {agents.map((a) => (
                <div key={a.id} className="flex h-5 items-center gap-2 text-xs text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: who(a.type, squad).color }} />
                  {who(a.type, squad).name}{a.id === mvpId ? " (MVP)" : ""}
                </div>
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <div className="relative flex flex-col gap-1.5">
                {agents.map((a) => (
                  <div key={a.id} className="relative h-5 overflow-hidden rounded-md bg-panel-2">
                    {arena.spans.filter((s) => s.agentId === a.id).map((s, i) => {
                      const left = ((s.start - start) / total) * 100
                      const width = Math.max(0.6, ((s.end - s.start) / total) * 100)
                      return (
                        <motion.div
                          key={i} className="absolute inset-y-1 rounded-[3px]"
                          initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.4 + (left / 100) * 0.8, duration: 0.2 }}
                          style={{ left: `${left}%`, width: `${width}%`, background: who(a.type, squad).color, originX: 0 }}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
              <div className="relative mt-2 h-4 text-[11px] tabular-nums text-faint">
                {ticks.map((t) => (
                  <span key={t} className="absolute" style={{ left: `${t * 100}%`, translate: `${-t * 100}% 0` }}>
                    {clock(total * t)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-3">
            <button className="btn-secondary" onClick={replay}>Replay</button>
            <button className="btn-primary" onClick={newTask}>New task</button>
          </div>
          {note && <p className="text-sm text-muted">{note}</p>}
        </div>
      </div>
    </main>
  )
}
