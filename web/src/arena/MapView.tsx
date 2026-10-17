import { useEffect } from "react"
import { animate, motion, useAnimationControls, useMotionValue, useTransform, type MotionValue } from "framer-motion"
import type { Building, Scene, Spot, Squad } from "@agentsquad/shared"
import Backdrop from "./Backdrop"
import { Actor, FlameBadge, Portrait } from "./Sprite"
import { buildingFor, who, type Agent, type Arena } from "./store"

const SPEED = 0.17
export const CHAR_W = 4.6

export function Placed({ x, y, s, o, z, size = CHAR_W, children }: { x: MotionValue<number>; y: MotionValue<number>; s: MotionValue<number>; o?: MotionValue<number>; z?: number; size?: number; children: React.ReactNode }) {
  const left = useTransform(x, (v) => `${v * 100}%`)
  const top = useTransform(y, (v) => `${v * 100}%`)
  const width = useTransform(s, (v) => `${size * v}cqw`)
  const zIndex = useTransform(y, (v) => z ?? Math.round(v * 100) + 10)
  return (
    <motion.div className="pointer-events-none absolute -translate-x-1/2 -translate-y-full" style={{ left, top, width, opacity: o, zIndex }}>
      {children}
    </motion.div>
  )
}

export function StaticPlaced({ spot, children, z, size }: { spot: Spot; children: React.ReactNode; z?: number; size?: number }) {
  const x = useMotionValue(spot.x), y = useMotionValue(spot.y), s = useMotionValue(spot.scale)
  useEffect(() => {
    x.set(spot.x); y.set(spot.y); s.set(spot.scale)
  }, [spot.x, spot.y, spot.scale])
  return <Placed x={x} y={y} s={s} z={z} size={size}>{children}</Placed>
}

function Walker({ agent, squad, path, home }: { agent: Agent; squad: Squad | null; path: Spot[]; home: Spot }) {
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
      for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, (pts[i].y - pts[i - 1].y) * 0.5625))
      const total = d[d.length - 1] || 0.001
      const opts = { duration: Math.max(0.5, total / SPEED), times: d.map((v) => v / total), ease: "linear" as const }
      const cs = [animate(x, pts.map((p) => p.x), opts), animate(y, pts.map((p) => p.y), opts), animate(s, pts.map((p) => p.scale), opts)]
      running.push(...cs)
      return Promise.all(cs)
    }
    const put = (p: Spot) => { x.set(p.x); y.set(p.y); s.set(p.scale) }
    ;(async () => {
      if (!done) {
        put(path[0])
        await fade(1)
        if (alive) await walk(path)
        if (alive) await fade(0)
        return
      }
      if (o.get() > 0.5) return walk([{ x: x.get(), y: y.get(), scale: s.get() }, home])
      const back = [...path].reverse()
      put(back[0])
      await fade(1)
      if (alive) await walk([...back, home])
    })()
    return () => {
      alive = false
      running.forEach((c) => c.stop())
    }
  }, [done, home.x, home.y])

  return (
    <Placed x={x} y={y} s={s} o={o}>
      <Actor who={who(agent.type, squad)} agent={agent} seed={agent.type} icon={done} />
    </Placed>
  )
}

function Badge({ b, inside, squad }: { b: Building; inside: Agent[]; squad: Squad | null }) {
  const controls = useAnimationControls()
  const pulse = Math.max(0, ...inside.map((a) => a.pulseAt))
  useEffect(() => {
    if (pulse) controls.start({ scale: [1, 1.22, 1], transition: { duration: 0.35 } })
  }, [pulse])
  if (!inside.length) return null
  const waiting = inside.some((a) => a.state === "waiting")
  const error = inside.some((a) => a.state === "error")
  return (
    <div className="pointer-events-none absolute z-[200] -translate-x-1/2" style={{ left: `${b.badge.x * 100}%`, top: `${Math.max(0.005, b.badge.y) * 100}%` }}>
      <motion.div
        animate={controls}
        className={`flex items-center gap-[3px] rounded-[3px] border-[3px] p-[3px] shadow-[3px_3px_0_rgba(0,0,0,.6)] ${waiting ? "border-yellow-200 bg-yellow-400" : "border-gold-600 bg-navy-900"}`}
        style={waiting ? { boxShadow: "0 0 18px 6px rgba(253,224,71,.7), 3px 3px 0 rgba(0,0,0,.6)" } : undefined}
      >
        {inside.map((a) => (
          <Portrait key={a.id} who={who(a.type, squad)} seed={a.type} className="h-[max(22px,1.7cqw)] w-[max(22px,1.7cqw)]" />
        ))}
        {waiting && <span className="px-[2px] font-pixel text-[10px] text-navy-950">!</span>}
        {error && <FlameBadge />}
      </motion.div>
    </div>
  )
}

export default function MapView({ scene, arena, squad, onOpen }: { scene: Scene; arena: Arena; squad: Squad | null; onOpen: (b: Building) => void }) {
  const buildings = scene.buildings ?? []
  const agents = Object.values(arena.agents).filter((a) => a.type !== "lead").sort((a, b) => a.order - b.order)
  const lead = Object.values(arena.agents).find((a) => a.type === "lead")
  const done = agents.filter((a) => a.doneAt).sort((a, b) => a.doneAt - b.doneAt)
  const home = (a: Agent): Spot => {
    const i = done.indexOf(a)
    if (i < 0) return scene.lead
    const side = i % 2 ? 1 : -1
    return { x: scene.lead.x + side * 0.058 * (Math.floor(i / 2) + 1), y: scene.lead.y + 0.035 * (i % 2 ? 1 : 0.6), scale: scene.lead.scale * 0.95 }
  }
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
          className="group absolute z-[5] cursor-pointer border-[3px] border-transparent hover:border-gold-400 hover:bg-gold-300/10"
          style={{ left: `${b.area.x * 100}%`, top: `${b.area.y * 100}%`, width: `${b.area.w * 100}%`, height: `${b.area.h * 100}%` }}
        >
          <span className="absolute bottom-[6px] left-1/2 hidden -translate-x-1/2 whitespace-nowrap bg-navy-950/90 px-2 py-1 font-pixel text-[9px] text-gold-300 group-hover:block">Look inside</span>
        </button>
      ))}
      {buildings.map((b, i) => (
        <Badge key={b.id} b={b} squad={squad} inside={agents.filter((a) => !a.doneAt && buildingFor(scene, a.type) === i)} />
      ))}
      <StaticPlaced spot={scene.lead}>
        <Actor who={who("lead", squad)} agent={lead} seed="lead" />
      </StaticPlaced>
      {agents.map((a) => <Walker key={a.id} agent={a} squad={squad} path={pathFor(a)} home={home(a)} />)}
    </div>
  )
}
