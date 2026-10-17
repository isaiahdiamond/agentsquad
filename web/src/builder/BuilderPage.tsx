import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { emptyDraft, loadDraft, saveDraft, STEPS, type Draft, type Step } from "./draft"
import { useLookManifest } from "./LeadPreview"
import TitleScreen from "./TitleScreen"
import CreateLead from "./CreateLead"
import DraftSquad from "./DraftSquad"
import SceneDeploy from "./SceneDeploy"

const STEP_LABELS = { lead: "Create Lead", squad: "Squad", scene: "Scene & Deploy" }

export default function BuilderPage() {
  const [draft, setDraft] = useState<Draft>(loadDraft)
  const { manifest, error: manifestError } = useLookManifest()

  useEffect(() => saveDraft(draft), [draft])

  useEffect(() => {
    if (manifest && !draft.look) {
      setDraft((d) => ({
        ...d,
        look: {
          body: manifest.bodies[0].id,
          hair: manifest.hair[0]?.id ?? "none",
          hairColor: manifest.hairColors[0] ?? "#1c1917",
          outfit: manifest.outfits[0].id,
          hat: "none",
        },
      }))
    }
  }, [manifest, draft.look])

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const go = (step: Step) => update({ step })

  return (
    <main className="relative min-h-[calc(100vh-34px)] overflow-hidden bg-navy-950">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "radial-gradient(ellipse at 50% 0%, var(--color-navy-700), transparent 60%)" }}
      />
      <div className="relative mx-auto flex max-w-[1400px] flex-col gap-4 px-6 py-4">
        {draft.step !== "title" && <Progress step={draft.step} go={go} />}
        <AnimatePresence mode="wait">
          <motion.div
            key={draft.step}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.2 }}
          >
            {draft.step === "title" && <TitleScreen draft={draft} start={() => go("lead")} reset={() => setDraft({ ...emptyDraft, step: "lead" })} />}
            {draft.step === "lead" && manifestError && (
              <div className="panel mx-auto max-w-xl p-6 text-center">
                <p className="font-pixel text-sm text-red-300">CAN'T LOAD THE LEAD ART</p>
                <p className="mt-3 font-ui text-sm text-slate-300">{manifestError}. Check web/public/art/looks.json, then reload.</p>
                <button onClick={() => location.reload()} className="btn mt-4 text-xs">
                  RELOAD
                </button>
              </div>
            )}
            {draft.step === "lead" && manifest && draft.look && (
              <CreateLead manifest={manifest} draft={draft} update={update} next={() => go("squad")} />
            )}
            {draft.step === "squad" && <DraftSquad draft={draft} update={update} back={() => go("lead")} next={() => go("scene")} />}
            {draft.step === "scene" && <SceneDeploy draft={draft} update={update} back={() => go("squad")} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  )
}

function Progress({ step, go }: { step: Step; go: (s: Step) => void }) {
  const current = STEPS.indexOf(step as (typeof STEPS)[number])
  return (
    <nav className="panel flex items-center gap-2 px-4 py-3">
      <button onClick={() => go("title")} className="mr-2 font-pixel text-[10px] text-gold-400 hover:text-gold-300">
        AGENTSQUAD
      </button>
      {STEPS.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={s} className={`flex items-center gap-2 ${i > 0 ? "flex-1" : ""}`}>
            {i > 0 && <div className={`h-[3px] flex-1 ${i <= current ? "bg-gold-400" : "bg-navy-500"}`} />}
            <button
              disabled={i > current}
              onClick={() => go(s)}
              className={`flex items-center gap-2 border-2 px-3 py-2 font-pixel text-[11px] transition-colors ${
                active
                  ? "border-gold-600 bg-gold-400 text-navy-950 shadow-[3px_3px_0_#000]"
                  : done
                    ? "border-gold-600 bg-navy-800 text-gold-300 hover:border-gold-400"
                    : "border-navy-500 bg-navy-900 text-slate-500"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                  active ? "border-navy-950" : done ? "border-gold-400 text-gold-400" : "border-navy-500"
                }`}
              >
                {done ? (
                  <svg viewBox="0 0 8 8" className="h-3 w-3" shapeRendering="crispEdges">
                    <path d="M1 4h1v1h1v1h1V5h1V4h1V3h1V2h1v1H7v1H6v1H5v1H4v1H3V6H2V5H1z" fill="currentColor" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              {STEP_LABELS[s].toUpperCase()}
            </button>
          </div>
        )
      })}
    </nav>
  )
}
