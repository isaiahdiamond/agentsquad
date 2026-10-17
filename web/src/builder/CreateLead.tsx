import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import type { Look } from "@agentsquad/shared"
import { useSprites, type SpriteView } from "../ui/sprites"
import { BODIES, OUTFITS, type Draft } from "./draft"
import LeadPreview from "./LeadPreview"
import { ArrowRight, Progress } from "./parts"

// Hair, Skin and Headset come back when the recolor art lands (see Decisions, Art Pack 01).
const TABS = ["body", "outfit"] as const
type Tab = (typeof TABS)[number]

const LABELS: Record<string, string> = {
  a: "Body A", b: "Body B", blazer: "Blazer", hoodie: "Hoodie", flannel: "Flannel", track: "Tracksuit",
}
const VIEWS: SpriteView[] = ["front", "back", "hand"]
const VIEW_LABELS: Record<SpriteView, string> = { front: "Front", back: "Back", hand: "Wave" }
const SPRITE_HEIGHT = 96
const PEDESTAL_SIDE = 22
const PEDESTAL_TOP = 64

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]

type Props = { draft: Draft; update: (p: Partial<Draft>) => void; next: () => void }

export default function CreateLead({ draft, update, next }: Props) {
  const { sprites } = useSprites()
  // Dev only: ?tab=body and ?view=back|hand open the creator in that state (for screenshots).
  const dev = import.meta.env.DEV ? new URLSearchParams(location.search) : null
  const [tab, setTab] = useState<Tab>(dev?.get("tab") === "body" ? "body" : "outfit")
  const [view, setView] = useState(Math.max(0, VIEWS.indexOf(dev?.get("view") as SpriteView)))

  const look = draft.look
  const bodies = sprites?.lead.bodies ?? BODIES
  const outfits = sprites?.lead.outfits ?? OUTFITS
  const optsFor = (t: Tab) => (t === "body" ? bodies : outfits)
  const opts = optsFor(tab)
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
    <div className="mx-auto flex h-screen min-h-[600px] max-w-[1360px] flex-col gap-5 px-6 pt-6 pb-8 md:px-11">
      <Progress step="lead" />

      <div className="card grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_minmax(320px,400px)] overflow-hidden xl:grid-cols-[300px_minmax(0,1fr)_420px]">
        <aside className="flex flex-col gap-1 overflow-auto border-r border-line p-6 xl:p-7">
          <h1 className="mb-5 text-[22px] font-semibold tracking-tight text-white">Customize your lead</h1>
          {TABS.map((t) => (
            <div key={t}>
              <button
                onClick={() => setTab(t)}
                className={`flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left text-[15px] transition-colors ${
                  t === tab ? "text-white" : "text-muted hover:text-text"
                }`}
              >
                {t === "body" ? <BodyIcon /> : <ShirtIcon />}
                <span className="flex-1 font-medium">{t === "body" ? "Body" : "Outfit"}</span>
                <Chevron up={t === tab} />
              </button>
              <AnimatePresence initial={false}>
                {t === tab && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-1 pt-1 pb-2 pl-2">
                      {optsFor(t).map((o) => {
                        const selected = o === look[t]
                        return (
                          <button
                            key={o}
                            onClick={() => set({ [t]: o })}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] transition-colors ${
                              selected ? "bg-panel-2 text-white" : "text-muted hover:text-text"
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${selected ? "bg-accent" : "border border-faint"}`} />
                            {LABELS[o] ?? o}
                          </button>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
          {[
            ["Hair", <HairIcon key="i" />],
            ["Skin", <SparkleIcon key="i" />],
            ["Headset", <HeadsetIcon key="i" />],
          ].map(([label, icon]) => (
            <div key={label as string} className="flex items-center gap-3 px-1 py-2.5 text-[15px] text-faint" title="Needs recolor art. Coming soon.">
              {icon}
              <span className="flex-1 font-medium">{label}</span>
              <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-medium">Soon</span>
            </div>
          ))}
        </aside>

        <section className="relative min-h-0 overflow-auto border-r border-line p-6 xl:p-8">
          <button
            onClick={randomize}
            title="Randomize"
            className="absolute top-5 right-5 flex h-10 w-10 items-center justify-center rounded-full border border-line-strong bg-panel-2 text-muted transition-colors hover:border-accent hover:text-white"
          >
            <DiceIcon />
          </button>
          <div className="grid grid-cols-[repeat(3,minmax(0,150px))] gap-4 pt-6 xl:gap-5">
            {opts.map((o) => {
              const selected = o === look[tab]
              return (
                <motion.button
                  key={`${tab}-${o}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -2 }}
                  onClick={() => set({ [tab]: o })}
                  title={LABELS[o] ?? o}
                  className={`flex h-[216px] items-end justify-center rounded-xl pb-3 bg-panel-2 transition-shadow ${
                    selected ? "ring-2 ring-white" : "hover:ring-1 hover:ring-line-strong"
                  }`}
                >
                  <LeadPreview look={{ ...look, [tab]: o }} height={SPRITE_HEIGHT * 2} />
                </motion.button>
              )
            })}
          </div>
          <p className="mt-5 text-[13px] text-faint">
            {LABELS[look[tab]] ?? look[tab]} · use ← and → to cycle
          </p>
        </section>

        <section className="flex min-h-0 flex-col gap-5 p-6 xl:p-8">
          <input
            value={draft.name}
            maxLength={24}
            placeholder="Lead Agent"
            aria-label="Lead name"
            onChange={(e) => update({ name: e.target.value })}
            className="h-12 w-full rounded-xl border border-line-strong bg-bg px-4 text-[15px] text-white outline-none placeholder:text-faint focus:border-accent"
          />
          <Stage look={look} view={VIEWS[view]} />
          <div className="flex justify-center">
            <div className="flex rounded-full border border-line bg-bg p-1">
              {VIEWS.map((v, i) => (
                <button
                  key={v}
                  onClick={() => setView(i)}
                  className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                    i === view ? "bg-panel-2 text-white" : "text-faint hover:text-muted"
                  }`}
                >
                  {VIEW_LABELS[v]}
                </button>
              ))}
            </div>
          </div>
          <button onClick={next} disabled={!draft.name.trim()} className="btn-primary h-13 w-full rounded-xl! text-[15px]">
            Continue <ArrowRight />
          </button>
        </section>
      </div>
    </div>
  )
}

function Stage({ look, view }: { look: Look; view: SpriteView }) {
  const ref = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setRoom(el.clientHeight)
    measure()
    const obs = new ResizeObserver(measure)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const feet = PEDESTAL_SIDE + PEDESTAL_TOP / 2
  const scale = Math.max(1, Math.min(5, Math.floor((room - feet) / SPRITE_HEIGHT)))

  return (
    <div ref={ref} className="relative min-h-[200px] flex-1">
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[85%]"
        style={{ background: "radial-gradient(ellipse 45% 55% at 50% 70%, rgba(139,124,246,0.28), transparent 70%)" }}
      />
      <div className="absolute bottom-0 left-1/2 w-[240px] -translate-x-1/2">
        <div
          className="absolute inset-x-0 bottom-0 rounded-[50%] bg-accent-strong"
          style={{ height: PEDESTAL_TOP + PEDESTAL_SIDE, boxShadow: "0 18px 50px rgba(116,97,240,0.45)" }}
        />
        <div
          className="absolute inset-x-0 rounded-[50%] border-2 border-[#c4bbfb]"
          style={{
            bottom: PEDESTAL_SIDE,
            height: PEDESTAL_TOP,
            background: "radial-gradient(ellipse at 50% 40%, #4b3fa8, #2a2366 75%)",
            boxShadow: "0 0 40px rgba(139,124,246,0.55), inset 0 0 24px rgba(196,187,251,0.25)",
          }}
        />
      </div>
      {room > 0 && (
        <motion.div
          key={`${view}-${look.body}-${look.outfit}`}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="absolute left-1/2 -translate-x-1/2"
          style={{ bottom: feet }}
        >
          <LeadPreview look={look} view={view} height={SPRITE_HEIGHT * scale} />
        </motion.div>
      )}
    </div>
  )
}

const iconProps = {
  viewBox: "0 0 24 24",
  className: "h-5 w-5 shrink-0",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

function Chevron({ up }: { up: boolean }) {
  return (
    <svg {...iconProps} className={`h-4 w-4 shrink-0 transition-transform ${up ? "rotate-180" : ""}`}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function BodyIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </svg>
  )
}

function ShirtIcon() {
  return (
    <svg {...iconProps}>
      <path d="M9 3l-5 3 2 4 2-1v12h8V9l2 1 2-4-5-3c0 1.7-1.3 3-3 3S9 4.7 9 3z" />
    </svg>
  )
}

function HairIcon() {
  return (
    <svg {...iconProps}>
      <path d="M5 13c0-5 3-9 7-9s7 4 7 9c0 3-1 6-3 7M5 13c0 3 1 6 3 7M8 9c2 1 6 1 8-1" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg {...iconProps}>
      <path d="M10 3l1.5 5.5L17 10l-5.5 1.5L10 17l-1.5-5.5L3 10l5.5-1.5zM18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z" />
    </svg>
  )
}

function HeadsetIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 15v-3a8 8 0 0116 0v3M4 15a2 2 0 002 2h1v-5H6a2 2 0 00-2 2zm16 0a2 2 0 01-2 2h-1v-5h1a2 2 0 012 2zM18 17c0 2-2 3-5 3" />
    </svg>
  )
}

function DiceIcon() {
  return (
    <svg {...iconProps} className="h-[18px] w-[18px]">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="9" cy="9" r="1" fill="currentColor" />
      <circle cx="15" cy="15" r="1" fill="currentColor" />
      <circle cx="15" cy="9" r="1" fill="currentColor" />
      <circle cx="9" cy="15" r="1" fill="currentColor" />
    </svg>
  )
}
