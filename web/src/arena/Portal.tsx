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
const ANGLES = [140, 40, 90, 180, 0, 115, 65]

function slotSpot(lead: Spot, i: number, s: number): Spot {
  const a = (ANGLES[i % ANGLES.length] * Math.PI) / 180
  const r = 110 * s * (1 + Math.floor(i / ANGLES.length) * 0.6)
  return { ...lead, x: Math.round(lead.x * W + Math.cos(a) * r) / W, y: Math.round(lead.y * H + Math.sin(a) * r * 0.55) / H, kind: undefined }
}

// One portal per agent delegated after the view opened: a slot in the half circle around the lead, and a start time
// at least 300ms after the previous portal so a burst of delegations reads as a squad assembling.
export function usePortals(agents: Agent[], lead: Spot, s: number, opened: number) {
  const map = useRef(new Map<string, Portal>())
  const last = useRef(0)
  const fresh = agents.filter((a) => a.type !== "lead" && a.task && a.firstAt > opened - 300).sort((a, b) => a.firstAt - b.firstAt)
  for (const a of fresh) {
    if (map.current.has(a.id)) continue
    const start = Math.max(a.firstAt, last.current + STAGGER)
    last.current = start
    const busy = [...map.current.values()].filter((p) => p.start > start - 6000).length
    map.current.set(a.id, { start, spot: slotSpot(lead, busy, s) })
  }
  return map.current
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

// The effect, drawn in code with whole scene pixels: an accent line from the lead, a dashed floor ring that turns,
// a stepped and dithered light beam (no gradients, no blur), and a burst of pixel dust on landing.
export function PortalFx({ p, color, s, from }: { p: Portal; color: string; s: number; from: Spot }) {
  const [gone, setGone] = useState(Date.now() > p.start + PORTAL_MS + 200)
  useEffect(() => {
    if (gone) return
    const t = setTimeout(() => setGone(true), p.start + PORTAL_MS + 200 - Date.now())
    return () => clearTimeout(t)
  }, [])
  if (gone) return null
  const x = Math.round(p.spot.x * W), y = Math.round(p.spot.y * H)
  const u = Math.max(1, Math.round(s))
  const at = (ms: number) => Math.max(0, (p.start + ms - Date.now()) / 1000)
  const rx = 30 * u, ry = 11 * u
  const bw = 32 * u
  const fx = Math.round(from.x * W), fy = Math.round(from.y * H - TALL * s * 0.7)
  const id = `dither-${x}-${y}`
  return (
    <>
      <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={W} height={H} shapeRendering="crispEdges" style={{ zIndex: y - 2 }}>
        <defs>
          <pattern id={id} width={2 * u} height={2 * u} patternUnits="userSpaceOnUse">
            <rect width={u} height={u} fill={color} />
            <rect x={u} y={u} width={u} height={u} fill={color} />
          </pattern>
        </defs>
        <motion.line
          x1={fx} y1={fy} x2={x} y2={y - 10 * u} stroke={color} strokeWidth={2 * u}
          initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: [0, 1, 1], opacity: [1, 1, 0] }}
          transition={{ delay: at(0), duration: 0.85, times: [0, 0.4, 1] }}
        />
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ delay: at(150), duration: 1.05, times: [0, 0.28, 0.67, 1] }}>
          <rect x={x - bw / 2} y={0} width={bw} height={y} fill={`url(#${id})`} opacity={0.35} />
          <rect x={x - bw / 2 + 4 * u} y={0} width={bw - 8 * u} height={y} fill={color} opacity={0.22} />
          <rect x={x - bw / 2 + 9 * u} y={0} width={bw - 18 * u} height={y} fill={color} opacity={0.3} />
          <rect x={x - 3 * u} y={0} width={6 * u} height={y} fill="#ffffff" opacity={0.35} />
        </motion.g>
      </svg>
      <motion.svg
        className="pointer-events-none absolute overflow-visible" width={rx * 2} height={ry * 2} shapeRendering="crispEdges"
        style={{ left: x - rx, top: y - ry, zIndex: y - 1 }}
        initial={{ scale: 0, opacity: 1 }} animate={{ scale: [0, 1, 1, 0], opacity: [1, 1, 1, 0] }}
        transition={{ delay: at(0), duration: PORTAL_MS / 1000, times: [0, 0.21, 0.71, 1] }}
      >
        <ellipse cx={rx} cy={ry} rx={rx - u} ry={ry - u} fill={color} fillOpacity={0.18} />
        <motion.ellipse
          cx={rx} cy={ry} rx={rx - u} ry={ry - u} fill="none" stroke={color} strokeWidth={2 * u} strokeDasharray={`${6 * u} ${4 * u}`}
          animate={{ strokeDashoffset: [0, -40 * u] }} transition={{ duration: 1.2, ease: "linear", repeat: Infinity }}
        />
        <ellipse cx={rx} cy={ry} rx={rx * 0.55} ry={ry * 0.55} fill="none" stroke="#ffffff" strokeOpacity={0.6} strokeWidth={u} />
      </motion.svg>
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
