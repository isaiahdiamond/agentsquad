import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, animate, motion, useIsPresent, useMotionValue } from "framer-motion"
import type { Scene, Spot, Squad } from "@agentsquad/shared"
import Backdrop from "./Backdrop"
import Bubbles from "./Bubbles"
import PlateLayout from "./Plates"
import { PortalFx, fall, missionKey, usePortals, type Portal } from "./Portal"
import { sceneScale } from "./MapView"
import { Actor, H, TALL, W, useFacing, useManifest, useNatural, type Size } from "./Sprite"
import { who, type Agent, type Arena } from "./store"
import { Scope, labelOf } from "./world"

const SPEED = 0.12

// The lead only takes its desk once it has started doing something.
const busy = (a: Agent) => !a.doneAt && (a.state !== "idle" || a.tools > 0)
const DESK = { w: 62, h: 52 }
// Scenes without their own desk art borrow one until it lands.
const BORROWED: Record<string, string> = { club: "office" }

// Desk image size in art pixels, or the fallback size when the art is missing. Undefined while loading.
export function useDesk(sceneId: string) {
  const { m, ready } = useManifest()
  const src = m?.desks?.[sceneId] ?? m?.desks?.[BORROWED[sceneId]]
  const nat = useNatural(src)
  if (!ready || (src && nat === undefined)) return { src, size: undefined }
  return { src: nat ? src : undefined, size: nat || DESK }
}

// Desks are sized to the agents, not by the art's own scale: a standing agent is about 7.5% taller than the desk is wide.
export function deskScale(s: number, size: Size) {
  return (TALL * s) / (1.075 * size.w)
}

// How far above the station a seated agent's feet go, so its hands rest on the desk top (about 90% of the desk's height).
export function seatLift(s: number, size: Size) {
  return Math.max(0, size.h * deskScale(s, size) * 0.9 - 46 * s)
}

export function deskSpots(scene: Scene) {
  return [...(scene.lead.kind === "desk" ? [scene.lead] : []), ...scene.stations.filter((s) => s.kind === "desk")]
}

const DUST = [[-0.55, -0.1], [-0.35, -0.45], [-0.1, -0.6], [0.15, -0.55], [0.4, -0.4], [0.58, -0.08], [-0.2, 0.05], [0.25, 0.05]]

// Pixel dust burst around the desk.
function Poof({ w, h, k }: { w: number; h: number; k: number }) {
  const [gone, setGone] = useState(false)
  if (gone) return null
  return (
    <div className="absolute bottom-0 left-1/2">
      {DUST.map(([dx, dy], i) => (
        <motion.div
          key={i} className="absolute bg-[#f1ece2]"
          style={{ width: (i % 3 ? 3 : 4) * k, height: (i % 3 ? 3 : 4) * k, boxShadow: `0 0 0 ${k}px rgba(120,110,95,.55)` }}
          initial={{ x: 0, y: -h * 0.2, opacity: 0.95 }} animate={{ x: dx * w, y: -h * 0.2 + dy * h, opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          onAnimationComplete={i ? undefined : () => setGone(true)}
        />
      ))}
    </div>
  )
}

// Only exists while someone works at it: poofs in when its agent sits, poofs out after they get up.
// Desks already there when the room opens skip the poof in.
function Desk({ spot, ds, src, size, k, quiet }: { spot: Spot; ds: number; src?: string; size: Size; k: number; quiet: boolean }) {
  const w = size.w * ds, h = size.h * ds
  const present = useIsPresent()
  const [poofIn] = useState(!quiet)
  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{ left: spot.x * W - w / 2, top: spot.y * H - h, width: w, height: h, zIndex: Math.round(spot.y * H), originY: 1 }}
      initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25, ease: "easeOut" }}
      exit={{ opacity: 0, scale: 0.6, transition: { delay: 0.25, duration: 0.25 } }}
    >
      {src ? <img src={src} alt="" draggable={false} className="pixelated block h-full w-full select-none" /> : (
        <div className="h-full w-full bg-[#6b4a2e]" style={{ borderWidth: 2 * ds, borderColor: "#2a1710", borderTopWidth: 14 * ds, borderTopColor: "#8a6440" }} />
      )}
      {(poofIn || !present) && <Poof key={present ? "in" : "out"} w={w} h={h} k={k} />}
    </motion.div>
  )
}

type Target = { to: Spot; sit: boolean; leave?: boolean }

// Walks in a straight line at a steady pace (standing sprite with step bob), then sits if the target is a desk seat.
// A portal agent first falls in beside the lead and holds there; every walk waits for that.
function Worker({ id, type, agent, label, squad, s, from, target, portal, onSit }: {
  id: string; type: string; agent?: Agent; label: string; squad: Squad | null; s: number; from: Spot; target: Target; portal?: Portal; onSit: (id: string) => void
}) {
  const x = useMotionValue(portal?.spot.x ?? from.x), y = useMotionValue(portal?.spot.y ?? from.y), o = useMotionValue(1)
  const dy = useMotionValue(0), squash = useMotionValue(1)
  const { to, sit, leave } = target
  const [seated, setSeated] = useState(!portal && sit && from.x === to.x && from.y === to.y)
  const gate = useRef<Promise<void> | null>(null)
  const mounted = useRef(true)
  if (portal && !gate.current) gate.current = fall(portal, s, o, dy, squash, () => mounted.current)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    let alive = true
    const cs: { stop: () => void }[] = []
    ;(gate.current ?? Promise.resolve()).then(() => {
      if (!alive) return
      o.set(1)
      if (!(sit && x.get() === to.x && y.get() === to.y)) setSeated(false)
      const d = Math.hypot(to.x - x.get(), (to.y - y.get()) * (H / W))
      const opts = { duration: Math.max(0.15, d / SPEED), ease: "linear" as const }
      const walk = [animate(x, to.x, opts), animate(y, to.y, opts)]
      cs.push(...walk)
      Promise.all(walk).then(() => alive && sit && setSeated(true))
      if (leave) cs.push(animate(o, 0, { delay: opts.duration, duration: 0.5 }))
    })
    return () => {
      alive = false
      cs.forEach((c) => c.stop())
    }
  }, [to.x, to.y, sit, leave])
  useEffect(() => {
    if (seated) onSit(id)
  }, [seated])
  const face = useFacing(x, y)
  return <Actor who={who(type, squad)} agent={agent} label={label} seed={type} s={s} x={x} y={y} o={o} dy={dy} squash={squash} face={face} seated={seated} />
}

// Rooms: a whole-scene room (office, club) with the lead, or a building interior showing only the agents inside it.
export default function RoomView({ scene, arena, squad, members, main }: { scene: Scene; arena: Arena; squad: Squad | null; members: Agent[]; main: boolean }) {
  const opened = useRef(Date.now())
  const taken = useRef(new Map<string, number>())
  const s = sceneScale(scene)
  const { src, size } = useDesk(scene.id)
  const lead = Object.values(arena.agents).find((a) => a.type === "lead")
  const leadDesk = scene.lead.kind === "desk"
  const desks = scene.stations.filter((st) => st.kind === "desk")
  const working = members.filter((a) => !a.doneAt)
  const done = members.filter((a) => a.doneAt).sort((a, b) => a.doneAt - b.doneAt)
  const ds = deskScale(s, size ?? DESK)
  const deskW = (size ?? DESK).w * ds
  const lift = seatLift(s, size ?? DESK)
  // Agents already at work when the view opens start seated, with their desks already there.
  const [sat, setSat] = useState<string[]>(() => [...(lead && busy(lead) ? ["lead"] : []), ...members.filter((a) => !a.doneAt && a.spawnAt <= opened.current - 300).map((a) => a.id)])
  const onSit = useCallback((id: string) => setSat((ids) => (ids.includes(id) ? ids : [...ids, id])), [])
  // A new mission reuses agent ids, so nobody counts as seated until they sit again.
  const mission = useRef(arena.promptAt)
  useEffect(() => {
    if (arena.promptAt === mission.current) return
    mission.current = arena.promptAt
    setSat([])
  }, [arena.promptAt])

  // Each working agent keeps the first desk that was free when it arrived; finished agents free theirs.
  const map = taken.current
  for (const id of [...map.keys()]) if (!working.some((a) => a.id === id)) map.delete(id)
  for (const a of working) {
    const used = new Set(map.values())
    let i = 0
    while (used.has(i)) i++
    const cur = map.get(a.id)
    if (cur === undefined || (cur >= desks.length && i < desks.length)) map.set(a.id, i)
  }
  // Finished agents leave their desk; a re-tasked agent only gets a desk again once it sits.
  const doneKey = [lead?.doneAt ?? 0, ...members.map((a) => a.doneAt)].join()
  useEffect(() => {
    setSat((ids) => ids.filter((id) => {
      const a = id === "lead" ? lead : members.find((m) => m.id === id)
      return a ? !a.doneAt : id === "lead"
    }))
  }, [doneKey])

  // More agents than desks: the extras stand in a row next to the bench, never on a desk station.
  const station = (i: number): Spot => desks[i] ?? { ...scene.bench, x: scene.bench.x + ((i - desks.length + 1) * 30 * s) / W }
  const seat = (st: Spot): Spot => ({ ...st, y: st.y - lift / H })
  // Stand up on the side of the desk facing the middle of the room.
  const beside = (st: Spot): Spot => ({ ...st, x: st.x + ((st.x > 0.5 ? -1 : 1) * (deskW / 2 + 14 * s)) / W, y: st.y - (4 * s) / H })
  const home = (i: number): Spot => {
    const side = i % 2 ? 1 : -1
    const gap = (leadDesk ? deskW / 2 + 16 * s : 20 * s) + (Math.floor(i / 2) + (leadDesk && side === (scene.lead.x > 0.5 ? -1 : 1) ? 1 : 0)) * 34 * s
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
    if (!leadDesk || !lead || !busy(lead) || gotIt) return { to: scene.lead, sit: false }
    if (lead && (lead.state === "waiting" || lead.doneAt)) return { to: beside(scene.lead), sit: false }
    return { to: seat(scene.lead), sit: true }
  }
  // During "Got it." and the task bubble the lead stands at its spot facing the camera; then it takes its desk.
  const sayEnd = lead?.sayLines ? lead.sayAt + lead.sayLines.reduce((t, [, ms]) => t + ms, 0) : 0
  const [gotIt, setGotIt] = useState(false)
  useEffect(() => {
    if (!sayEnd || sayEnd <= Date.now()) return setGotIt(false)
    setGotIt(true)
    const t = setTimeout(() => setGotIt(false), sayEnd - Date.now())
    return () => clearTimeout(t)
  }, [sayEnd])
  const mountedAt = useRef(0)
  useEffect(() => {
    mountedAt.current = Date.now()
  }, [])
  const quiet = () => !mountedAt.current || Date.now() - mountedAt.current < 100
  const fresh = (a: Agent) => a.spawnAt > opened.current - 300
  const allPortals = usePortals(members, scene.lead, s, opened.current)
  const portals = main ? allPortals : new Map<string, Portal>()
  const head = (p: Spot) => ({ x: p.x * W, y: p.y * H - TALL * s * 0.75 })
  const occupied = working.filter((a) => (sat.includes(a.id) || a.state === "waiting") && desks[map.get(a.id) ?? -1])
  const leadAtDesk = main && leadDesk && !lead?.doneAt && (sat.includes("lead") || lead?.state === "waiting")

  if (!size) return <div className="absolute inset-0"><Backdrop scene={scene} /></div>
  return (
    <Scope.Provider value={scene.id}>
    <div className="absolute inset-0">
      <Backdrop scene={scene} />
      {main && <Worker id="lead" type="lead" agent={lead} label="Lead" squad={squad} s={s} from={leadTarget().to} target={leadTarget()} onSit={onSit} />}
      {members.map((a) => {
        if (!main && a.doneAt && a.doneAt < opened.current) return null
        const t = targetFor(a)
        return <Worker key={missionKey(a)} id={a.id} type={a.type} agent={a} label={labelOf(a, arena, squad)} squad={squad} s={s} from={fresh(a) ? scene.bench : t.to} target={t} portal={portals.get(a.id)} onSit={onSit} />
      })}
      <AnimatePresence initial={false}>
        {leadAtDesk && <Desk key="lead" spot={scene.lead} ds={ds} src={src} size={size} k={s} quiet={quiet()} />}
        {occupied.map((a) => <Desk key={`desk-${map.get(a.id)}`} spot={desks[map.get(a.id)!]} ds={ds} src={src} size={size} k={s} quiet={quiet()} />)}
      </AnimatePresence>
      {members.map((a) => {
        const p = portals.get(a.id)
        return p && <PortalFx key={`portal-${missionKey(a)}`} p={p} color={who(a.type, squad).color} s={s} from={scene.lead} />
      })}
      <Bubbles agents={main && lead ? [lead, ...members] : members} scope={scene.id} squad={squad} portals={portals} />
      <PlateLayout scope={scene.id} />
      {!working.length && !main && (
        <div className="absolute inset-x-0 top-[45%] z-[4500] flex justify-center">
          <div className="card px-4 py-2.5 text-sm text-muted shadow-[0_8px_24px_rgba(0,0,0,.45)]" style={{ transform: "scale(var(--ui))" }}>Nobody is working in here right now.</div>
        </div>
      )}
    </div>
    </Scope.Provider>
  )
}
