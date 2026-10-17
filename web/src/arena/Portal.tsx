import { useEffect, useRef, useState } from "react"
import { animate, motion, type MotionValue } from "framer-motion"
import type { Spot } from "@agentsquad/shared"
import { H, TALL, W } from "./Sprite"
import type { Agent } from "./store"

// The portal timeline from vault/Session Flow.md, in ms from the portal's start.
export const FALL_AT = 400
export const LAND_AT = 750
export const PORTAL_MS = 1200
// How long a landed agent stands in the half circle (saying its task) before walking off.
export const HOLD_MS = 1800
const STAGGER = 300

export type Portal = { start: number; spot: Spot }

// Slots in a half circle in front of the lead (y grows down the screen), filled in this order.
// Spaced so neighbouring nameplates clear each other: the sides sit level with the lead, the diagonals one plate lower.
const ANGLES = [150, 30, 90, 180, 0]

function slotSpot(lead: Spot, i: number, s: number): Spot {
  const a = (ANGLES[i % ANGLES.length] * Math.PI) / 180
  const r = 150 * s * (1 + Math.floor(i / ANGLES.length) * 0.6)
  return { ...lead, x: Math.round(lead.x * W + Math.cos(a) * r) / W, y: Math.round(lead.y * H + Math.sin(a) * r * 0.55) / H, kind: undefined }
}

// The key of one delegation: agent ids restart every session (frontend-dev-1 again), the first event time doesn't.
export const missionKey = (a: Agent) => `${a.id}:${a.firstAt}`

// One portal per agent delegated after the view opened: a slot in the half circle around the lead, and a start time
// at least 300ms after the previous portal so a burst of delegations reads as a squad assembling. Returned by agent id
// for the agents in this mission only.
export function usePortals(agents: Agent[], lead: Spot, s: number, opened: number) {
  const map = useRef(new Map<string, Portal>())
  const last = useRef(0)
  const fresh = agents.filter((a) => a.type !== "lead" && a.task && a.firstAt > opened - 300).sort((a, b) => a.firstAt - b.firstAt)
  const out = new Map<string, Portal>()
  for (const a of fresh) {
    const key = missionKey(a)
    let p = map.current.get(key)
    if (!p) {
      const start = Math.max(a.firstAt, last.current + STAGGER)
      last.current = start
      const busy = [...map.current.values()].filter((q) => q.start > start - 6000).length
      p = { start, spot: slotSpot(lead, busy, s) }
      map.current.set(key, p)
    }
    out.set(a.id, p)
  }
  return out
}

const wait = (until: number) => new Promise<void>((r) => setTimeout(r, Math.max(0, until - Date.now())))

// The agent's side of the portal: hidden until the fall, drops down the beam from the top of the scene (ease-in),
// lands with a two-frame squash, then stands until the hold is over. Resolves when it may walk.
export async function fall(p: Portal, s: number, o: MotionValue<number>, dy: MotionValue<number>, squash: MotionValue<number>, alive: () => boolean) {
  if (Date.now() > p.start + LAND_AT) return wait(p.start + PORTAL_MS + HOLD_MS)
  o.set(0)
  dy.set(-(p.spot.y * H + TALL * s))
  await wait(p.start + FALL_AT)
  if (!alive()) return
  o.set(1)
  await animate(dy, 0, { duration: (LAND_AT - FALL_AT) / 1000, ease: [0.55, 0, 1, 0.45] })
  if (!alive()) return
  squash.set(0.85)
  await wait(p.start + LAND_AT + 50)
  squash.set(1)
  await wait(p.start + PORTAL_MS + HOLD_MS)
}

const DUST = [[-1, -0.2], [-0.7, -0.75], [-0.2, -1], [0.3, -0.95], [0.75, -0.7], [1, -0.15], [-0.45, 0.25], [0.5, 0.25]]


const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const cache = new Map<string, string>()

// Pixel art drawn once into a small canvas (one canvas pixel = one art pixel) and shown as a pixelated image,
// so it stays crisp at any stage scale: no vector edges, no gradients.
function art(key: string, w: number, h: number, draw: (put: (x: number, y: number, c: number[], a: number) => void) => void) {
  let url = cache.get(key)
  if (url) return url
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  const ctx = c.getContext("2d")!
  const img = ctx.createImageData(w, h)
  draw((x, y, col, a) => {
    const i = (y * w + x) * 4
    img.data.set([col[0], col[1], col[2], Math.round(a * 255)], i)
  })
  ctx.putImageData(img, 0, 0)
  url = c.toDataURL()
  cache.set(key, url)
  return url
}

// Stepped bands, dithered at the edges, brightest in the middle.
function beam(color: string, rows: number) {
  return art(`beam:${color}:${rows}`, 32, rows, (put) => {
    const col = rgb(color), white = [255, 255, 255]
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < 32; x++) {
        const d = Math.abs(x - 15.5)
        if (d > 12) (x + y) % 2 === 0 && put(x, y, col, 0.35)
        else if (d > 7) put(x, y, col, 0.25)
        else if (d > 3) put(x, y, col, 0.38)
        else put(x, y, white, 0.45)
      }
    }
  })
}

// A floor ring: filled ellipse, dashed rim (phase turns it), white inner ring.
function ring(color: string, phase: number) {
  const W0 = 60, H0 = 22, a = 29.5, b = 10.5
  return art(`ring:${color}:${phase}`, W0, H0, (put) => {
    const col = rgb(color), white = [255, 255, 255]
    for (let y = 0; y < H0; y++) {
      for (let x = 0; x < W0; x++) {
        const dx = x + 0.5 - W0 / 2, dy = y + 0.5 - H0 / 2
        const d = (dx / a) ** 2 + (dy / b) ** 2
        if (d > 1) continue
        const ang = (Math.atan2(dy / b, dx / a) + Math.PI) / (Math.PI * 2)
        if (d > 0.72) (Math.floor(ang * 16 + phase / 4) % 2 === 0) && put(x, y, col, 1)
        else if (d > 0.26 && d < 0.36) put(x, y, white, 0.7)
        else put(x, y, col, 0.2)
      }
    }
  })
}

// The effect, drawn with whole art pixels: an accent line from the lead, a dashed floor ring that turns,
// a stepped and dithered light beam, and a burst of pixel dust on landing.
export function PortalFx({ p, color, s, from }: { p: Portal; color: string; s: number; from: Spot }) {
  const [gone, setGone] = useState(Date.now() > p.start + PORTAL_MS + 200)
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    if (gone) return
    const t = setTimeout(() => setGone(true), p.start + PORTAL_MS + 200 - Date.now())
    const spin = setInterval(() => setPhase((v) => (v + 1) % 8), 110)
    return () => {
      clearTimeout(t)
      clearInterval(spin)
    }
  }, [])
  if (gone) return null
  const x = Math.round(p.spot.x * W), y = Math.round(p.spot.y * H)
  const u = Math.max(1, Math.round(s))
  const at = (ms: number) => Math.max(0, (p.start + ms - Date.now()) / 1000)
  const rows = Math.ceil(y / u)
  const fx = Math.round(from.x * W), fy = Math.round(from.y * H - TALL * s * 0.7)
  return (
    <>
      <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={W} height={H} shapeRendering="crispEdges" style={{ zIndex: y - 2 }}>
        <motion.line
          x1={fx} y1={fy} x2={x} y2={y - 10 * u} stroke={color} strokeWidth={2 * u}
          initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: [0, 1, 1], opacity: [1, 1, 0] }}
          transition={{ delay: at(0), duration: 0.85, times: [0, 0.4, 1] }}
        />
      </svg>
      <motion.img
        src={beam(color, rows)} alt="" draggable={false} className="pixelated pointer-events-none absolute max-w-none select-none"
        style={{ left: x - 16 * u, top: y - rows * u, width: 32 * u, height: rows * u, zIndex: y - 2 }}
        initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ delay: at(150), duration: 1.05, times: [0, 0.28, 0.67, 1], ease: "linear" }}
      />
      <motion.img
        src={ring(color, phase)} alt="" draggable={false} className="pixelated pointer-events-none absolute max-w-none select-none"
        style={{ left: x - 30 * u, top: y - 11 * u, width: 60 * u, height: 22 * u, zIndex: y - 1 }}
        initial={{ scale: 0 }} animate={{ scale: [0, 1, 1, 0] }}
        transition={{ delay: at(0), duration: PORTAL_MS / 1000, times: [0, 0.21, 0.71, 1] }}
      />
      <div className="pointer-events-none absolute" style={{ left: x, top: y, zIndex: y + 1 }}>
        {DUST.map(([dx, dy], i) => (
          <motion.div
            key={i} className="absolute"
            style={{ width: (i % 3 ? 3 : 4) * u, height: (i % 3 ? 3 : 4) * u, background: i % 2 ? "#f1ece2" : color }}
            initial={{ x: 0, y: -2 * u, opacity: 0 }}
            animate={{ x: [0, Math.round(dx * 34 * u)], y: [-2 * u, Math.round(dy * 18 * u - 4 * u)], opacity: [1, 0] }}
            transition={{ delay: at(LAND_AT), duration: 0.4, ease: "easeOut" }}
          />
        ))}
      </div>
    </>
  )
}
