import { createContext, useContext, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, type MotionValue } from "framer-motion"
import type { AgentState } from "@agentsquad/shared"
import { spriteSet, useSprites, type SpriteManifest, type SpriteView } from "../ui/sprites"
import type { Agent, Who } from "./store"

// Code-drawn chibi, only used when sprites.json has no sprite for a character.
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

function shade(hex: string, f: number) {
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

const probed = new Map<string, boolean>()

export function useImage(src?: string) {
  const [ok, setOk] = useState(src ? probed.get(src) : false)
  useEffect(() => {
    if (!src) return setOk(false)
    if (probed.has(src)) return setOk(probed.get(src))
    const img = new Image()
    const settle = (ok: boolean) => {
      probed.set(src, ok)
      setOk(ok)
    }
    img.onload = () => settle(true)
    img.onerror = () => settle(false)
    img.src = src
  }, [src])
  return ok
}

// Stage height in px. Sprite pixel scale = round(spot.scale * stage height / 900), so spot.scale is the scale on a 1600x900 stage.
export const StageH = createContext(900)

export function pxScale(scale: number, stageH: number) {
  return Math.max(1, Math.round((scale * stageH) / 900))
}

export function usePx(s: MotionValue<number>) {
  const h = useContext(StageH)
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

function useManifest() {
  const { sprites } = useSprites()
  if (sprites) cached = sprites
  return sprites ?? cached
}

function spritesFor(m: SpriteManifest | null, who: Who) {
  if (!who.lead) return spriteSet(m, who.type)
  return spriteSet(m, "lead", who.look ?? null) ?? spriteSet(m, "lead")
}

const H = 44
const BOX = 24

// One path for every character body: the sprite PNG at integer scale k, or the drawn chibi when the art is missing.
function Body({ who, seed, k, view, flip }: { who: Who; seed: string; k: number; view: SpriteView; flip: boolean }) {
  const set = spritesFor(useManifest(), who)
  if (set) {
    return (
      <img
        src={set[view]} alt={who.name} draggable={false}
        className="absolute bottom-0 left-1/2 max-w-none"
        style={{ height: H * k, imageRendering: "pixelated", transform: `translateX(-50%)${flip ? " scaleX(-1)" : ""}` }}
      />
    )
  }
  return (
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2" style={{ width: H * k * (20 / 22) }}>
      <Sprite color={who.color} seed={seed} lead={who.lead} raise={view === "hand"} />
    </div>
  )
}

// Head crop of the front sprite, scaled up.
export function Portrait({ who, seed, className = "" }: { who: Who; seed: string; className?: string }) {
  const set = spritesFor(useManifest(), who)
  if (set) {
    return (
      <div
        className={`border-2 border-black/70 ${className}`}
        style={{ background: `url(${set.front}) 50% 6% / auto 260% no-repeat, ${shade(who.color, 0.35)}`, imageRendering: "pixelated" }}
      />
    )
  }
  return (
    <div className={`overflow-hidden border-2 border-black/70 ${className}`} style={{ background: shade(who.color, 0.35) }}>
      <div className="px-[8%] pt-[10%]">
        <Sprite color={who.color} seed={seed} lead={who.lead} bust />
      </div>
    </div>
  )
}

function Icon({ state, size }: { state: AgentState; size: number }) {
  const px = (x: number, y: number, w: number, h: number, c = "#0b0f1a") => <rect x={x} y={y} width={w} height={h} fill={c} />
  let body: React.ReactNode = null
  if (state === "reading") body = <>{px(1, 2, 4, 7, "#3b82f6")}{px(5, 2, 4, 7, "#60a5fa")}{px(5, 2, 0.6, 7)}{px(1, 9, 8, 1)}</>
  if (state === "writing") body = <>{px(0, 3, 10, 6, "#334155")}{[1, 3, 5, 7].map((x) => <rect key={x} x={x} y={4} width={1.4} height={1.2} fill="#e2e8f0" />)}{px(2, 6.5, 6, 1.2, "#e2e8f0")}</>
  if (state === "running") body = <>{px(0, 1, 10, 8)}{px(1, 2, 8, 6, "#0f172a")}{px(2, 3, 1, 1, "#22c55e")}{px(3, 4, 1, 1, "#22c55e")}{px(2, 5, 1, 1, "#22c55e")}{px(4, 6, 3, 1, "#22c55e")}</>
  if (state === "searching") body = <><circle cx={4} cy={4} r={3} fill="#bae6fd" stroke="#0b0f1a" strokeWidth={1.2} /><rect x={6} y={6.3} width={4} height={1.6} fill="#0b0f1a" transform="rotate(45 6 6.3)" /></>
  if (state === "thinking") body = <>{[1.5, 5, 8.5].map((x, i) => <motion.circle key={x} cx={x} cy={5} r={1.1} fill="#0b0f1a" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />)}</>
  if (!body) return null
  return (
    <div className="rounded-[3px] border-2 border-black/80 bg-white/90 p-[2px] shadow-[2px_2px_0_rgba(0,0,0,.5)]" style={{ width: size }}>
      <svg viewBox="0 0 10 10" className="block w-full" shapeRendering="crispEdges">{body}</svg>
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
      <path d="M10 0 C14 8 20 12 18 20 C17 25 13 28 10 28 C7 28 3 25 2 20 C0 12 6 8 10 0Z" fill="#ef4444" stroke="#7f1d1d" strokeWidth={1.2} />
      <path d="M10 8 C13 13 16 16 14.5 21 C13.5 24 12 25.5 10 25.5 C8 25.5 6.5 24 5.5 21 C4 16 7 13 10 8Z" fill="#f97316" />
      <path d="M10 15 C12 18 13 20 12 23 C11.5 24.3 10.8 25 10 25 C9.2 25 8.5 24.3 8 23 C7 20 8 18 10 15Z" fill="#fde047" />
    </motion.svg>
  )
}

export function Fire({ small }: { small?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <Flame className="bottom-[2%] left-[-12%] w-[45%]" delay={0.1} />
      <Flame className="bottom-[8%] right-[-14%] w-[42%]" delay={0.3} />
      <Flame className="bottom-[82%] left-[25%] w-[50%]" delay={0.2} />
      {!small && [0, 1, 2].map((i) => (
        <motion.div
          key={i} className="absolute top-[-12%] rounded-full bg-slate-400/70"
          style={{ left: `${25 + i * 20}%`, width: "22%", aspectRatio: "1" }}
          animate={{ y: ["0%", "-260%"], opacity: [0, 0.8, 0], scale: [0.5, 1.4] }}
          transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.6, ease: "easeOut" }}
        />
      ))}
    </div>
  )
}

export function FlameBadge() {
  return (
    <div className="relative" style={{ width: "max(14px, 1cqw)", height: "max(20px, 1.4cqw)" }}>
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
            key={i} className="absolute left-[35%] top-[35%] w-[30%] rounded-full border-2 border-slate-300 bg-white"
            style={{ aspectRatio: "1" }}
            initial={{ x: 0, y: 0, opacity: 0.95, scale: 0.4 }}
            animate={{ x: `${Math.cos(a) * 120}%`, y: `${Math.sin(a) * 120}%`, opacity: 0, scale: 1.4 }}
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
          key={at} initial={{ opacity: 0, y: 6, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }}
          className="relative mb-[6px] rounded-[3px] border-2 border-black bg-white px-[6px] py-[4px] font-ui leading-tight text-navy-950 shadow-[3px_3px_0_rgba(0,0,0,.45)]"
          style={{ fontSize: "max(9px, 0.62cqw)", width: "max-content", maxWidth: "max(130px, 10cqw)", borderBottomColor: color, borderBottomWidth: 3 }}
        >
          {text}
          <div className="absolute -bottom-[7px] left-1/2 h-[8px] w-[8px] -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-black bg-white" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const stepped = (t: number) => (t < 0.5 ? 0 : 1)

// The character plus every status effect, k sprite pixels per art pixel. The parent puts the bottom center at the feet.
export function Actor({ who, agent, seed, k, face = STANDING, bubble = true, icon = true }: { who: Who; agent?: Agent; seed: string; k: number; face?: Face; bubble?: boolean; icon?: boolean }) {
  const state = agent?.state ?? "idle"
  const waiting = state === "waiting"
  const error = state === "error"
  const [bob] = useState(() => 1.1 + Math.random() * 0.5)
  const view: SpriteView = waiting ? "hand" : face.back ? "back" : "front"
  const badge = 10 + 4 * k
  return (
    <div className="relative" style={{ width: BOX * k, height: H * k }}>
      <div className="absolute bottom-full left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ marginBottom: k }}>
        {bubble && <Bubble text={agent?.narration} color={who.color} at={agent?.narrationAt ?? 0} />}
        {waiting ? (
          <motion.div
            className="mb-[2px] flex items-center justify-center rounded-[3px] border-2 border-black bg-yellow-300 font-pixel text-black shadow-[2px_2px_0_rgba(0,0,0,.5)]"
            style={{ width: badge, height: badge * 1.15, fontSize: badge * 0.6 }}
            animate={{ y: [0, -4, 0] }} transition={{ duration: 0.7, repeat: Infinity }}
          >!</motion.div>
        ) : state === "done" ? (
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="mb-[2px] flex items-center justify-center rounded-full border-2 border-black bg-green-500 shadow-[2px_2px_0_rgba(0,0,0,.5)]"
            style={{ width: badge, height: badge }}
          >
            <svg viewBox="0 0 10 10" className="w-[70%]"><path d="M2 5.2 L4.2 7.4 L8 2.8" stroke="white" strokeWidth={1.8} fill="none" /></svg>
          </motion.div>
        ) : icon && !error ? <Icon state={state} size={badge} /> : null}
      </div>
      {waiting && (
        <motion.div
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{ width: 40 * k, height: 40 * k, marginLeft: -20 * k, marginTop: -20 * k, background: "radial-gradient(circle, rgba(253,224,71,.95) 0%, rgba(250,204,21,.55) 40%, rgba(250,204,21,0) 70%)" }}
          animate={{ opacity: [0.6, 1, 0.6], scale: [0.95, 1.05, 0.95] }} transition={{ duration: 1.2, repeat: Infinity }}
        />
      )}
      <div className="absolute left-1/2 rounded-[50%] bg-black/35" style={{ width: 16 * k, height: 4 * k, marginLeft: -8 * k, bottom: -1.5 * k }} />
      <motion.div
        key={face.walking ? "walk" : "idle"} className="absolute inset-0"
        animate={{ y: [0, -k, 0] }}
        transition={face.walking ? { duration: 0.34, repeat: Infinity, ease: stepped } : { duration: bob, repeat: Infinity, ease: stepped }}
      >
        <Body who={who} seed={seed} k={k} view={view} flip={face.flip} />
        {error && <Fire />}
        {agent && Date.now() - agent.fixedAt < 1500 && <Puff key={agent.fixedAt} />}
      </motion.div>
    </div>
  )
}
