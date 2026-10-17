import { useCallback, useEffect, useState } from "react"
import { animate, motion, useAnimationControls, useMotionValue } from "framer-motion"
import type { Building, Scene, Spot, Squad } from "@agentsquad/shared"
import Backdrop from "./Backdrop"
import { Actor, FlameBadge, Portrait, useFacing } from "./Sprite"
import { buildingFor, who, type Agent, type Arena } from "./store"
import { Scope, labelOf } from "./world"

const SPEED = 0.1

export function sceneScale(scene: Scene) {
  return scene.scale ?? (scene.kind === "map" ? 0.92 : 2.75)
}

export function StaticActor({ spot, ...props }: { spot: Spot } & Omit<React.ComponentProps<typeof Actor>, "x" | "y">) {
  const x = useMotionValue(spot.x), y = useMotionValue(spot.y)
  useEffect(() => {
    x.set(spot.x)
    y.set(spot.y)
  }, [spot.x, spot.y])
  return <Actor {...props} x={x} y={y} />
}

const dist = (a: Spot, b: Spot) => Math.hypot(b.x - a.x, (b.y - a.y) * 0.5625)

// Point at distance d along the path from its start.
function along(path: Spot[], d: number): Spot {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], len = dist(a, b)
    if (d <= len) return { x: a.x + ((b.x - a.x) * d) / len, y: a.y + ((b.y - a.y) * d) / len, scale: a.scale }
    d -= len
  }
  return path[path.length - 1]
}

// Index of the path segment nearest to p, and how far along it p sits.
function nearest(path: Spot[], p: Spot) {
  let best = { d: Infinity, i: 0, t: 0 }
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i]
    const dx = b.x - a.x, dy = (b.y - a.y) * 0.5625
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * 0.5625 * dy) / (dx * dx + dy * dy || 1e-9)))
    const q = { x: a.x + dx * t, y: a.y + (dy * t) / 0.5625, scale: a.scale }
    const d = dist(q, p)
    if (d < best.d - 1e-6) best = { d, i, t }
  }
  return best
}

// Where the k-th finished agent waits: single file down the middle of the walkway that passes the bench, starting at the bench.
function parkSpot(scene: Scene, k: number): Spot {
  const paths = scene.paths ?? []
  if (!paths.length) return { ...scene.bench, x: scene.bench.x + 0.04 * k }
  const path = paths.map((p) => ({ p, d: nearest(p, scene.bench).d })).sort((a, b) => a.d - b.d)[0].p
  return along(path, dist(scene.lead, scene.bench) + 0.042 * k)
}

// The path cut off where it passes closest to the target, so nobody walks past their spot and back.
function toward(path: Spot[], target: Spot): Spot[] {
  const { i, t } = nearest(path, target)
  const a = path[i - 1], b = path[i]
  return [...path.slice(0, i), { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, scale: a.scale }]
}

// Walks out along the path to the door and fades in; on done, fades in at the door, walks back to the lead, then to its parking spot.
function Walker({ agent, label, squad, path, park, s, onArrive }: { agent: Agent; label: string; squad: Squad | null; path: Spot[]; park: Spot; s: number; onArrive: (id: string) => void }) {
  const x = useMotionValue(path[0].x), y = useMotionValue(path[0].y), o = useMotionValue(0)
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
      const cs = [animate(x, pts.map((p) => p.x), opts), animate(y, pts.map((p) => p.y), opts)]
      running.push(...cs)
      return Promise.all(cs)
    }
    const put = (p: Spot) => {
      x.set(p.x)
      y.set(p.y)
    }
    const here = () => ({ x: x.get(), y: y.get(), scale: 1 })
    const run = async () => {
      if (!done) {
        put(path[0])
        await fade(1)
        if (alive) await walk(path)
        if (alive) await fade(0)
        if (alive) onArrive(agent.id)
        return
      }
      if (o.get() > 0.5) {
        const { i } = nearest(path, here())
        return walk([...toward([here(), ...path.slice(0, i).reverse()], park), park])
      }
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

  const face = useFacing(x, y)
  return <Actor who={who(agent.type, squad)} agent={agent} label={label} seed={agent.type} s={s} x={x} y={y} o={o} face={face} />
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
    <div className="pointer-events-none absolute z-[6000]" style={{ left: `${b.badge.x * 100}%`, top: `${Math.max(0.01, b.badge.y) * 100}%`, transform: "translateX(-50%) scale(var(--ui))", transformOrigin: "50% 0" }}>
      <motion.div
        animate={controls}
        className={`flex items-center gap-2 rounded-2xl border p-1.5 pr-3 ${waiting ? "border-amber-300/80 bg-amber-400 text-[#0b0d12] shadow-[0_0_24px_6px_rgba(251,191,36,.55)]" : "border-line-strong bg-panel text-text shadow-[0_8px_24px_rgba(0,0,0,.45)]"}`}
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
  const s = sceneScale(scene)
  const [arrived, setArrived] = useState<string[]>([])
  const onArrive = useCallback((id: string) => setArrived((ids) => (ids.includes(id) ? ids : [...ids, id])), [])
  const pathFor = (a: Agent) => {
    const i = buildingFor(scene, a.type)
    return scene.paths?.[i] ?? [scene.lead, buildings[i]?.door ?? scene.lead]
  }

  return (
    <Scope.Provider value={scene.id}>
    <div className="absolute inset-0">
      <Backdrop scene={scene} />
      {buildings.map((b) => (
        <button
          key={b.id} onClick={() => onOpen(b)} title={`Look inside ${b.name}`}
          className="group absolute z-[5] cursor-pointer rounded-[32px] border-[5px] border-transparent transition-colors hover:border-accent/80 hover:bg-accent/10"
          style={{ left: `${b.area.x * 100}%`, top: `${b.area.y * 100}%`, width: `${b.area.w * 100}%`, height: `${b.area.h * 100}%` }}
        >
          <span className="absolute bottom-[24px] left-1/2 hidden whitespace-nowrap rounded-full bg-accent px-3 py-1 text-xs font-semibold text-on-accent shadow-lg group-hover:block" style={{ transform: "translateX(-50%) scale(var(--ui))", transformOrigin: "50% 100%" }}>
            Look inside {b.name}
          </span>
        </button>
      ))}
      {buildings.map((b, i) => (
        <Badge key={b.id} b={b} squad={squad} inside={agents.filter((a) => !a.doneAt && arrived.includes(a.id) && buildingFor(scene, a.type) === i)} />
      ))}
      <StaticActor spot={scene.lead} who={who("lead", squad)} agent={lead} label="Lead" seed="lead" s={s} />
      {agents.map((a) => {
        const k = done.indexOf(a)
        return <Walker key={a.id} agent={a} label={labelOf(a, arena, squad)} squad={squad} path={pathFor(a)} park={parkSpot(scene, Math.max(0, k))} s={s} onArrive={onArrive} />
      })}
    </div>
    </Scope.Provider>
  )
}
