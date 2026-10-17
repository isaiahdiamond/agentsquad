import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { motion } from "framer-motion"
import type { Look } from "@agentsquad/shared"
import { isCharacter, leadKey, normalizeLook, useLeadManifest, useLeadSprite, type LeadManifest, type LeadView } from "../ui/lead"
import type { Draft } from "./draft"
import LeadPreview, { LeadHead } from "./LeadPreview"
import { BackButton, Progress } from "./parts"

const TABS = ["type", "outfit", "skin", "hair", "hairColor"] as const
type Tab = (typeof TABS)[number]
const TAB_LABELS: Record<Tab, string> = { type: "Type", outfit: "Outfit", skin: "Skin", hair: "Hair", hairColor: "Hair color" }
const TAB_ICONS: Record<Tab, () => ReactNode> = {
  type: BodyIcon, outfit: ShirtIcon, skin: SparkleIcon, hair: HairIcon, hairColor: DropIcon,
}

const LABELS: Record<string, string> = {
  a: "Body 1", b: "Body 2", dog: "Dog", gator: "Gator",
  drip: "Drip", blazer: "Blazer", hoodie: "Hoodie", gameday: "Game day", debugger: "Debugger", sundress: "Sundress",
  bald: "Bald", locs: "Locs", waves: "Waves", afro: "Afro", sidepart: "Side part", fringe: "Fringe",
  braids: "Braids", straight: "Straight", puff: "Puff", bob: "Bob", buns: "Buns",
  black: "Black", darkbrown: "Dark brown", brown: "Brown", auburn: "Auburn", ginger: "Ginger",
  blonde: "Blonde", platinum: "Platinum", grey: "Grey", pink: "Pink", blue: "Blue",
}
const label = (tab: Tab, id: string) => (tab === "skin" ? `Tone ${id.replace(/^s/, "")}` : LABELS[id] ?? id)

// The layered lead has no back view, so the toggle is Front and Wave.
const VIEWS: LeadView[] = ["front", "hand"]
const VIEW_LABELS: Record<string, string> = { front: "Front", hand: "Wave" }
const PEDESTAL_SIDE = 22
// Tallest composed lead sprite (a raised hand, or Body 2 with the puff); keeps the scale steady across looks.
const TALLEST_LEAD = 112
const PEDESTAL_TOP = 64

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]

function options(m: LeadManifest | null, tab: Tab, look: Look): string[] {
  if (!m) return []
  const body = m.bodies[look.body]
  if (tab === "type") return [...Object.keys(m.bodies), ...Object.keys(m.characters)]
  if (tab === "skin") return Object.keys(m.skinTones)
  if (tab === "hairColor") return Object.keys(m.hairColors)
  if (!body) return []
  return Object.keys(tab === "outfit" ? body.outfits : body.hair)
}

const field = (tab: Tab) => (tab === "type" ? "body" : tab) as keyof Look

type Props = { draft: Draft; update: (p: Partial<Draft>) => void; back: () => void; next: () => void }

export default function CreateLead({ draft, update, back, next }: Props) {
  const m = useLeadManifest()
  // Dev only: ?tab=<category> and ?view=hand open the creator in that state (for screenshots).
  const dev = import.meta.env.DEV ? new URLSearchParams(location.search) : null
  const [tab, setTab] = useState<Tab>(TABS.includes(dev?.get("tab") as Tab) ? (dev?.get("tab") as Tab) : "type")
  const [view, setView] = useState<LeadView>(dev?.get("view") === "hand" ? "hand" : "front")

  const look = m ? normalizeLook(draft.look, m) : draft.look
  const character = isCharacter(look)
  const tabs: readonly Tab[] = character ? ["type"] : TABS
  const current = tabs.includes(tab) ? tab : "type"
  const opts = options(m, current, look)
  const value = String(look[field(current)] ?? "")

  const set = (patch: Partial<Look>) => update({ look: normalizeLook({ ...look, ...patch }, m) })
  const choose = (t: Tab, id: string) => set({ [field(t)]: id })
  const cycle = (dir: number) => opts.length && choose(current, opts[(opts.indexOf(value) + dir + opts.length) % opts.length])

  const randomize = () => {
    if (!m) return
    const people = Object.keys(m.bodies)
    const body = Math.random() < 0.8 ? pick(people) : pick(Object.keys(m.characters))
    const b = m.bodies[body]
    if (!b) return set({ body })
    set({
      body,
      outfit: pick(Object.keys(b.outfits)),
      skin: pick(Object.keys(m.skinTones)),
      hair: pick(Object.keys(b.hair).filter((s) => s !== "bald")),
      hairColor: pick(Object.keys(m.hairColors)),
    })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return
      if (e.key === "ArrowLeft") cycle(-1)
      if (e.key === "ArrowRight") cycle(1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const swatches = current === "skin" || current === "hairColor"

  return (
    <div className="mx-auto flex h-screen min-h-[600px] max-w-[1360px] flex-col gap-5 px-6 pt-6 pb-8 md:px-11">
      <div className="flex items-center gap-5">
        <BackButton onClick={back} />
        <Progress step="lead" />
      </div>

      <div className="card grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_minmax(300px,380px)] overflow-hidden xl:grid-cols-[280px_minmax(0,1fr)_420px]">
        <aside className="flex flex-col gap-1 overflow-auto border-r border-line p-6 xl:p-7">
          <h1 className="mb-5 text-[22px] font-semibold tracking-tight text-white">Customize your lead</h1>
          {tabs.map((t) => {
            const Icon = TAB_ICONS[t]
            const v = String(look[field(t)] ?? "")
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                aria-pressed={t === current}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] transition-colors ${
                  t === current ? "bg-panel-2 text-white [&>svg]:text-accent" : "text-muted hover:text-text"
                }`}
              >
                <Icon />
                <span className="flex-1 font-medium">{TAB_LABELS[t]}</span>
                <span className="truncate text-[13px] text-faint">{label(t, v)}</span>
              </button>
            )
          })}
          {character && <p className="mt-4 px-3 text-[13px] leading-relaxed text-faint">Characters come as a complete look.</p>}
        </aside>

        <section className="relative min-h-0 overflow-auto border-r border-line p-6 xl:p-8">
          <button
            onClick={randomize}
            title="Randomize"
            className="absolute top-5 right-5 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-line-strong bg-panel-2 text-muted transition-colors hover:border-accent hover:text-white"
          >
            <DiceIcon />
          </button>
          <h2 className="text-[15px] font-medium text-white">{TAB_LABELS[current]}</h2>
          {swatches ? (
            <div className="mt-6 grid grid-cols-[repeat(auto-fill,56px)] gap-4">
              {opts.map((o) => (
                <button
                  key={o}
                  onClick={() => choose(current, o)}
                  title={label(current, o)}
                  aria-pressed={o === value}
                  className={`h-14 w-14 rounded-full p-1 transition-shadow ${o === value ? "ring-2 ring-accent" : "hover:ring-1 hover:ring-line-strong"}`}
                >
                  <span className="block h-full w-full rounded-full shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]" style={{ background: swatch(m!, current, o) }} />
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-[repeat(3,minmax(0,150px))] gap-4 xl:gap-5">
              {opts.map((o) => (
                <button
                  key={o}
                  onClick={() => choose(current, o)}
                  title={label(current, o)}
                  aria-pressed={o === value}
                  className={`relative flex h-[256px] flex-col items-center justify-end overflow-hidden rounded-xl bg-panel-2 pb-8 transition-shadow ${
                    o === value ? "ring-2 ring-accent" : "hover:ring-1 hover:ring-line-strong"
                  }`}
                >
                  {current === "hair" ? (
                    <LeadHead look={normalizeLook({ ...look, hair: o }, m)} scale={3} top={12} className="absolute inset-x-0 top-0 bottom-8" />
                  ) : (
                    <LeadPreview look={normalizeLook({ ...look, [field(current)]: o }, m)} scale={2} />
                  )}
                  <span className="absolute inset-x-0 bottom-2 text-[12px] font-medium text-muted">{label(current, o)}</span>
                </button>
              ))}
            </div>
          )}
          <p className="mt-5 text-[13px] text-faint">{label(current, value)}. Arrow keys switch options.</p>
        </section>

        <section className="flex min-h-0 flex-col gap-5 p-6">
          <input
            value={draft.name}
            maxLength={24}
            placeholder="Lead Agent"
            aria-label="Lead name"
            onChange={(e) => update({ name: e.target.value })}
            className="h-12 w-full rounded-xl border border-line-strong bg-bg px-4 text-[15px] text-white outline-none placeholder:text-faint focus:border-accent"
          />
          <Stage look={look} view={view} />
          <div className="flex justify-center">
            <div className="flex rounded-full border border-line bg-bg p-1">
              {VIEWS.map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                    v === view ? "bg-panel-2 text-white" : "text-faint hover:text-muted"
                  }`}
                >
                  {VIEW_LABELS[v]}
                </button>
              ))}
            </div>
          </div>
          <button onClick={next} disabled={!draft.name.trim()} className="btn-primary h-13 w-full rounded-xl! text-[15px]">
            Continue
          </button>
        </section>
      </div>
    </div>
  )
}

function swatch(m: LeadManifest, tab: Tab, id: string) {
  if (tab === "hairColor") return m.hairColors[id]
  const t = m.skinTones[id]
  return `linear-gradient(135deg, ${t[0]} 0%, ${t[1]} 50%, ${t[2]} 100%)`
}

function Stage({ look, view }: { look: Look; view: LeadView }) {
  const ref = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState(0)
  const { sprite } = useLeadSprite(look, view)

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
  const scale = Math.max(1, Math.min(5, Math.floor((room - feet) / Math.max(sprite?.height ?? 0, TALLEST_LEAD))))

  return (
    <div ref={ref} className="relative min-h-[200px] flex-1">
      <div className="absolute bottom-0 left-1/2 w-[240px] -translate-x-1/2">
        <div
          className="absolute inset-x-0 bottom-0 rounded-[50%] bg-[#161618]"
          style={{ height: PEDESTAL_TOP + PEDESTAL_SIDE }}
        />
        <div
          className="absolute inset-x-0 rounded-[50%] border-2 border-accent/70"
          style={{
            bottom: PEDESTAL_SIDE,
            height: PEDESTAL_TOP,
            background: "radial-gradient(ellipse at 50% 40%, #232326, #0e0e10 75%)",
            boxShadow: "0 0 28px rgba(255,255,255,0.12)",
          }}
        />
      </div>
      <motion.div
        key={sprite ? leadKey(look, view) : "loading"}
        initial={{ opacity: 0.6 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="absolute left-1/2 -translate-x-1/2"
        style={{ bottom: feet }}
      >
        <LeadPreview look={look} view={view} scale={scale} />
      </motion.div>
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

function DropIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 3c3.5 4.2 6 7.6 6 10.5a6 6 0 01-12 0C6 10.6 8.5 7.2 12 3z" />
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
