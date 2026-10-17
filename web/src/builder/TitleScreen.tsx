import { motion } from "framer-motion"
import type { Draft } from "./draft"
import { roster } from "./roster"
import LeadPreview from "./LeadPreview"
import Portrait from "./Portrait"

export default function TitleScreen({ draft, start, reset }: { draft: Draft; start: () => void; reset: () => void }) {
  const resumed = draft.members.length > 0
  return (
    <div className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center gap-10">
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 120 }}
        className="text-center"
      >
        <h1
          className="font-pixel text-5xl text-gold-400 md:text-7xl"
          style={{ textShadow: "4px 4px 0 var(--color-gold-600), 8px 8px 0 #000" }}
        >
          AGENTSQUAD
        </h1>
        <p className="mt-6 font-ui text-lg text-slate-300">
          Build a squad of coding agents. Deploy them into Claude Code. Watch them work.
        </p>
      </motion.div>

      <div className="flex items-end gap-4">
        {roster.slice(0, 3).map((c) => (
          <Portrait key={c.id} c={c} className="h-28 w-20 opacity-90" />
        ))}
        {draft.look && <LeadPreview look={draft.look} height={180} />}
        {roster.slice(3).map((c) => (
          <Portrait key={c.id} c={c} className="h-28 w-20 opacity-90" />
        ))}
      </div>
      <div className="-mt-12 h-6 w-[640px] max-w-full rounded-[50%] border-2 border-gold-600 bg-navy-800 shadow-[0_0_30px_rgba(245,197,66,0.25)]" />

      <div className="flex flex-col items-center gap-3">
        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={start} className="btn-gold w-72 text-sm">
          {resumed ? "CONTINUE SQUAD" : "NEW SQUAD"}
        </motion.button>
        {resumed && (
          <button onClick={reset} className="font-pixel text-[10px] text-slate-400 underline-offset-4 hover:text-gold-300 hover:underline">
            START A NEW SQUAD
          </button>
        )}
      </div>
    </div>
  )
}
