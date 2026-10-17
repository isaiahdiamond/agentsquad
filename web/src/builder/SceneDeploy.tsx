import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import type { Character, Scene, Squad } from "@agentsquad/shared"
import { saveSquad, type Draft } from "./draft"
import { roster } from "./roster"
import { spriteSet, useSprites } from "../ui/sprites"
import Portrait from "./Portrait"
import ArtImage from "../ui/ArtImage"
import { ArrowRight, BackButton, Progress } from "./parts"

type DeployedFile = { path: string; content: string }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function buildSquad(draft: Draft): Squad {
  const members = draft.members.flatMap((m) => {
    const c = roster.find((r) => r.id === m.id)
    return c ? [{ ...c, model: m.model }] : []
  })
  const name = draft.name.trim() || "Lead Agent"
  const team = members.map((m) => `- ${m.id} (${m.name}): ${m.description}`).join("\n")
  const reviewer = members.some((m) => m.id === "reviewer") ? " Always have reviewer check changes before you finish." : ""
  const lead: Character = {
    id: "lead",
    name,
    role: "Lead",
    isLead: true,
    look: draft.look,
    portrait: "",
    color: "#f5c542",
    stats: { speed: 50, rigor: 50, creativity: 50 },
    tools: [],
    model: "inherit",
    description: "The main agent. Plans the task and delegates to the team.",
    prompt: `You are ${name}, the lead of this squad. Plan the task, then delegate each part to the teammate whose job it is, by name. Do small glue work yourself only when no teammate fits.${reviewer}\n\nYour team:\n${team}`,
  }
  return { lead, members, scene: draft.scene }
}

type Props = { draft: Draft; update: (p: Partial<Draft>) => void; back: () => void }

export default function SceneDeploy({ draft, update, back }: Props) {
  const navigate = useNavigate()
  const [scenes, setScenes] = useState<Scene[]>([])
  const [deploying, setDeploying] = useState(false)
  const [error, setError] = useState("")
  const [files, setFiles] = useState<DeployedFile[] | null>(null)
  const [filesOpen, setFilesOpen] = useState(false)
  const filesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!filesOpen) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFilesOpen(false)
    const onDown = (e: PointerEvent) => !filesRef.current?.contains(e.target as Node) && setFilesOpen(false)
    window.addEventListener("keydown", onKey)
    window.addEventListener("pointerdown", onDown)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("pointerdown", onDown)
    }
  }, [filesOpen])

  useEffect(() => {
    fetch("/art/scenes/scenes.json")
      .then((r) => r.json())
      .then((all: Scene[]) => {
        const interiors = new Set(all.flatMap((s) => s.buildings?.map((b) => b.interior) ?? []))
        const pickable = all.filter((s) => s.kind === "map" || (s.kind === "room" && !interiors.has(s.id)))
        setScenes(pickable)
        if (pickable.length && !pickable.some((s) => s.id === draft.scene)) update({ scene: pickable[0].id })
      })
      .catch(() => setError("Could not load scenes.json"))
  }, [])

  const deploy = async () => {
    setDeploying(true)
    setError("")
    try {
      const squad = buildSquad(draft)
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(squad),
      })
      if (res.status === 502 || res.status === 504) throw new TypeError("unreachable")
      const text = await res.text()
      let body: { files?: DeployedFile[]; error?: string } | null = null
      try {
        body = JSON.parse(text)
      } catch {}
      if (!res.ok) throw new Error(`server answered ${res.status}: ${body?.error ?? (text.slice(0, 200) || res.statusText)}`)
      saveSquad(squad)
      setFiles(Array.isArray(body?.files) ? body.files : [])
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Can't reach the AgentSquad server. Start it with npm run dev and try again."
          : `Deploy failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setDeploying(false)
    }
  }

  const members = draft.members.flatMap((m) => {
    const c = roster.find((r) => r.id === m.id)
    return c ? [{ c, model: m.model }] : []
  })
  const { sprites } = useSprites()
  const lead = { name: draft.name.trim() || "Lead Agent", color: "#f5c542", portrait: spriteSet(sprites, "lead", draft.look)?.front ?? "" }
  const planned = [
    ...members.map(({ c }) => `.claude/agents/${c.id}.md`),
    "CLAUDE.md (team section)",
    ".claude/settings.local.json (hooks)",
  ]

  return (
    <div className="mx-auto flex min-h-screen max-w-[1360px] flex-col px-6 pt-7 pb-10 md:px-11">
      <div className="relative flex items-center justify-center">
        <div className="absolute left-0">
          <BackButton onClick={back} />
        </div>
        <Progress step="scene" className="items-center" />
      </div>

      <h1 className="mt-6 text-[40px] leading-tight font-semibold tracking-[-0.02em] text-white">Pick a scene</h1>
      <p className="mt-1 text-[18px] text-muted">Where your team works while Claude Code runs.</p>

      <div className="mt-8 grid grid-cols-3 gap-6">
        {scenes.map((s) => {
          const selected = s.id === draft.scene
          return (
            <motion.button
              key={s.id}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => update({ scene: s.id })}
              aria-pressed={selected}
              className={`group relative h-[min(540px,calc(100vh-400px))] min-h-[200px] overflow-hidden rounded-[var(--radius-card)] border text-left transition-shadow ${
                selected ? "border-accent shadow-[0_0_0_3px_var(--color-accent),0_0_36px_6px_rgba(139,124,246,0.45)]" : "border-line hover:border-line-strong"
              }`}
            >
              <ArtImage
                src={s.background}
                label={s.name}
                color={s.kind === "map" ? "#1f3a2c" : "#1d2540"}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
              <div className="absolute bottom-5 left-6">
                <p className="text-[22px] font-semibold text-white">{s.name.replace(/^The /, "")}</p>
                <p className="mt-0.5 text-[13px] text-white/60">{s.kind === "map" ? "Map with buildings to walk into" : "Single room"}</p>
              </div>
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="alert"
            className="mt-6 self-end rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-[14px] text-red-300"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
      <div className={`card relative flex items-center gap-6 px-6 py-4 ${error ? "mt-3" : "mt-8"}`}>
        <div className="flex gap-3">
          {[{ c: lead, model: "lead" }, ...members].map(({ c, model }, i) => (
            <div key={i} className="flex flex-col items-center gap-1" title={c.name}>
              <Portrait c={c} scale={1} top={3} className="h-11 w-11 rounded-full" />
              <span className="text-[11px] font-medium text-faint">{cap(model)}</span>
            </div>
          ))}
        </div>
        <div className="h-8 w-px bg-line" />
        <p className="text-[16px] font-medium text-white">
          {lead.name} + {members.length} agent{members.length === 1 ? "" : "s"}
        </p>
        <div className="h-8 w-px bg-line" />
        <div ref={filesRef} className="relative">
          <button
            onClick={() => setFilesOpen((v) => !v)}
            aria-expanded={filesOpen}
            className="flex items-center gap-2 font-mono text-[13px] text-muted transition-colors hover:text-text"
          >
            {planned.length} files will be written
            <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 transition-transform ${filesOpen ? "" : "rotate-180"}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10l4-4 4 4" />
            </svg>
          </button>
          <AnimatePresence>
            {filesOpen && (
              <motion.ul
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15 }}
                className="card absolute bottom-full left-0 z-20 mb-3 w-max min-w-72 space-y-1.5 p-4 font-mono text-[12.5px] text-text shadow-2xl shadow-black/60"
              >
                {planned.map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <span className="h-1 w-1 rounded-full bg-accent" />
                    {f}
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={deploy}
          disabled={deploying || members.length === 0 || !scenes.some((s) => s.id === draft.scene)}
          className="btn-primary ml-auto h-12 min-w-48 rounded-xl! text-[15px]!"
        >
          {deploying ? "Deploying..." : "Deploy squad"}
        </motion.button>
      </div>

      <AnimatePresence>
        {files && <FilesModal files={files} onClose={() => setFiles(null)} onArena={() => navigate("/arena")} />}
      </AnimatePresence>
    </div>
  )
}

function FilesModal({ files, onClose, onArena }: { files: DeployedFile[]; onClose: () => void; onArena: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="card flex max-h-full w-full max-w-4xl flex-col gap-5 p-7 shadow-2xl shadow-black/60"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 8.5l3 3 6-7" />
            </svg>
          </span>
          <h2 className="text-[22px] font-semibold tracking-tight text-white">Squad deployed</h2>
        </div>
        {files.length === 0 ? (
          <p className="text-[14px] text-muted">
            The server reported no written files. If this is unexpected, check that the AgentSquad server has a target project set.
          </p>
        ) : (
          <>
            <p className="text-[14px] text-muted">
              {files.length} file{files.length === 1 ? "" : "s"} written to your project. Open a terminal there, run{" "}
              <code className="rounded bg-panel-2 px-1.5 py-0.5 text-text">claude</code>, and give it a task.
            </p>
            <div className="flex-1 space-y-3 overflow-auto pr-1">
              {files.map((f) => (
                <div key={f.path} className="overflow-hidden rounded-xl border border-line bg-bg">
                  <p className="border-b border-line bg-panel-2 px-4 py-2 font-mono text-[12px] text-accent">{f.path}</p>
                  <pre className="max-h-72 overflow-auto p-4 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-muted">{f.content}</pre>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
          <button onClick={onArena} className="btn-primary">
            Go to Arena <ArrowRight />
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
