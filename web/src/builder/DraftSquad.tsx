import { motion } from "framer-motion"
import type { Character } from "@agentsquad/shared"
import { MAX_MEMBERS, type Draft } from "./draft"
import { roster } from "./roster"
import LeadPreview from "./LeadPreview"
import Portrait from "./Portrait"

const MODELS = ["haiku", "sonnet", "opus"] as const

export const readOnly = (c: Character) => !c.tools.includes("Edit") && !c.tools.includes("Write")

type Props = { draft: Draft; update: (p: Partial<Draft>) => void; back: () => void; next: () => void }

export default function DraftSquad({ draft, update, back, next }: Props) {
  const members = draft.members
  const slotOf = (id: string) => members.findIndex((m) => m.id === id)

  const toggle = (c: Character) => {
    if (slotOf(c.id) !== -1) return update({ members: members.filter((m) => m.id !== c.id) })
    if (members.length >= MAX_MEMBERS) return
    update({ members: [...members, { id: c.id, model: c.model }] })
  }

  const setModel = (id: string, model: Character["model"]) =>
    update({ members: members.map((m) => (m.id === id ? { ...m, model } : m)) })

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4">
        {roster.map((c) => {
          const slot = slotOf(c.id)
          const full = slot === -1 && members.length >= MAX_MEMBERS
          return (
            <motion.button
              key={c.id}
              whileHover={full ? {} : { y: -3 }}
              whileTap={full ? {} : { scale: 0.98 }}
              onClick={() => toggle(c)}
              className={`relative flex flex-col bg-navy-900 text-left ${full ? "opacity-50" : ""}`}
              style={{
                border: `3px solid ${c.color}`,
                boxShadow: slot !== -1 ? `0 0 0 2px ${c.color}, 0 0 24px ${c.color}99, 4px 4px 0 #000` : "4px 4px 0 #000",
              }}
            >
              {slot !== -1 && (
                <span className="absolute -top-3 -right-3 z-10 border-2 border-black bg-gold-400 px-2 py-1 font-pixel text-[9px] text-navy-950">
                  SLOT {slot + 1}
                </span>
              )}
              <div className="flex gap-3 p-3">
                <Portrait c={c} className="h-32 w-24 shrink-0 border-2 border-black" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <h3 className="font-pixel text-[12px] leading-snug" style={{ color: c.color }}>
                    {c.name.toUpperCase()}
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {c.tools.map((t) => (
                      <span key={t} className="border border-navy-500 bg-navy-800 px-1.5 py-0.5 font-ui text-[11px] text-slate-300">
                        {t}
                      </span>
                    ))}
                  </div>
                  {readOnly(c) && (
                    <span className="self-start border-2 border-red-500 bg-red-950 px-1.5 py-0.5 font-pixel text-[8px] text-red-300">
                      READ ONLY · NEVER EDITS
                    </span>
                  )}
                  <span className="mt-auto font-ui text-[11px] text-slate-400">Default model: {c.model}</span>
                </div>
              </div>
              <p className="border-t-2 border-navy-700 px-3 py-2 text-center font-pixel text-[9px] leading-relaxed text-slate-200">
                {c.role.toUpperCase()}
              </p>
            </motion.button>
          )
        })}
      </div>

      <div className="panel flex items-center gap-4 p-4">
        <div className="w-28 shrink-0 text-center">
          <p className="font-pixel text-base text-gold-400">SQUAD</p>
          <p className="mt-1 font-ui text-xs text-slate-400">
            {members.length}/{MAX_MEMBERS} drafted
          </p>
        </div>

        <div className="flex h-44 w-32 shrink-0 flex-col items-center justify-end border-3 border-gold-400 bg-navy-800 pb-1">
          <div className="flex flex-1 items-end overflow-hidden">{draft.look && <LeadPreview look={draft.look} height={110} />}</div>
          <span className="font-pixel text-[8px] text-gold-300">LEAD</span>
          <span className="max-w-full truncate px-1 font-ui text-[11px] text-slate-300">{draft.name}</span>
        </div>

        {Array.from({ length: MAX_MEMBERS }, (_, i) => {
          const m = members[i]
          const c = m && roster.find((r) => r.id === m.id)
          if (!m || !c) {
            return (
              <div
                key={i}
                className="flex h-44 w-36 shrink-0 items-center justify-center border-3 border-dashed border-navy-500 font-pixel text-2xl text-navy-500"
              >
                +
              </div>
            )
          }
          return (
            <div key={i} className="flex h-44 w-36 shrink-0 flex-col bg-navy-800" style={{ border: `3px solid ${c.color}` }}>
              <button
                onClick={() => toggle(c)}
                title="Remove from squad"
                className="group relative flex flex-1 flex-col items-center justify-end overflow-hidden"
              >
                <Portrait c={c} className="h-full w-full" />
                <span className="absolute inset-0 hidden items-center justify-center bg-black/70 font-pixel text-[9px] text-red-300 group-hover:flex">
                  REMOVE
                </span>
              </button>
              <div className="grid grid-cols-3 border-t-2 border-black">
                {MODELS.map((model) => (
                  <button
                    key={model}
                    onClick={() => setModel(c.id, model)}
                    className={`py-1.5 font-pixel text-[7px] ${
                      m.model === model ? "bg-gold-400 text-navy-950" : "bg-navy-900 text-slate-400 hover:text-gold-300"
                    }`}
                  >
                    {model.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )
        })}

        <div className="ml-auto flex flex-col gap-3">
          <motion.button whileTap={{ scale: 0.96 }} onClick={next} disabled={members.length === 0} className="btn-gold text-sm">
            NEXT &gt;
          </motion.button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={back} className="btn text-xs">
            &lt; BACK
          </motion.button>
          {members.length === 0 && <p className="font-ui text-[11px] text-slate-400">Draft at least 1 agent</p>}
        </div>
      </div>
    </div>
  )
}
