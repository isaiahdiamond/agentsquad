import { useContext, useEffect } from "react"
import { animate, motion, useAnimationControls, useMotionValue, useTransform, type MotionValue } from "framer-motion"
import type { Building, Scene, Spot, Squad } from "@agentsquad/shared"
import Backdrop from "./Backdrop"
import { Actor, FlameBadge, Portrait, Stage, useFacing, usePx } from "./Sprite"
import { buildingFor, who, type Agent, type Arena } from "./store"

const SPEED = 0.1

// Puts the child's bottom center on (x, y), as fractions of the stage, snapped to whole pixels.
export function Placed({ x, y, o, z, children }: { x: MotionValue<number>; y: MotionValue<number>; o?: MotionValue<number>; z?: number; children: React.ReactNode }) {
  const { w, h } = useContext(Stage)
  const left = useMotionValue(0), top = useMotionValue(0)
  useEffect(() => {
    const fx = () => left.set(Math.round(x.get() * w))
    const fy = () => top.set(Math.round(y.get() * h))
    fx()
    fy()
    const offX = x.on("change", fx), offY = y.on("change", fy)
    return () => {
      offX()
      offY()
    }
  }, [x, y, w, h])
  const zIndex = useTransform(y, (v) => z ?? Math.round(v * 100) + 10)
  return (
    <motion.div className="pointer-events-none absolute -translate-x-1/2 -translate-y-full" style={{ left, top, opacity: o, zIndex }}>
      {children}
    </motion.div>
  )
}

export function StaticActor({ spot, ...props }: { spot: Spot } & Omit<React.ComponentProps<typeof Actor>, "k">) {
  const x = useMotionValue(spot.x), y = useMotionValue(spot.y), s = useMotionValue(spot.scale)
  useEffect(() => {
    x.set(spot.x)
    y.set(spot.y)
    s.set(spot.scale)
  }, [spot.x, spot.y, spot.scale])
  const k = usePx(s)
  return <Placed x={x} y={y}><Actor {...props} k={k} /></Placed>
}

const dist = (a: Spot, b: Spot) => Math.hypot(b.x - a.x, (b.y - a.y) * 0.5625)

// Where the k-th finished agent waits: a queue on the walkway running from the lead through the bench, alternating sides.
function parkSpot(scene: Scene, k: number): Spot {
  const { lead, bench } = scene
  const len = dist(lead, bench) || 1
  const ux = (bench.x - lead.x) / len, uy = ((bench.y - lead.y) * 0.5625) / len
  const d = 0.042 * k
  const side = k % 2 ? 0.011 : -0.011
  return { x: bench.x + ux * d - uy * side, y: bench.y + (uy * d + ux * side) / 0.5625, scale: bench.scale }
}

// The path cut off where it passes closest to the target, so nobody walks past their spot and back.
function toward(path: Spot[], target: Spot): Spot[] {
  let best = { d: Infinity, i: 0, p: path[0] }
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i]
    const dx = b.x - a.x, dy = (b.y - a.y) * 0.5625
    const len2 = dx * dx + dy * dy || 1e-9
    const t = Math.max(0, Math.min(1, ((target.x - a.x) * dx + (target.y - a.y) * 0.5625 * dy) / len2))
    const p = { x: a.x + dx * t, y: a.y + (dy * t) / 0.5625, scale: a.scale }
    const d = dist(p, target)
    if (d < best.d - 1e-6) best = { d, i, p }
  }
  return [...path.slice(0, best.i), best.p]
}

// Walks out along the path to the door and fades in; on done, fades in at the door, walks back to the lead, then to its parking spot.
function Walker({ agent, squad, path, park }: { agent: Agent; squad: Squad | null; path: Spot[]; park: Spot }) {
  const x = useMotionValue(path[0].x), y = useMotionValue(path[0].y), s = useMotionValue(path[0].scale), o = useMotionValue(0)
  const done = agent.doneAt > 0

  useEffect(() => {
    let alive = true
    const running: { stop: () => void }[] = []
    const fade = (v: number) => {
      const c = animate(o, v, { duration: 0.4 })
      running.push(c)
      return c
    }
    const walk = (pts: Spot[]) => {
      const d = [0]
      for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + dist(pts[i - 1], pts[i]))
      const total = d[d.length - 1] || 0.001
      const opts = { duration: Math.max(0.5, total / SPEED), times: d.map((v) => v / total), ease: "linear" as const }
      const cs = [animate(x, pts.map((p) => p.x), opts), animate(y, pts.map((p) => p.y), opts), animate(s, pts.map((p) => p.scale), opts)]
      running.push(...cs)
      return Promise.all(cs)
    }
    const put = (p: Spot) => {
      x.set(p.x)
      y.set(p.y)
      s.set(p.scale)
    }
    const here = () => ({ x: x.get(), y: y.get(), scale: s.get() })
    const run = async () => {
      if (!done) {
        put(path[0])
        await fade(1)
        if (alive) await walk(path)
        if (alive) await fade(0)
        return
      }
      if (o.get() > 0.5) return walk([here(), park])
      const back = toward([...path].reverse(), park)
      put(back[0])
      await fade(1)
      if (alive) await walk([...back, park])
    }
    run()
    return () => {
      alive = false
      running.forEach((c) => c.stop())
    }
  }, [done, park.x, park.y])

  const k = usePx(s)
  const face = useFacing(x, y)
  return (
    <Placed x={x} y={y} o={o}>
      <Actor who={who(agent.type, squad)} agent={agent} seed={agent.type} icon={done} k={k} face={face} />
    </Placed>
  )
}

function Badge({ b, inside, squad }: { b: Building; inside: Agent[]; squad: Squad | null }) {
  const controls = useAnimationControls()
  const pulse = Math.max(0, ...inside.map((a) => a.pulseAt))
  useEffect(() => {
    if (pulse) controls.start({ scale: [1, 1.12, 1], transition: { duration: 0.35 } })
  }, [pulse])
  if (!inside.length) return null
  const waiting = inside.some((a) => a.state === "waiting")
  const error = inside.some((a) => a.state === "error")
  return (
    <div className="pointer-events-none absolute z-[200] -translate-x-1/2" style={{ left: `${b.badge.x * 100}%`, top: `${Math.max(0.01, b.badge.y) * 100}%` }}>
      <motion.div
        animate={controls}
        className={`flex items-center gap-2 rounded-2xl border p-1.5 pr-3 backdrop-blur-md ${waiting ? "border-amber-300/80 bg-amber-400/90 text-[#0b0d12] shadow-[0_0_24px_6px_rgba(251,191,36,.55)]" : "border-line-strong bg-panel/90 text-text shadow-[0_8px_24px_rgba(0,0,0,.45)]"}`}
      >
        <div className="flex -space-x-1.5">
          {inside.map((a) => (
            <Portrait key={a.id} who={who(a.type, squad)} seed={a.type} size={32} className={`rounded-lg ring-2 ${waiting ? "ring-amber-400" : "ring-panel"}`} />
          ))}
        </div>
        <span className="text-[13px] font-semibold">{b.name}</span>
        {waiting && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0b0d12] text-[12px] font-extrabold text-amber-300">!</span>}
        {error && <FlameBadge size={14} />}
      </motion.div>
    </div>
  )
}

export default function MapView({ scene, arena, squad, onOpen }: { scene: Scene; arena: Arena; squad: Squad | null; onOpen: (b: Building) => void }) {
  const buildings = scene.buildings ?? []
  const agents = Object.values(arena.agents).filter((a) => a.type !== "lead").sort((a, b) => a.order - b.order)
  const lead = Object.values(arena.agents).find((a) => a.type === "lead")
  const done = agents.filter((a) => a.doneAt).sort((a, b) => a.doneAt - b.doneAt)
  const pathFor = (a: Agent) => {
    const i = buildingFor(scene, a.type)
    return scene.paths?.[i] ?? [scene.lead, buildings[i]?.door ?? scene.lead]
  }

  return (
    <div className="absolute inset-0">
      <Backdrop scene={scene} />
      {buildings.map((b) => (
        <button
          key={b.id} onClick={() => onOpen(b)} title={`Look inside ${b.name}`}
          className="group absolute z-[5] cursor-pointer rounded-2xl border-2 border-transparent transition-colors hover:border-accent/80 hover:bg-accent/10"
          style={{ left: `${b.area.x * 100}%`, top: `${b.area.y * 100}%`, width: `${b.area.w * 100}%`, height: `${b.area.h * 100}%` }}
        >
          <span className="absolute bottom-3 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white shadow-lg group-hover:block">
            Look inside {b.name}
          </span>
        </button>
      ))}
      {buildings.map((b, i) => (
        <Badge key={b.id} b={b} squad={squad} inside={agents.filter((a) => !a.doneAt && buildingFor(scene, a.type) === i)} />
      ))}
      <StaticActor spot={scene.lead} who={who("lead", squad)} agent={lead} seed="lead" />
      {agents.map((a) => {
        const k = done.indexOf(a)
        return <Walker key={a.id} agent={a} squad={squad} path={pathFor(a)} park={parkSpot(scene, Math.max(0, k))} />
      })}
    </div>
  )
}
