import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import type { AgentState, Look } from "@agentsquad/shared"
import LeadPreview from "../builder/LeadPreview"
import ArtImage from "../ui/ArtImage"
import type { Agent, Who } from "./store"

// Code-drawn chibi until sprite PNGs land. Swap this one component for <ArtImage src=/art/sprites/<id>.png> later.
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

// The lead's deployed look, scaled to whatever width the parent gives it.
function LeadLook({ look, crop }: { look: Look; crop?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div
      ref={ref} className="flex w-full justify-center"
      style={{ aspectRatio: crop ? "1" : "20 / 22", alignItems: crop ? "flex-start" : "flex-end", overflow: crop ? "hidden" : "visible" }}
    >
      {w > 0 && <LeadPreview look={look} height={crop ? w * 4 : w * 1.4} />}
    </div>
  )
}

// One path for every character body: the deployed lead look, otherwise the drawn chibi.
function Body({ who, seed, raise, bust }: { who: Who; seed: string; raise?: boolean; bust?: boolean }) {
  if (who.look) return <LeadLook look={who.look} crop={bust} />
  return <Sprite color={who.color} seed={seed} lead={who.lead} raise={raise} bust={bust} />
}

export function Portrait({ who, seed, className = "" }: { who: Who; seed: string; className?: string }) {
  const ok = useImage(who.portrait)
  if (ok && who.portrait) return <ArtImage src={who.portrait} label={who.name} color={who.color} className={`object-cover ${className}`} />
  return (
    <div className={`overflow-hidden border-2 border-black/70 ${className}`} style={{ background: shade(who.color, 0.35) }}>
      <div className="px-[8%] pt-[10%]">
        <Body who={who} seed={seed} bust />
      </div>
    </div>
  )
}

function Icon({ state }: { state: AgentState }) {
  const px = (x: number, y: number, w: number, h: number, c = "#0b0f1a") => <rect x={x} y={y} width={w} height={h} fill={c} />
  let body: React.ReactNode = null
  if (state === "reading") body = <>{px(1, 2, 4, 7, "#3b82f6")}{px(5, 2, 4, 7, "#60a5fa")}{px(5, 2, 0.6, 7)}{px(1, 9, 8, 1)}</>
  if (state === "writing") body = <>{px(0, 3, 10, 6, "#334155")}{[1, 3, 5, 7].map((x) => <rect key={x} x={x} y={4} width={1.4} height={1.2} fill="#e2e8f0" />)}{px(2, 6.5, 6, 1.2, "#e2e8f0")}</>
  if (state === "running") body = <>{px(0, 1, 10, 8)}{px(1, 2, 8, 6, "#0f172a")}{px(2, 3, 1, 1, "#22c55e")}{px(3, 4, 1, 1, "#22c55e")}{px(2, 5, 1, 1, "#22c55e")}{px(4, 6, 3, 1, "#22c55e")}</>
  if (state === "searching") body = <><circle cx={4} cy={4} r={3} fill="#bae6fd" stroke="#0b0f1a" strokeWidth={1.2} /><rect x={6} y={6.3} width={4} height={1.6} fill="#0b0f1a" transform="rotate(45 6 6.3)" /></>
  if (state === "thinking") body = <>{[1.5, 5, 8.5].map((x, i) => <motion.circle key={x} cx={x} cy={5} r={1.1} fill="#0b0f1a" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />)}</>
  if (!body) return null
  return (
    <div className="rounded-[3px] border-2 border-black/80 bg-white/90 p-[2px] shadow-[2px_2px_0_rgba(0,0,0,.5)]" style={{ width: "max(18px, 1.3cqw)" }}>
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
      <Flame className="bottom-[78%] left-[25%] w-[50%]" delay={0.2} />
      {!small && [0, 1, 2].map((i) => (
        <motion.div
          key={i} className="absolute top-[-25%] rounded-full bg-slate-400/70"
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

// The character plus every status effect. The parent positions it (feet at the bottom center) and sets its width.
export function Actor({ who, agent, seed, bubble = true, icon = true }: { who: Who; agent?: Agent; seed: string; bubble?: boolean; icon?: boolean }) {
  const state = agent?.state ?? "idle"
  const waiting = state === "waiting"
  const error = state === "error"
  const [bob] = useState(() => 1.1 + Math.random() * 0.5)
  return (
    <div className="relative">
      <div className="absolute bottom-full left-1/2 flex -translate-x-1/2 flex-col items-center">
        {bubble && <Bubble text={agent?.narration} color={who.color} at={agent?.narrationAt ?? 0} />}
        {waiting ? (
          <motion.div
            className="mb-[2px] flex items-center justify-center rounded-[3px] border-2 border-black bg-yellow-300 font-pixel text-black shadow-[2px_2px_0_rgba(0,0,0,.5)]"
            style={{ width: "max(18px, 1.3cqw)", height: "max(20px, 1.5cqw)", fontSize: "max(10px, 0.8cqw)" }}
            animate={{ y: [0, -4, 0] }} transition={{ duration: 0.7, repeat: Infinity }}
          >!</motion.div>
        ) : state === "done" ? (
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="mb-[2px] flex items-center justify-center rounded-full border-2 border-black bg-green-500 shadow-[2px_2px_0_rgba(0,0,0,.5)]"
            style={{ width: "max(18px, 1.3cqw)", aspectRatio: "1" }}
          >
            <svg viewBox="0 0 10 10" className="w-[70%]"><path d="M2 5.2 L4.2 7.4 L8 2.8" stroke="white" strokeWidth={1.8} fill="none" /></svg>
          </motion.div>
        ) : icon && !error ? <Icon state={state} /> : null}
      </div>
      {waiting && (
        <motion.div
          className="absolute left-1/2 top-1/2 -z-0 w-[190%] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ aspectRatio: "1", background: "radial-gradient(circle, rgba(253,224,71,.95) 0%, rgba(250,204,21,.55) 40%, rgba(250,204,21,0) 70%)" }}
          animate={{ opacity: [0.6, 1, 0.6], scale: [0.95, 1.05, 0.95] }} transition={{ duration: 1.2, repeat: Infinity }}
        />
      )}
      <div className="absolute bottom-[-4%] left-1/2 h-[10%] w-[80%] -translate-x-1/2 rounded-[50%] bg-black/35" />
      <motion.div className="relative" animate={{ y: ["0%", "-4%", "0%"] }} transition={{ duration: bob, repeat: Infinity, ease: "easeInOut" }}>
        <Body who={who} seed={seed} raise={waiting} />
        {error && <Fire />}
        {agent && Date.now() - agent.fixedAt < 1500 && <Puff key={agent.fixedAt} />}
      </motion.div>
    </div>
  )
}
