import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { emptyDraft, loadDraft, saveDraft, type Draft, type Step } from "./draft"
import TitleScreen from "./TitleScreen"
import CreateLead from "./CreateLead"
import DraftSquad from "./DraftSquad"
import SceneDeploy from "./SceneDeploy"

export default function BuilderPage() {
  const [draft, setDraft] = useState<Draft>(loadDraft)
  useEffect(() => saveDraft(draft), [draft])

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const go = (step: Step) => update({ step })

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg text-text">
      <AnimatePresence mode="wait">
        <motion.div
          key={draft.step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {draft.step === "title" && <TitleScreen draft={draft} start={() => go("lead")} reset={() => setDraft({ ...emptyDraft, step: "lead" })} />}
          {draft.step === "lead" && <CreateLead draft={draft} update={update} back={() => go("title")} next={() => go("squad")} />}
          {draft.step === "squad" && <DraftSquad draft={draft} update={update} back={() => go("lead")} next={() => go("scene")} />}
          {draft.step === "scene" && <SceneDeploy draft={draft} update={update} back={() => go("squad")} />}
        </motion.div>
      </AnimatePresence>
    </main>
  )
}
