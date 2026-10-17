import { useEffect, useRef, useState } from "react"
import { animate, motion, useMotionValue } from "framer-motion"
import type { Scene, Spot, Squad } from "@agentsquad/shared"
import Backdrop from "./Backdrop"
import { sceneScale } from "./MapView"
import { Actor, H, SEAT_LIFT, TALL, W, useFacing, useManifest, useNatural, useUi, type Size } from "./Sprite"
import { who, type Agent, type Arena } from "./store"

const SPEED = 0.12
const DESK = { w: 62, h: 52 }

// Desk image size in art pixels, or the fallback size when the art is missing. Undefined while loading.
export function useDesk(sceneId: string) {
  const { m, ready } = useManifest()
  const src = m?.desks?.[sceneId]
  const nat = useNatural(src)
  if (!ready || (src && nat === undefined)) return { src, size: undefined }
  return { src: nat ? src : undefined, size: nat || DESK }
}

export function deskSpots(scene: Scene) {
  return [...(scene.lead.kind === "desk" ? [scene.lead] : []), ...scene.stations.filter((s) => s.kind === "desk")]
}

// Always drawn, empty or not. Bottom center on the station, y-sorted with the agents.
function Desk({ spot, s, src, size }: { spot: Spot; s: number; src?: string; size: Size }) {
  const w = size.w * s, h = size.h * s
  return (
    <div className="pointer-events-none absolute" style={{ left: spot.x * W - w / 2, top: spot.y * H - h, width: w, height: h, zIndex: Math.round(spot.y * H) }}>
      {src ? <img src={src} alt="" draggable={false} className="pixelated block h-full w-full select-none" /> : (
        <div className="h-full w-full bg-[#6b4a2e]" style={{ borderWidth: 2 * s, borderColor: "#2a1710", borderTopWidth: 14 * s, borderTopColor: "#8a6440" }} />
      )}
    </div>
  )
}

type Target = { to: Spot; sit: boolean; leave?: boolean }

// Walks in a straight line at a steady pace (standing sprite with step bob), then sits if the target is a desk seat.
function Worker({ type, agent, squad, s, from, target, raise }: { type: string; agent?: Agent; squad: Squad | null; s: number; from: Spot; target: Target; raise?: number }) {
  const x = useMotionValue(from.x), y = useMotionValue(from.y), o = useMotionValue(1)
  const [seated, setSeated] = useState(false)
  const { to, sit, leave } = target
  useEffect(() => {
    setSeated(false)
    const d = Math.hypot(to.x - x.get(), (to.y - y.get()) * (H / W))
    const opts = { duration: Math.max(0.15, d / SPEED), ease: "linear" as const }
    const cs = [animate(x, to.x, opts), animate(y, to.y, opts)]
    let alive = true
    Promise.all(cs).then(() => alive && sit && setSeated(true))
    if (leave) cs.push(animate(o, 0, { delay: opts.duration, duration: 0.5 }))
    return () => {
      alive = false
      cs.forEach((c) => c.stop())
    }
  }, [to.x, to.y, sit, leave])
  const face = useFacing(x, y)
  return <Actor who={who(type, squad)} agent={agent} seed={type} s={s} x={x} y={y} o={o} face={face} seated={seated} raise={raise} />
}

// Rooms: a whole-scene room (office, beach) with the lead, or a building interior showing only the agents inside it.
export default function RoomView({ scene, arena, squad, members, main }: { scene: Scene; arena: Arena; squad: Squad | null; members: Agent[]; main: boolean }) {
  const opened = useRef(Date.now())
  const taken = useRef(new Map<string, number>())
  const ui = useUi()
  const s = sceneScale(scene)
  const { src, size } = useDesk(scene.id)
  const lead = Object.values(arena.agents).find((a) => a.type === "lead")
  const leadDesk = scene.lead.kind === "desk"
  const desks = scene.stations.filter((st) => st.kind === "desk")
  const working = members.filter((a) => !a.doneAt)
  const done = members.filter((a) => a.doneAt).sort((a, b) => a.doneAt - b.doneAt)
  const deskH = (size ?? DESK).h
  const deskW = (size ?? DESK).w

  // Each working agent keeps the first desk that was free when it arrived; finished agents free theirs.
  const map = taken.current
  for (const id of [...map.keys()]) if (!working.some((a) => a.id === id)) map.delete(id)
  for (const a of working) {
    if (map.has(a.id)) continue
    const used = new Set(map.values())
    let i = 0
    while (used.has(i)) i++
    map.set(a.id, i)
  }

  // More agents than desks: the extras stand in a row next to the bench, never on a desk station.
  const station = (i: number): Spot => desks[i] ?? { ...scene.bench, x: scene.bench.x + ((i - desks.length + 1) * 30 * s) / W }
  const seat = (st: Spot): Spot => ({ ...st, y: st.y - (deskH * s * SEAT_LIFT) / H })
  // Stand up on the side of the desk facing the middle of the room.
  const beside = (st: Spot): Spot => ({ ...st, x: st.x + ((st.x > 0.5 ? -1 : 1) * (deskW / 2 + 14) * s) / W, y: st.y - (4 * s) / H })
  const home = (i: number): Spot => {
    const side = i % 2 ? 1 : -1
    const gap = (leadDesk ? deskW / 2 + 16 : 20) * s + (Math.floor(i / 2) + (leadDesk && side === (scene.lead.x > 0.5 ? -1 : 1) ? 1 : 0)) * 34 * s
    return { ...scene.lead, x: scene.lead.x + (side * gap) / W, y: scene.lead.y + (6 * s) / H }
  }
  const targetFor = (a: Agent): Target => {
    if (a.doneAt) return main ? { to: home(done.indexOf(a)), sit: false } : { to: scene.bench, sit: false, leave: true }
    const i = map.get(a.id) ?? 0
    const st = station(i)
    const isDesk = !!desks[i]
    if (a.state === "waiting" && isDesk) return { to: beside(st), sit: false }
    return isDesk ? { to: seat(st), sit: true } : { to: st, sit: false }
  }
  const leadTarget = (): Target => {
    if (!leadDesk) return { to: scene.lead, sit: false }
    if (lead && (lead.state === "waiting" || lead.doneAt)) return { to: beside(scene.lead), sit: false }
    return { to: seat(scene.lead), sit: true }
  }
  const fresh = (a: Agent) => a.firstAt > opened.current - 300
  const head = (p: Spot) => ({ x: p.x * W, y: p.y * H - TALL * s * 0.75 })

  if (!size) return <div className="absolute inset-0"><Backdrop scene={scene} /></div>
  return (
    <div className="absolute inset-0">
      <Backdrop scene={scene} />
      {main && (
        <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 z-[4000] h-full w-full">
          {working.filter(fresh).map((a, i) => {
            const p = head(scene.lead), q = head(targetFor(a).to)
            return (
              <motion.line
                key={a.id} x1={p.x} y1={p.y} x2={q.x} y2={q.y}
                stroke={who(a.type, squad).color} strokeWidth={4 * ui} strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 1 }} animate={{ pathLength: 1, opacity: [1, 1, 0] }}
                transition={{ duration: 2.2, delay: i * 0.05, times: [0, 0.6, 1] }}
              />
            )
          })}
        </svg>
      )}
      {main && <Worker type="lead" agent={lead} squad={squad} s={s} from={leadTarget().to} target={leadTarget()} />}
      {members.map((a) => {
        if (!main && a.doneAt && a.doneAt < opened.current) return null
        const t = targetFor(a)
        return <Worker key={a.id} type={a.type} agent={a} squad={squad} s={s} from={fresh(a) ? scene.bench : t.to} target={t} raise={((map.get(a.id) ?? 0) % 2) * 52} />
      })}
      {deskSpots(scene).map((d, i) => <Desk key={i} spot={d} s={s} src={src} size={size} />)}
      {!working.length && !main && (
        <div className="absolute inset-x-0 top-[45%] z-[4500] flex justify-center">
          <div className="card px-4 py-2.5 text-sm text-muted shadow-[0_8px_24px_rgba(0,0,0,.45)]" style={{ transform: `scale(${ui})` }}>Nobody is working in here right now.</div>
        </div>
      )}
    </div>
  )
}
