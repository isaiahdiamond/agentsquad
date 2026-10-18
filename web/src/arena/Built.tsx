import { useEffect, useState } from "react"
import type { Squad } from "@agentsquad/shared"
import { copyText } from "./Hud"
import { Portrait } from "./Sprite"
import { who, type Arena, type BuildResult, type MissionResult, type ServerState } from "./store"
import { nameOf } from "./world"

export type Built = { full: BuildResult | null; quick: MissionResult | null; loaded: boolean }

// GET /result for this session, with /state live.mission.result as the quick fallback. The lead's agent_done
// can land a moment before the server writes the result, so a miss is retried a few times; `key` refetches
// (REPORT lines can add URLs after the mission ends).
export function useBuilt(sessionId: string | undefined, key = 0): Built {
  const [built, setBuilt] = useState<Built>({ full: null, quick: null, loaded: false })
  useEffect(() => {
    let alive = true
    let tries = 0
    let t: ReturnType<typeof setTimeout>
    const load = async () => {
      const [full, state] = await Promise.all([
        fetch("/api/result").then((r) => (r.ok ? r.json() : null)).catch(() => null) as Promise<BuildResult | null>,
        fetch("/api/state").then((r) => r.json()).catch(() => null) as Promise<ServerState | null>,
      ])
      if (!alive) return
      const mine = full && (!sessionId || full.sessionId === sessionId) ? full : null
      const live = state?.live
      const quick = live && (!sessionId || live.sessionId === sessionId) ? live.mission?.result ?? null : null
      setBuilt((prev) => ({ full: mine ?? prev.full, quick: quick ?? prev.quick, loaded: true }))
      if (!mine && ++tries < 6) t = setTimeout(load, 1000)
    }
    load()
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [sessionId, key])
  return built
}

function Copy({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-muted transition-colors hover:bg-white/[0.08] hover:text-text"
      onClick={async () => {
        await copyText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      aria-label={`Copy ${text}`} title={`Copy ${text}`}
    >
      {copied ? "Copied" : label}
    </button>
  )
}

function Command({ text, shown = text }: { text: string; shown?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1 rounded-lg border border-line-strong bg-black/40 py-1 pl-2.5 pr-1">
      <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-text" title={text}>{shown}</code>
      <Copy text={text} />
    </div>
  )
}

function Arrow() {
  return <svg viewBox="0 0 12 12" className="h-3 w-3"><path d="M4 2h6v6M10 2 3 9" stroke="currentColor" strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function Primary({ href, label, note }: { href: string; label: string; note: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <a className="btn-primary shrink-0 px-4 py-2 text-[13px]" href={href} target="_blank" rel="noreferrer">{label} <Arrow /></a>
      <span className="min-w-0 truncate font-mono text-[12px] text-muted" title={note}>{note}</span>
    </div>
  )
}

const quote = (p: string) => (/[\s'"$]/.test(p) ? JSON.stringify(p) : p)
const shell = (run: { command: string; cwd: string }) => `cd ${quote(run.cwd)} && ${run.command}`
// "/var/folders/…/report-result/target" → "…/report-result/target", so the command after it stays visible.
const short = (p: string) => (p.length > 28 ? `…/${p.split("/").filter(Boolean).slice(-2).join("/")}` : p)

export function WhatWasBuilt({ built, arena, squad, page = false }: { built: Built; arena: Arena; squad: Squad | null; page?: boolean }) {
  const { full, quick, loaded } = built
  if (!full && !quick) return loaded ? null : <p className="text-[12px] text-muted">Checking what was built…</p>

  if (!full && quick) {
    return (
      <div className="flex flex-col gap-2.5">
        <h3 className="text-[12px] font-medium text-muted">What was built</h3>
        {quick.url ? <Primary href={quick.url} label="Open it" note={quick.url} />
          : quick.preview ? <Primary href={quick.preview} label="Preview" note="Static preview of the page" />
          : quick.run ? <div className="flex flex-col gap-1"><span className="text-[12px] text-muted">Run it</span><Command text={quick.run} /></div>
          : null}
        <p className="text-[12px] text-muted">{quick.files ? `${quick.files} file${quick.files === 1 ? "" : "s"} changed` : "No files changed"}</p>
      </div>
    )
  }

  const r = full!
  const up = r.urls.find((u) => u.up)
  const down = r.urls.filter((u) => u.up === false)
  const groups: { agentId: string; files: BuildResult["files"] }[] = []
  for (const f of r.files) {
    const g = groups.find((x) => x.agentId === f.agentId)
    if (g) g.files.push(f)
    else groups.push({ agentId: f.agentId, files: [f] })
  }
  const runShown = r.run && (page ? shell(r.run) : `cd ${quote(short(r.run.cwd))} && ${r.run.command}`)
  const runFirst = !up && !r.preview && !!r.run
  const previewNote = `${r.preview?.dir ? r.preview.dir + "/" : ""}${r.preview?.entry ?? ""}`

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className={`shrink-0 ${page ? "text-sm font-semibold text-text" : "text-[12px] font-medium text-muted"}`}>What was built</h3>
        <span className="flex min-w-0 items-center gap-1 text-[11px] text-faint">
          <code className="min-w-0 truncate font-mono" title={r.target}>{page ? r.target : short(r.target)}</code>
          <Copy text={r.target} />
        </span>
      </div>

      {up ? <Primary href={up.url} label="Open it" note={up.url} />
        : r.preview ? <Primary href={r.preview.url} label="Preview" note={previewNote} />
        : r.run ? (
          <div className="flex flex-col gap-1">
            <span className="text-[12px] text-muted">{r.run.ran ? "Claude started it with" : "Run it"}</span>
            <Command text={shell(r.run)} shown={runShown!} />
          </div>
        ) : null}

      {down.map((u) => (
        <div key={u.url} className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-muted">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-faint" />
            <span className="min-w-0 truncate font-mono text-[12px] text-faint" title={u.url}>{u.url}</span>
            <span className="shrink-0">not running</span>
          </div>
          {r.run && (
            <div className="flex min-w-0 items-center gap-1.5 pl-3.5">
              <span className="shrink-0">start it with</span>
              <code className="min-w-0 truncate font-mono text-text/80" title={shell(r.run)}>{r.run.command}</code>
              {!runFirst && <Copy text={shell(r.run)} />}
            </div>
          )}
        </div>
      ))}

      {page && r.preview && !up && (
        <iframe
          src={r.preview.url} title="Preview"
          sandbox="allow-scripts allow-forms allow-popups allow-modals"
          className="h-[440px] w-full rounded-xl border border-line bg-white"
        />
      )}

      {!r.files.length ? <p className="text-[12px] text-muted">No files changed</p> : (
        <div className={`flex flex-col gap-2.5 ${page ? "" : "max-h-[22vh] overflow-y-auto pr-1"}`}>
          {groups.map((g) => {
            const a = arena.agents[g.agentId]
            const type = a?.type ?? (g.agentId === "lead" ? "lead" : g.agentId)
            const w = who(type, squad)
            return (
              <div key={g.agentId} className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-[12px] font-semibold">
                  <Portrait who={w} seed={type} size={20} className="rounded-full" />
                  {a ? nameOf(a, arena, squad) : w.name}
                </div>
                <ul className="flex flex-col gap-0.5 pl-7">
                  {g.files.map((f) => (
                    <li key={f.path} className="flex items-center gap-2 text-[12px]" title={f.path}>
                      <span className="min-w-0 flex-1 truncate font-mono text-text/90">{f.path}</span>
                      <span className={`shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium ${f.action === "created" ? "bg-accent text-on-accent" : "border border-line-strong text-muted"}`}>
                        {f.action}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
