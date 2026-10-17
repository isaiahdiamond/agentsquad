import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import type { Look } from "@agentsquad/shared"
import { useSprites, type SpriteView } from "../ui/sprites"
import { BODIES, OUTFITS, type Draft } from "./draft"
import LeadPreview from "./LeadPreview"

// Hair, Color and Hat tabs come back when the recolor art lands (see Decisions, Art Pack 01).
const TABS = ["body", "outfit"] as const
type Tab = (typeof TABS)[number]

const LABELS: Record<string, string> = {
  a: "Body A", b: "Body B", blazer: "Blazer", hoodie: "Hoodie", flannel: "Flannel", track: "Tracksuit",
}
const VIEWS: SpriteView[] = ["front", "back", "hand"]

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]

type Props = { draft: Draft; update: (p: Partial<Draft>) => void; next: () => void }

export default function CreateLead({ draft, update, next }: Props) {
  const { sprites } = useSprites()
  // Dev only: ?tab=body and ?view=back|hand open the creator in that state (for screenshots).
  const dev = import.meta.env.DEV ? new URLSearchParams(location.search) : null
  const [tab, setTab] = useState<Tab>(dev?.get("tab") === "body" ? "body" : "outfit")
  const [view, setView] = useState(Math.max(0, VIEWS.indexOf(dev?.get("view") as SpriteView)))
  const [winHeight, setWinHeight] = useState(window.innerHeight)

  useEffect(() => {
    const onResize = () => setWinHeight(window.innerHeight)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  const look = draft.look
  const bodies = sprites?.lead.bodies ?? BODIES
  const outfits = sprites?.lead.outfits ?? OUTFITS
  const opts = tab === "body" ? bodies : outfits
  const index = opts.indexOf(look[tab])

  const set = (patch: Partial<Look>) => update({ look: { ...look, ...patch } })
  const cycle = (dir: number) => set({ [tab]: opts[(index + dir + opts.length) % opts.length] })
  const randomize = () => set({ body: pick(bodies), outfit: pick(outfits) })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.altKey || e.metaKey || e.ctrlKey) return
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
        <div className="relative z-10 -mb-7 flex items-end">
          <LeadPreview look={look} view={VIEWS[view]} height={Math.max(176, Math.min(480, winHeight - 330))} />
        </div>
        <div className="relative h-16 w-72 rounded-[50%] border-4 border-gold-400 bg-navy-800 shadow-[0_0_40px_rgba(245,197,66,0.35),inset_0_-8px_0_var(--color-navy-950)]" />
        <div className="-mt-6 h-8 w-80 rounded-b-[50%] border-x-4 border-b-4 border-gold-600 bg-navy-900" />
        <ArrowButton label="‹" onClick={() => cycle(-1)} className="left-4" />
        <ArrowButton label="›" onClick={() => cycle(1)} className="right-4" />
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => setView((v) => (v + 1) % VIEWS.length)}
          title="Rotate"
          className="btn absolute top-4 right-4 z-20 text-[10px]"
        >
          ROTATE: {VIEWS[view].toUpperCase()}
        </motion.button>
      </section>

      <section className="panel flex flex-col gap-4 p-4">
        <div className="grid grid-cols-2 gap-2">
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
          <div className={`grid gap-3 ${tab === "body" ? "grid-cols-2" : "grid-cols-4"}`}>
            {opts.map((o) => (
              <Tile key={o} selected={o === look[tab]} onClick={() => set({ [tab]: o })}>
                <div className={`flex items-end justify-center ${tab === "body" ? "h-72" : "h-60"}`}>
                  <LeadPreview look={{ ...look, [tab]: o }} height={tab === "body" ? 264 : 220} />
                </div>
                <span className="mt-2 block font-pixel text-[9px] text-slate-300">{(LABELS[o] ?? o).toUpperCase()}</span>
              </Tile>
            ))}
          </div>
          <p className="mt-3 font-ui text-xs text-slate-400">Use ← and → to cycle {tab === "body" ? "bodies" : "outfits"}.</p>
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
