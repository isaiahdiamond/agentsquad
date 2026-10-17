import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import type { Look, LookManifest } from "@agentsquad/shared"
import type { Draft } from "./draft"
import LeadPreview from "./LeadPreview"

const TABS = ["body", "hair", "color", "outfit", "hat"] as const
type Tab = (typeof TABS)[number]

const FIELD: Record<Tab, keyof Look> = { body: "body", hair: "hair", color: "hairColor", outfit: "outfit", hat: "hat" }

function options(m: LookManifest, tab: Tab) {
  if (tab === "body") return m.bodies.map((b) => ({ value: b.id, label: b.label }))
  if (tab === "hair") return [...m.hair.map((h) => ({ value: h.id, label: h.label })), { value: "none", label: "None" }]
  if (tab === "color") return m.hairColors.map((c) => ({ value: c, label: c }))
  if (tab === "outfit") return m.outfits.map((o) => ({ value: o.id, label: o.label }))
  return [{ value: "none", label: "None" }, ...m.hats.map((h) => ({ value: h.id, label: h.label }))]
}

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]

type Props = { manifest: LookManifest; draft: Draft; update: (p: Partial<Draft>) => void; next: () => void }

export default function CreateLead({ manifest, draft, update, next }: Props) {
  const [tab, setTab] = useState<Tab>("hair")
  const look = draft.look!
  const opts = options(manifest, tab)
  const field = FIELD[tab]
  const index = opts.findIndex((o) => o.value === look[field])

  const set = (patch: Partial<Look>) => update({ look: { ...look, ...patch } })
  const cycle = (dir: number) => set({ [field]: opts[(index + dir + opts.length) % opts.length].value })

  const randomize = () =>
    set({
      body: pick(manifest.bodies).id,
      hair: pick([...manifest.hair.map((h) => h.id), "none"]),
      hairColor: pick(manifest.hairColors),
      outfit: pick(manifest.outfits).id,
      hat: Math.random() < 0.5 ? "none" : pick(manifest.hats).id,
    })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === "ArrowLeft") cycle(-1)
      if (e.key === "ArrowRight") cycle(1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  return (
    <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-4">
      <section className="panel relative flex h-[calc(100vh-150px)] min-h-[560px] flex-col items-center justify-end overflow-hidden pb-10">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-full"
          style={{ background: "radial-gradient(ellipse 35% 75% at 50% 10%, rgba(255,226,138,0.18), transparent 70%)" }}
        />
        <p className="absolute top-4 font-pixel text-xs text-gold-300">{draft.name || "Lead Agent"}</p>
        <div className="relative z-10 -mb-12 flex items-end">
          <LeadPreview look={look} height={Math.min(480, window.innerHeight - 320)} manifest={manifest} />
        </div>
        <div className="relative h-16 w-72 rounded-[50%] border-4 border-gold-400 bg-navy-800 shadow-[0_0_40px_rgba(245,197,66,0.35),inset_0_-8px_0_var(--color-navy-950)]" />
        <div className="-mt-6 h-8 w-80 rounded-b-[50%] border-x-4 border-b-4 border-gold-600 bg-navy-900" />
        <ArrowButton label="‹" onClick={() => cycle(-1)} className="left-4" />
        <ArrowButton label="›" onClick={() => cycle(1)} className="right-4" />
      </section>

      <section className="panel flex flex-col gap-4 p-4">
        <div className="grid grid-cols-5 gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`border-2 py-3 font-pixel text-[11px] transition-colors ${
                t === tab ? "border-gold-400 bg-navy-700 text-gold-400" : "border-navy-500 bg-navy-800 text-slate-300 hover:border-gold-600"
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="panel-quiet flex-1 overflow-auto p-3">
          {tab === "color" ? (
            <div className="grid grid-cols-6 gap-3">
              {opts.map((o) => (
                <Tile key={o.value} selected={o.value === look.hairColor} onClick={() => set({ hairColor: o.value })}>
                  <div className="h-16 w-full border-2 border-black" style={{ background: o.value }} />
                </Tile>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {opts.map((o) => (
                <Tile key={o.value} selected={o.value === look[field]} onClick={() => set({ [field]: o.value })}>
                  <div className="flex h-40 items-end justify-center overflow-hidden">
                    <LeadPreview
                      look={{ ...look, [field]: o.value, ...(tab === "hair" ? { hat: "none" } : {}) }}
                      height={160}
                      manifest={manifest}
                    />
                  </div>
                  <span className="mt-1 block font-pixel text-[9px] text-slate-300">{o.label.toUpperCase()}</span>
                </Tile>
              ))}
            </div>
          )}
          {tab === "hair" && look.hat !== "none" && (
            <p className="mt-3 font-ui text-xs text-gold-300">Your hat hides the hair. Pick "None" on the Hat tab to see it.</p>
          )}
          {(tab === "hair" || tab === "color") && (
            <div className="mt-4">
              <p className="mb-2 font-pixel text-[9px] text-slate-400">HAIR COLOR</p>
              <div className="flex flex-wrap gap-2">
                {manifest.hairColors.map((c) => (
                  <button
                    key={c}
                    onClick={() => set({ hairColor: c })}
                    className={`h-8 w-8 border-2 ${c === look.hairColor ? "border-gold-400 outline-2 outline-gold-400" : "border-black"}`}
                    style={{ background: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <label className="flex items-center gap-3">
          <span className="font-pixel text-[11px] text-slate-300">NAME:</span>
          <input
            value={draft.name}
            maxLength={24}
            onChange={(e) => update({ name: e.target.value })}
            className="flex-1 border-2 border-navy-500 bg-navy-950 px-3 py-2 font-pixel text-xs text-white outline-none focus:border-gold-400"
          />
        </label>

        <div className="flex justify-end gap-3">
          <motion.button whileTap={{ scale: 0.96 }} onClick={randomize} className="btn text-xs">
            RANDOMIZE
          </motion.button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={next} disabled={!draft.name.trim()} className="btn-gold text-xs">
            NEXT &gt;
          </motion.button>
        </div>
      </section>
    </div>
  )
}

function Tile({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`border-2 bg-navy-800 p-2 text-center ${
        selected ? "border-gold-400 shadow-[0_0_0_2px_var(--color-gold-600),0_0_16px_rgba(245,197,66,0.4)]" : "border-navy-500 hover:border-gold-600"
      }`}
    >
      {children}
    </motion.button>
  )
}

function ArrowButton({ label, onClick, className }: { label: string; onClick: () => void; className: string }) {
  return (
    <motion.button
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className={`absolute top-1/2 z-20 flex h-14 w-14 -translate-y-1/2 items-center justify-center border-3 border-gold-400 bg-navy-800 font-pixel text-2xl text-gold-400 shadow-[3px_3px_0_#000] ${className}`}
    >
      {label}
    </motion.button>
  )
}
