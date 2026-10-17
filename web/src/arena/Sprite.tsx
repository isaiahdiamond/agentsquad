import { createContext, useContext, useEffect, useRef, useState } from "react"
import { motion, motionValue, useTransform, type MotionValue } from "framer-motion"
import type { AgentState } from "@agentsquad/shared"
import { spriteSet, useSprites, type SpriteManifest, type SpriteView } from "../ui/sprites"
import type { Agent, Who } from "./store"
import { Scope, positions, verbOf } from "./world"

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

export type Size = { w: number; h: number }
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

// The stage is the scene art at native size. Everything in it is placed in native pixels; one transform scales it to the screen.
export const W = 2688
export const H = 1520

// fit = screen px per native px at rest; ui = native px per screen px right now (follows the camera zoom).
// Overlays inside the stage scale by var(--ui), so labels keep their design size on screen at any window size or zoom.
export const Stage = createContext({ fit: 0.5, ui: motionValue(2) })

export function useUi() {
  return useContext(Stage).ui
}

const ZERO = motionValue(0)

// Puts the child's bottom center on (x, y), fractions of the scene, raised by dy native px. Y-sorted unless z is given.
export function Placed({ x, y, o, z, dy = ZERO, children }: { x: MotionValue<number>; y: MotionValue<number>; o?: MotionValue<number>; z?: number; dy?: MotionValue<number>; children: React.ReactNode }) {
  const left = useTransform(x, (v) => Math.round(v * W))
  const top = useTransform([y, dy], ([v, d]: number[]) => Math.round(v * H + d))
  const zy = useTransform(y, (v) => Math.round(v * H))
  return (
    <motion.div className="pointer-events-none absolute" style={{ left, top, opacity: o, zIndex: z ?? zy, translateX: "-50%", translateY: "-100%" }}>
      {children}
    </motion.div>
  )
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
export function useManifest() {
  const { sprites, error } = useSprites()
  if (sprites) cached = sprites
  const m = sprites ?? cached
  return { m, ready: !!m || !!error }
}

// Unknown agent types (e.g. general-purpose) borrow the default lead sprite in greyscale, so they stay the right size.
function useSpriteSet(who: Who) {
  const { m, ready } = useManifest()
  const own = !m ? null : who.lead ? spriteSet(m, "lead", who.look ?? null) ?? spriteSet(m, "lead") : spriteSet(m, who.type)
  const generic = !!m && !own && !who.lead
  return { set: own ?? (generic ? spriteSet(m, "lead") : null), ready, generic }
}

const GENERIC = "grayscale(1) brightness(1.05) contrast(0.9)"

export const TALL = 96
const BOX = 48
// Seated agents are always behind a desk: their feet are clipped so they never show under it.
const FEET = 14
const TYPING: AgentState[] = ["reading", "writing", "running", "searching"]

function Frame({ src, alt, nat, s, flip, shown = true }: { src: string; alt: string; nat: Size; s: number; flip?: boolean; shown?: boolean }) {
  return (
    <img
      src={src} alt={alt} draggable={false}
      className="pixelated absolute bottom-0 left-1/2 max-w-none select-none"
      style={{ width: nat.w * s, height: nat.h * s, transform: `translateX(-50%)${flip ? " scaleX(-1)" : ""}`, visibility: shown ? "visible" : "hidden" }}
    />
  )
}

// Seated frames: specialists alternate sit[0]/sit[1] every 180ms while typing; the lead has one frame and bobs instead.
function Seated({ sit, alt, s, typing }: { sit: string[]; alt: string; s: number; typing: boolean }) {
  const a = useNatural(sit[0]), b = useNatural(sit[1])
  const [i, setI] = useState(0)
  const two = sit.length > 1 && !!b
  useEffect(() => {
    setI(0)
    if (!typing || !two) return
    const t = setInterval(() => setI((v) => 1 - v), 180)
    return () => clearInterval(t)
  }, [typing, two])
  if (!a) return null
  const bob = typing && !two
  return (
    <motion.div
      key={bob ? "bob" : "still"} className="absolute inset-0"
      animate={{ y: bob ? [0, -s, 0] : 0 }}
      transition={bob ? { duration: 0.36, repeat: Infinity, ease: stepped } : { duration: 0 }}
    >
      <Frame src={sit[0]} alt={alt} nat={a} s={s} shown={i === 0 || !two} />
      {two && b && <Frame src={sit[1]} alt="" nat={b} s={s} shown={i === 1} />}
    </motion.div>
  )
}

// One path for every character body: the sprite PNG at scene scale s, or the drawn chibi when the art is missing.
// Standing and seated are both mounted so sitting down is a 150ms crossfade.
function Body({ who, seed, s, view, flip, seated, typing }: { who: Who; seed: string; s: number; view: SpriteView; flip: boolean; seated: boolean; typing: boolean }) {
  const { set, ready, generic } = useSpriteSet(who)
  const src = set?.[view]
  const nat = useNatural(src)
  const sitNat = useNatural(set?.sit?.[0])
  const sit = set?.sit?.length && nat && sitNat ? set.sit : null
  if (!ready || (src && nat === undefined)) return null
  const fade = { duration: 0.15 }
  return (
    <div className="absolute inset-0" style={{ filter: generic ? GENERIC : undefined }}>
      <motion.div className="absolute inset-0" initial={false} animate={{ opacity: seated && sit ? 0 : 1 }} transition={fade}>
        {src && nat ? <Frame src={src} alt={who.name} nat={nat} s={s} flip={flip} /> : (
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2" style={{ width: 44 * s }}>
            <Sprite color={who.color} seed={seed} lead={who.lead} raise={view === "hand"} />
          </div>
        )}
      </motion.div>
      {sit && (
        <motion.div className="absolute inset-0" style={{ clipPath: `inset(-50% -50% ${FEET * s}px -50%)` }} initial={false} animate={{ opacity: seated ? 1 : 0 }} transition={fade}>
          <Seated sit={sit} alt={who.name} s={s} typing={typing} />
        </motion.div>
      )}
    </div>
  )
}

// Head crop of the front sprite at a whole-number scale, size x size px.
export function Portrait({ who, seed, size, className = "" }: { who: Who; seed: string; size: number; className?: string }) {
  const { set, ready, generic } = useSpriteSet(who)
  const nat = useNatural(set?.front)
  const k = size < 26 ? size / 34 : Math.max(1, Math.round(size / 36))
  return (
    <div className={`relative shrink-0 overflow-hidden ${className}`} style={{ width: size, height: size, background: shade(who.color, 0.3) }}>
      {ready && set && nat ? (
        <img
          src={set.front} alt="" draggable={false} className="pixelated absolute max-w-none select-none"
          style={{ filter: generic ? GENERIC : undefined,  width: nat.w * k, height: nat.h * k, left: Math.round((size - nat.w * k) / 2), top: -k }}
        />
      ) : ready && nat === false ? (
        <div className="px-[8%] pt-[10%]"><Sprite color={who.color} seed={seed} lead={who.lead} bust /></div>
      ) : null}
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

const stepped = (t: number) => (t < 0.5 ? 0 : 1)

// The nameplate above each head: role · verb, one line, 11px on screen. Waiting turns it yellow, error red, done green.
export function Nameplate({ label, agent, color }: { label: string; agent?: Agent; color: string }) {
  const state = agent?.state ?? "idle"
  const verb = useSettled(agent ? verbOf(agent) : "on call", !!agent && (!!agent.doneAt || state === "waiting" || state === "error"))
  const waiting = state === "waiting" && !agent?.doneAt
  const error = state === "error" && !agent?.doneAt
  return (
    <div
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-[3px] text-[11px] leading-[14px] ${waiting ? "border-amber-300 bg-amber-400 text-[#0b0d12]" : "border-white/[0.08] bg-[rgba(11,13,18,0.72)] text-white"}`}
    >
      {agent?.doneAt ? (
        <span className="flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500">
          <svg viewBox="0 0 10 10" className="w-2"><path d="M2 5.2 L4.2 7.4 L8 2.8" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
        </span>
      ) : waiting ? (
        <span className="flex h-3 w-3 items-center justify-center rounded-full bg-[#0b0d12] text-[9px] font-extrabold text-amber-300">!</span>
      ) : (
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: error ? "#ef4444" : color }} />
      )}
      <span className="font-semibold">{label}</span>
      <span className={waiting ? "text-[#0b0d12]/70" : error ? "text-red-300" : "text-white/60"}>· {verb}</span>
    </div>
  )
}

// The latest text, but never changing more than once per 1.5s: rapid updates settle on the newest one. Urgent text shows at once.
export function useSettled(text: string, urgent: boolean) {
  const [shown, setShown] = useState(text)
  const last = useRef(0)
  useEffect(() => {
    if (text === shown) return
    const t = setTimeout(() => {
      last.current = Date.now()
      setShown(text)
    }, urgent ? 0 : Math.max(0, last.current + 1500 - Date.now()))
    return () => clearTimeout(t)
  }, [text, shown, urgent])
  return shown
}

// The character plus every status effect. x, y put the feet (bottom center) on the scene; s is the scene scale.
// The body is y-sorted with the desks; the nameplate, fire and puff sit above everything. dy lifts the whole character
// (the portal fall) and squash scales the body from the feet (the landing).
export function Actor({ who, agent, label, seed, s, x, y, o, dy, squash, face = STANDING, seated = false, plate = true }: {
  who: Who; agent?: Agent; label?: string; seed: string; s: number; x: MotionValue<number>; y: MotionValue<number>; o?: MotionValue<number>
  dy?: MotionValue<number>; squash?: MotionValue<number>; face?: Face; seated?: boolean; plate?: boolean
}) {
  const state = agent?.state ?? "idle"
  const waiting = state === "waiting"
  const error = state === "error"
  const scope = useContext(Scope)
  const [bob] = useState(() => 1.1 + Math.random() * 0.5)
  const view: SpriteView = waiting ? "hand" : face.back ? "back" : "front"
  const box = { width: BOX * s, height: TALL * s }
  const id = agent?.id ?? seed
  useEffect(() => {
    const key = `${scope}:${id}`
    const p = { x, y, o, dy, s }
    positions.set(key, p)
    return () => {
      if (positions.get(key) === p) positions.delete(key)
    }
  }, [scope, id, x, y, o, dy, s])
  return (
    <>
      <Placed x={x} y={y} o={o} dy={dy}>
        <motion.div className="relative" style={{ ...box, scaleY: squash, originY: 1 }}>
          {waiting && (
            <motion.div
              className="absolute left-1/2 top-1/2 rounded-full"
              style={{ width: 84 * s, height: 110 * s, marginLeft: -42 * s, marginTop: -55 * s, background: "radial-gradient(closest-side, rgba(253,224,71,.8) 0%, rgba(250,204,21,.4) 50%, rgba(250,204,21,0) 100%)" }}
              animate={{ opacity: [0.6, 1, 0.6], scale: [0.95, 1.05, 0.95] }} transition={{ duration: 1.2, repeat: Infinity }}
            />
          )}
          <motion.div
            className="absolute left-1/2 rounded-[50%] bg-black"
            style={{ width: 26 * s, height: 7 * s, marginLeft: -13 * s, bottom: -3 * s }}
            initial={false} animate={{ opacity: seated ? 0 : 0.2 }} transition={{ duration: 0.15 }}
          />
          <motion.div
            key={seated ? "seated" : face.walking ? "walk" : "idle"} className="absolute inset-0"
            style={{ filter: waiting ? `drop-shadow(0 0 ${1.5 * s}px #facc15) drop-shadow(0 0 ${5 * s}px rgba(250,204,21,.75))` : undefined }}
            animate={{ y: seated ? 0 : [0, -s, 0] }}
            transition={seated ? { duration: 0 } : face.walking ? { duration: 0.34, repeat: Infinity, ease: stepped } : { duration: bob, repeat: Infinity, ease: stepped }}
          >
            <Body who={who} seed={seed} s={s} view={view} flip={face.flip} seated={seated} typing={seated && TYPING.includes(state)} />
          </motion.div>
        </motion.div>
      </Placed>
      <Placed x={x} y={y} o={o} dy={dy} z={5000}>
        <div className="relative" style={box}>
          {plate && label && (
            <div className="absolute bottom-full left-1/2" style={{ marginBottom: 3 * s, transform: "translateX(-50%) scale(var(--ui))", transformOrigin: "50% 100%" }}>
              <Nameplate label={label} agent={agent} color={who.color} />
            </div>
          )}
          {error && <div className="absolute inset-x-0 top-0" style={{ height: seated ? "55%" : "100%" }}><Fire /></div>}
          {agent && Date.now() - agent.fixedAt < 1500 && <Puff key={agent.fixedAt} />}
        </div>
      </Placed>
    </>
  )
}
