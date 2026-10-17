import { createContext, useContext, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, type MotionValue } from "framer-motion"
import type { AgentState } from "@agentsquad/shared"
import { spriteSet, useSprites, type SpriteManifest, type SpriteView } from "../ui/sprites"
import type { Agent, Who } from "./store"

// Code-drawn chibi, only used when sprites.json has no sprite for a character or its file is broken.
const BODY = [
  "....oooooooo....",
  "...ohhhhhhhho...",
  "..ohhhhhhhhhho..",
  ".ohhhhhhhhhhhho.",
  ".ohhsssssssshho.",
  ".ohssssssssssho.",
  ".osseesssseesso.",
  ".osseesssseesso.",
  ".osrssssssssrso.",
  "..ossssmmsssso..",
  "...oooooooooo...",
  "...obbbbbbbbo...",
  "..obbbbbbbbbbo..",
  ".obbbbbbbbbbbbo.",
  ".obdbbbbbbbbdbo.",
  ".osdbbbbbbbbdso.",
  "...oppppppppo...",
  "...opppoopppo...",
  "...okkkookkko...",
  "...oooooooooo...",
]

const HAIRS = ["#3b2416", "#1f2937", "#7c2d12", "#a16207", "#4c1d95", "#0f172a"]

export function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16)
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))))
  return `rgb(${c.join(",")})`
}

function hairFor(seed: string) {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return HAIRS[h % HAIRS.length]
}

export function Sprite({ color, seed, lead, raise, bust }: { color: string; seed: string; lead?: boolean; raise?: boolean; bust?: boolean }) {
  const fill: Record<string, string> = {
    o: "#0b0f1a", h: lead ? "#2a1a10" : hairFor(seed), s: "#f2c79b", e: "#0b0f1a", r: "#f29b8b", m: "#7a3b2e",
    b: color, d: shade(color, 0.7), p: "#273449", k: "#111827",
  }
  const rows = raise ? BODY.map((r, y) => (y === 15 ? ".osdbbbbbbbbdbo." : r)) : BODY
  const rects: React.ReactElement[] = []
  rows.forEach((row, y) => {
    if (bust && y > 13) return
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (ch !== ".") rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={fill[ch]} />)
    }
  })
  return (
    <svg viewBox={bust ? "0 0 16 14" : "-2 -2 20 22"} className="block h-auto w-full overflow-visible" shapeRendering="crispEdges">
      {rects}
      {lead && !bust && <rect x={7} y={12} width={2} height={2} fill="#fff7cc" />}
      {raise && (
        <g>
          <rect x={14} y={4} width={2} height={9} fill="#0b0f1a" />
          <rect x={14.5} y={6} width={1} height={7} fill={color} />
          <rect x={14} y={2} width={2} height={3} fill="#0b0f1a" />
          <rect x={14.5} y={2.5} width={1} height={3} fill="#f2c79b" />
        </g>
      )}
    </svg>
  )
}

type Size = { w: number; h: number }
const probed = new Map<string, Size | false>()

// Natural size of an image: undefined while loading, false when the file is missing or broken.
export function useNatural(src?: string) {
  const [size, setSize] = useState<Size | false | undefined>(src ? probed.get(src) : false)
  useEffect(() => {
    if (!src) return setSize(false)
    if (probed.has(src)) return setSize(probed.get(src))
    setSize(undefined)
    const img = new Image()
    const settle = (s: Size | false) => {
      probed.set(src, s)
      setSize(s)
    }
    img.onload = () => settle(img.naturalWidth ? { w: img.naturalWidth, h: img.naturalHeight } : false)
    img.onerror = () => settle(false)
    img.src = src
  }, [src])
  return size
}

export function useImage(src?: string) {
  const size = useNatural(src)
  return size === undefined ? undefined : !!size
}

// Stage size in px. Sprite pixel scale = round(spot.scale * stage height / 900), so spot.scale is the scale on a 1600x900 stage.
export const Stage = createContext({ w: 1600, h: 900 })

export function pxScale(scale: number, stageH: number) {
  return Math.max(1, Math.round((scale * stageH) / 900))
}

export function usePx(s: MotionValue<number>) {
  const { h } = useContext(Stage)
  const [k, setK] = useState(() => pxScale(s.get(), h))
  useEffect(() => {
    setK(pxScale(s.get(), h))
    return s.on("change", (v) => setK(pxScale(v, h)))
  }, [s, h])
  return k
}

export type Face = { back: boolean; flip: boolean; walking: boolean }

export const STANDING: Face = { back: false, flip: false, walking: false }

// Which way a moving character faces. The art faces down-right (front) and up-left (back); other directions are mirrored.
export function useFacing(x: MotionValue<number>, y: MotionValue<number>) {
  const [face, setFace] = useState(STANDING)
  const last = useRef({ x: x.get(), y: y.get() })
  useEffect(() => {
    let stop: ReturnType<typeof setTimeout>
    const on = () => {
      const dx = x.get() - last.current.x
      const dy = (y.get() - last.current.y) * 0.5625
      if (Math.hypot(dx, dy) < 0.002) return
      last.current = { x: x.get(), y: y.get() }
      const back = dy < -Math.abs(dx) * 0.3
      setFace((f) => {
        const flip = Math.abs(dx) > 0.0005 ? (back ? dx > 0 : dx < 0) : f.flip
        return f.walking && f.back === back && f.flip === flip ? f : { back, flip, walking: true }
      })
      clearTimeout(stop)
      stop = setTimeout(() => setFace((f) => ({ back: false, flip: f.back ? !f.flip : f.flip, walking: false })), 160)
    }
    const offX = x.on("change", on)
    const offY = y.on("change", on)
    return () => {
      offX()
      offY()
      clearTimeout(stop)
    }
  }, [x, y])
  return face
}

let cached: SpriteManifest | null = null

// The manifest, and whether it has settled (loaded or failed), so nothing flashes the fallback while it loads.
function useManifest() {
  const { sprites, error } = useSprites()
  if (sprites) cached = sprites
  const m = sprites ?? cached
  return { m, ready: !!m || !!error }
}

function useSpriteSet(who: Who) {
  const { m, ready } = useManifest()
  const set = !m ? null : who.lead ? spriteSet(m, "lead", who.look ?? null) ?? spriteSet(m, "lead") : spriteSet(m, who.type)
  return { set, ready }
}

const H = 96
const BOX = 48

// One path for every character body: the sprite PNG at integer scale k, or the drawn chibi when the art is missing.
// Positioned in whole pixels so odd-width sprites never land on half pixels.
function Body({ who, seed, k, view, flip }: { who: Who; seed: string; k: number; view: SpriteView; flip: boolean }) {
  const { set, ready } = useSpriteSet(who)
  const src = set?.[view]
  const nat = useNatural(src)
  if (!ready || (src && nat === undefined)) return null
  if (src && nat) {
    return (
      <img
        src={src} alt={who.name} draggable={false}
        className="pixelated absolute bottom-0 max-w-none select-none"
        style={{ width: nat.w * k, height: nat.h * k, left: Math.round((BOX * k - nat.w * k) / 2), transform: flip ? "scaleX(-1)" : undefined }}
      />
    )
  }
  return (
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2" style={{ width: H * k * (20 / 22) }}>
      <Sprite color={who.color} seed={seed} lead={who.lead} raise={view === "hand"} />
    </div>
  )
}

// Head crop of the front sprite at a whole-number scale, size x size px.
export function Portrait({ who, seed, size, className = "" }: { who: Who; seed: string; size: number; className?: string }) {
  const { set, ready } = useSpriteSet(who)
  const nat = useNatural(set?.front)
  const k = Math.max(1, Math.round(size / 36))
  return (
    <div className={`relative shrink-0 overflow-hidden ${className}`} style={{ width: size, height: size, background: shade(who.color, 0.3) }}>
      {ready && set && nat ? (
        <img
          src={set.front} alt="" draggable={false} className="pixelated absolute max-w-none select-none"
          style={{ width: nat.w * k, height: nat.h * k, left: Math.round((size - nat.w * k) / 2), top: -k }}
        />
      ) : ready && nat === false ? (
        <div className="px-[8%] pt-[10%]"><Sprite color={who.color} seed={seed} lead={who.lead} bust /></div>
      ) : null}
    </div>
  )
}

function Icon({ state, size }: { state: AgentState; size: number }) {
  const line = { fill: "none", stroke: "#0b0d12", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  let body: React.ReactNode = null
  if (state === "reading") body = <><path d="M2 4.5c2-1 4-1 6 .5v10c-2-1.5-4-1.5-6-.5z" {...line} /><path d="M18 4.5c-2-1-4-1-6 .5v10c2-1.5 4-1.5 6-.5z" {...line} /></>
  if (state === "writing") body = <><rect x={2} y={5} width={16} height={10} rx={2} {...line} /><path d="M5 8.5h1M8 8.5h1M11 8.5h1M14 8.5h1M6 12h8" {...line} /></>
  if (state === "running") body = <><rect x={2} y={3.5} width={16} height={13} rx={2} {...line} /><path d="M5.5 8l2.5 2-2.5 2M10 13h4" {...line} stroke="#16a34a" /></>
  if (state === "searching") body = <><circle cx={8.5} cy={8.5} r={5} {...line} /><path d="M12.5 12.5L17 17" {...line} /></>
  if (state === "thinking") body = <>{[5, 10, 15].map((x, i) => <motion.circle key={x} cx={x} cy={10} r={1.6} fill="#0b0d12" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />)}</>
  if (!body) return null
  return (
    <div className="flex items-center justify-center rounded-lg bg-white/95 shadow-[0_2px_8px_rgba(0,0,0,.35)] ring-1 ring-black/10" style={{ width: size, height: size }}>
      <svg viewBox="0 0 20 20" style={{ width: size * 0.7 }}>{body}</svg>
    </div>
  )
}

function Flame({ delay = 0, className = "" }: { delay?: number; className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 20 28" className={`absolute ${className}`} style={{ originY: 1 }}
      animate={{ scaleY: [1, 1.18, 0.92, 1.1, 1], scaleX: [1, 0.92, 1.06, 0.95, 1], skewX: [0, 3, -3, 2, 0] }}
      transition={{ duration: 0.6, repeat: Infinity, delay, ease: "linear" }}
    >
      <path d="M10 0 C14 8 20 12 18 20 C17 25 13 28 10 28 C7 28 3 25 2 20 C0 12 6 8 10 0Z" fill="#ef4444" />
      <path d="M10 8 C13 13 16 16 14.5 21 C13.5 24 12 25.5 10 25.5 C8 25.5 6.5 24 5.5 21 C4 16 7 13 10 8Z" fill="#f97316" />
      <path d="M10 15 C12 18 13 20 12 23 C11.5 24.3 10.8 25 10 25 C9.2 25 8.5 24.3 8 23 C7 20 8 18 10 15Z" fill="#fde047" />
    </motion.svg>
  )
}

export function Fire() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <Flame className="bottom-[1%] left-[-6%] w-[40%]" delay={0.1} />
      <Flame className="bottom-[4%] right-[-8%] w-[36%]" delay={0.3} />
      <Flame className="bottom-[40%] left-[-14%] w-[30%]" delay={0.45} />
      <Flame className="bottom-[88%] left-[30%] w-[40%]" delay={0.2} />
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i} className="absolute top-[-8%] rounded-full bg-slate-400/60"
          style={{ left: `${22 + i * 20}%`, width: "26%", aspectRatio: "1" }}
          animate={{ y: ["0%", "-220%"], opacity: [0, 0.7, 0], scale: [0.5, 1.4] }}
          transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.6, ease: "easeOut" }}
        />
      ))}
    </div>
  )
}

export function FlameBadge({ size = 16 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size * 1.4 }}>
      <Flame className="inset-0 h-full w-full" />
    </div>
  )
}

function Puff() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2
        return (
          <motion.div
            key={i} className="absolute left-[30%] top-[40%] w-[40%] rounded-full bg-white shadow-[0_0_0_1px_rgba(148,163,184,.6)]"
            style={{ aspectRatio: "1" }}
            initial={{ x: 0, y: 0, opacity: 0.95, scale: 0.4 }}
            animate={{ x: `${Math.cos(a) * 110}%`, y: `${Math.sin(a) * 110}%`, opacity: 0, scale: 1.3 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        )
      })}
    </div>
  )
}

export function Bubble({ text, color, at }: { text?: string; color: string; at: number }) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!text) return
    setShown(true)
    const t = setTimeout(() => setShown(false), 5000)
    return () => clearTimeout(t)
  }, [text, at])
  return (
    <AnimatePresence>
      {shown && text && (
        <motion.div
          key={at} initial={{ opacity: 0, y: 6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }}
          className="relative mb-2 flex items-start gap-1.5 rounded-xl bg-white px-2.5 py-1.5 font-medium leading-snug text-[#0b0d12] shadow-[0_4px_14px_rgba(0,0,0,.35)]"
          style={{ fontSize: "max(11px, 0.78cqw)", width: "max-content", maxWidth: "max(160px, 12cqw)" }}
        >
          <span className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
          {text}
          <div className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-white" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const stepped = (t: number) => (t < 0.5 ? 0 : 1)

// The character plus every status effect, k screen pixels per art pixel. The parent puts the bottom center at the feet.
export function Actor({ who, agent, seed, k, face = STANDING, bubble = true, icon = true }: { who: Who; agent?: Agent; seed: string; k: number; face?: Face; bubble?: boolean; icon?: boolean }) {
  const state = agent?.state ?? "idle"
  const waiting = state === "waiting"
  const error = state === "error"
  const [bob] = useState(() => 1.1 + Math.random() * 0.5)
  const view: SpriteView = waiting ? "hand" : face.back ? "back" : "front"
  const badge = 16 + 6 * k
  return (
    <div className="relative" style={{ width: BOX * k, height: H * k }}>
      <div className="absolute bottom-full left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ marginBottom: 2 * k }}>
        {bubble && <Bubble text={agent?.narration} color={who.color} at={agent?.narrationAt ?? 0} />}
        {waiting ? (
          <motion.div
            className="flex items-center justify-center rounded-full bg-amber-400 font-extrabold text-[#0b0d12] shadow-[0_0_0_3px_rgba(251,191,36,.35),0_2px_8px_rgba(0,0,0,.35)]"
            style={{ width: badge, height: badge, fontSize: badge * 0.62 }}
            animate={{ y: [0, -4, 0] }} transition={{ duration: 0.7, repeat: Infinity }}
          >!</motion.div>
        ) : state === "done" ? (
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="flex items-center justify-center rounded-full bg-emerald-500 shadow-[0_2px_8px_rgba(0,0,0,.35)]"
            style={{ width: badge, height: badge }}
          >
            <svg viewBox="0 0 10 10" className="w-[62%]"><path d="M2 5.2 L4.2 7.4 L8 2.8" stroke="white" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
          </motion.div>
        ) : icon && !error ? <Icon state={state} size={badge} /> : null}
      </div>
      {waiting && (
        <motion.div
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{ width: 84 * k, height: 110 * k, marginLeft: -42 * k, marginTop: -55 * k, background: "radial-gradient(closest-side, rgba(253,224,71,.8) 0%, rgba(250,204,21,.4) 50%, rgba(250,204,21,0) 100%)" }}
          animate={{ opacity: [0.6, 1, 0.6], scale: [0.95, 1.05, 0.95] }} transition={{ duration: 1.2, repeat: Infinity }}
        />
      )}
      <div className="absolute left-1/2 rounded-[50%] bg-black/35" style={{ width: 28 * k, height: 7 * k, marginLeft: -14 * k, bottom: -3 * k }} />
      <motion.div
        key={face.walking ? "walk" : "idle"} className="absolute inset-0"
        animate={{ y: [0, -k, 0] }}
        transition={face.walking ? { duration: 0.34, repeat: Infinity, ease: stepped } : { duration: bob, repeat: Infinity, ease: stepped }}
      >
        <Body who={who} seed={seed} k={k} view={view} flip={face.flip} />
      </motion.div>
      {error && <Fire />}
      {agent && Date.now() - agent.fixedAt < 1500 && <Puff key={agent.fixedAt} />}
    </div>
  )
}
