import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import type { Character } from "@agentsquad/shared"
import { MAX_MEMBERS, type Draft } from "./draft"
import { roster } from "./roster"
import Portrait from "./Portrait"
import { ArrowRight, BackButton, Progress } from "./parts"

const MODELS = ["haiku", "sonnet", "opus"] as const

export const readOnly = (c: Character) => !c.tools.includes("Edit") && !c.tools.includes("Write")
export const shortName = (c: Pick<Character, "name">) => c.name.replace(" Agent", "")
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function describe(c: Character) {
  const role = c.role.replace(/\.$/, "")
  const never = readOnly(c) && !/never edits/i.test(role) ? ". Never edits" : ""
  return `${c.name}: ${role.charAt(0).toLowerCase()}${role.slice(1)}${never}.`
}

type Props = { draft: Draft; update: (p: Partial<Draft>) => void; back: () => void; next: () => void }

export default function DraftSquad({ draft, update, back, next }: Props) {
  const members = draft.members
  const [focusId, setFocusId] = useState(members[0]?.id ?? roster[0].id)
  const focused = roster.find((c) => c.id === focusId) ?? roster[0]
  const focusedMember = members.find((m) => m.id === focused.id)

  const toggle = (c: Character) => {
    setFocusId(c.id)
    if (members.some((m) => m.id === c.id)) return update({ members: members.filter((m) => m.id !== c.id) })
    if (members.length >= MAX_MEMBERS) return
    update({ members: [...members, { id: c.id, model: c.model }] })
  }

  const setModel = (id: string, model: Character["model"]) =>
    update({ members: members.map((m) => (m.id === id ? { ...m, model } : m)) })

  return (
    <div
      className="relative flex min-h-screen flex-col items-center px-6 pt-7 pb-12"
      style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "28px 28px" }}
    >
      <div className="absolute top-7 left-8">
        <BackButton onClick={back} />
      </div>
      <Progress step="squad" className="items-center" />

      <div
        className="mt-[7vh] h-20 w-20 rounded-full"
        style={{
          background: "radial-gradient(circle at 38% 32%, #d9d2ff, #9d8cf8 40%, #5b47d6 85%)",
          boxShadow: "0 0 60px rgba(139,124,246,0.45), 0 0 140px rgba(139,124,246,0.2)",
        }}
      />
      <h1 className="mt-10 text-[36px] font-semibold tracking-[-0.02em] text-white">Pick your team</h1>
      <p className="mt-2 text-[17px] text-muted">Each one is a real Claude Code subagent. Pick up to four.</p>

      <div className="mt-12 flex flex-wrap justify-center gap-x-7 gap-y-6">
        {roster.map((c) => {
          const selected = members.some((m) => m.id === c.id)
          const full = !selected && members.length >= MAX_MEMBERS
          return (
            <button
              key={c.id}
              onClick={() => toggle(c)}
              onMouseEnter={() => setFocusId(c.id)}
              onFocus={() => setFocusId(c.id)}
              aria-pressed={selected}
              title={full ? "Squad is full. Remove someone first." : undefined}
              className={`group flex flex-col items-center gap-3 outline-none ${full ? "cursor-not-allowed" : ""}`}
            >
              <motion.span
                whileHover={full ? {} : { y: -3 }}
                whileTap={full ? {} : { scale: 0.96 }}
                className={`relative block rounded-full p-1 transition-all ${
                  selected ? "ring-[3px] ring-white" : "ring-0 group-focus-visible:ring-2 group-focus-visible:ring-accent"
                }`}
              >
                <Portrait
                  c={c}
                  scale={3}
                  top={1}
                  className={`h-[132px] w-[132px] rounded-full transition-opacity ${selected ? "" : full ? "opacity-35" : "opacity-60 group-hover:opacity-90"}`}
                />
                <AnimatePresence>
                  {selected && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 28 }}
                      className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-black shadow"
                    >
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3.5 8.5l3 3 6-7" />
                      </svg>
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.span>
              <span className={`text-[16px] font-medium transition-colors ${selected ? "text-white" : "text-muted"}`}>{shortName(c)}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-12 flex min-h-9 flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[14px] text-muted">
        <span>{describe(focused)}</span>
        {focusedMember ? (
          <div className="flex rounded-full border border-line bg-panel p-0.5">
            {MODELS.map((model) => (
              <button
                key={model}
                onClick={() => setModel(focused.id, model)}
                className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                  focusedMember.model === model ? "bg-accent text-white" : "text-faint hover:text-text"
                }`}
              >
                {cap(model)}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-faint">{cap(focused.model)}.</span>
        )}
      </div>

      <p className="mt-8 text-[13px] text-faint">
        {members.length} of {MAX_MEMBERS} picked
      </p>
      <motion.button
        whileHover={members.length ? { scale: 1.05 } : {}}
        whileTap={members.length ? { scale: 0.95 } : {}}
        onClick={next}
        disabled={members.length === 0}
        title={members.length === 0 ? "Pick at least one agent" : "Continue"}
        className="mt-3 flex h-14 w-14 items-center justify-center rounded-full border border-line-strong bg-panel text-white transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-line-strong"
      >
        <ArrowRight className="h-5 w-5" />
      </motion.button>
    </div>
  )
}
