import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import type { Character, Scene, Squad } from "@agentsquad/shared"
import { saveSquad, type Draft } from "./draft"
import { roster } from "./roster"
import LeadPreview from "./LeadPreview"
import Portrait from "./Portrait"
import ArtImage from "../ui/ArtImage"

type DeployedFile = { path: string; content: string }

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

  useEffect(() => {
    fetch("/art/scenes/scenes.json")
      .then((r) => r.json())
      .then((all: Scene[]) => setScenes(all.filter((s) => s.kind === "map" || !s.id.startsWith("interior-"))))
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
      const body = await res.json().catch(() => null)
      if (!body && res.status >= 500) throw new Error("Failed to fetch")
      if (!res.ok) throw new Error(body?.error ?? `server answered ${res.status}`)
      saveSquad(squad)
      setFiles(Array.isArray(body?.files) ? body.files : [])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg === "Failed to fetch" ? "Can't reach the AgentSquad server. Start it with npm run dev and try again." : `Deploy failed: ${msg}`)
    } finally {
      setDeploying(false)
    }
  }

  const members = draft.members.flatMap((m) => {
    const c = roster.find((r) => r.id === m.id)
    return c ? [{ c, model: m.model }] : []
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-5">
        {scenes.map((s) => {
          const selected = s.id === draft.scene
          return (
            <motion.button
              key={s.id}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => update({ scene: s.id })}
              className={`flex flex-col bg-navy-900 p-2 ${selected ? "panel" : "border-3 border-navy-500 shadow-[4px_4px_0_#000] hover:border-gold-600"}`}
              style={selected ? { boxShadow: "0 0 30px rgba(245,197,66,0.45), 4px 4px 0 #000" } : undefined}
            >
              <ArtImage src={s.background} label={s.name.toUpperCase()} color={s.kind === "map" ? "#1f5135" : "#1d3060"} className="aspect-[16/10] w-full object-cover" />
              <span className={`mt-2 py-2 text-center font-pixel text-sm ${selected ? "text-gold-400" : "text-slate-300"}`}>
                {s.name.toUpperCase()}
              </span>
              <span className="pb-1 text-center font-ui text-xs text-slate-500">
                {s.kind === "map" ? "Map with buildings to click into" : "Single room"}
              </span>
            </motion.button>
          )
        })}
      </div>

      <div className="panel flex items-center gap-6 px-6 py-4">
        <p className="w-32 shrink-0 font-pixel text-[11px] text-gold-300">YOUR SQUAD</p>
        <div className="flex flex-col items-center">
          <div className="flex h-24 items-end overflow-hidden">{draft.look && <LeadPreview look={draft.look} height={90} />}</div>
          <span className="font-pixel text-[8px] text-gold-400">{draft.name.toUpperCase()}</span>
          <span className="font-ui text-[11px] text-slate-500">lead</span>
        </div>
        {members.map(({ c, model }) => (
          <div key={c.id} className="flex flex-col items-center">
            <Portrait c={c} className="h-24 w-24 border-2 border-black" />
            <span className="mt-1 font-pixel text-[8px]" style={{ color: c.color }}>
              {c.name.replace(" Agent", "").toUpperCase()}
            </span>
            <span className="font-ui text-[11px] text-slate-500">{model}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-6">
        <motion.button whileTap={{ scale: 0.96 }} onClick={back} className="btn text-xs">
          &lt; BACK
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          onClick={deploy}
          disabled={deploying || members.length === 0 || !scenes.some((s) => s.id === draft.scene)}
          className="btn-gold px-12 text-lg"
        >
          {deploying ? "DEPLOYING..." : "DEPLOY SQUAD"}
        </motion.button>
      </div>
      {error && <p className="mx-auto border-2 border-red-500 bg-red-950 px-4 py-2 font-ui text-sm text-red-200">{error}</p>}

      <AnimatePresence>
        {files && <FilesModal files={files} onClose={() => setFiles(null)} onArena={() => navigate("/arena")} />}
      </AnimatePresence>
    </div>
  )
}

function FilesModal({ files, onClose, onArena }: { files: DeployedFile[]; onClose: () => void; onArena: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-8"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="panel flex max-h-full w-full max-w-4xl flex-col gap-4 p-6"
      >
        <h2 className="font-pixel text-lg text-gold-400">SQUAD DEPLOYED</h2>
        {files.length === 0 ? (
          <p className="font-ui text-sm text-slate-300">
            The server reported no written files. If this is unexpected, check that the AgentSquad server has a target project set.
          </p>
        ) : (
          <>
            <p className="font-ui text-sm text-slate-300">
              {files.length} file{files.length === 1 ? "" : "s"} written to your project. Open a terminal there, run <code className="text-gold-300">claude</code>, and give it a task.
            </p>
            <div className="flex-1 space-y-4 overflow-auto pr-2">
              {files.map((f) => (
                <div key={f.path} className="panel-quiet">
                  <p className="border-b-2 border-navy-500 bg-navy-800 px-3 py-2 font-mono text-xs text-gold-300">{f.path}</p>
                  <pre className="max-h-72 overflow-auto p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-slate-200">{f.content}</pre>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn text-xs">
            CLOSE
          </button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={onArena} className="btn-gold text-sm">
            GO TO ARENA &gt;
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}
