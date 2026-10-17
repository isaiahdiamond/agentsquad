import { useEffect, useRef } from "react"
import { animate, motion, useMotionValue } from "framer-motion"
import type { Scene, Spot, Squad } from "@agentsquad/shared"
import Backdrop from "./Backdrop"
import { CHAR_W, Placed, StaticPlaced } from "./MapView"
import { Actor } from "./Sprite"
import { who, type Agent, type Arena } from "./store"

const ROOM_W = CHAR_W * 1.7

function Mover({ agent, squad, from, to, leave }: { agent: Agent; squad: Squad | null; from: Spot; to: Spot; leave?: boolean }) {
  const x = useMotionValue(from.x), y = useMotionValue(from.y), s = useMotionValue(from.scale), o = useMotionValue(1)
  useEffect(() => {
    const spring = { type: "spring" as const, stiffness: 70, damping: 15 }
    const cs = [animate(x, to.x, spring), animate(y, to.y, spring), animate(s, to.scale, spring)]
    if (leave) cs.push(animate(o, 0, { delay: 0.9, duration: 0.6 }))
    return () => cs.forEach((c) => c.stop())
  }, [to.x, to.y, to.scale, leave])
  return (
    <Placed x={x} y={y} s={s} o={o} size={ROOM_W}>
      <Actor who={who(agent.type, squad)} agent={agent} seed={agent.type} />
    </Placed>
  )
}

// Rooms: a whole-scene room (bar, beach) with the lead, or a building interior showing only the agents inside it.
export default function RoomView({ scene, arena, squad, members, main }: { scene: Scene; arena: Arena; squad: Squad | null; members: Agent[]; main: boolean }) {
  const opened = useRef(Date.now())
  const lead = Object.values(arena.agents).find((a) => a.type === "lead")
  const n = Math.max(1, scene.stations.length)
  const working = members.filter((a) => !a.doneAt)
  const done = members.filter((a) => a.doneAt).sort((a, b) => a.doneAt - b.doneAt)
  const station = (i: number): Spot => {
    const st = scene.stations[i % n] ?? scene.bench
    const lap = Math.floor(i / n)
    return { x: st.x + lap * 0.05, y: st.y + lap * 0.04, scale: st.scale }
  }
  const home = (i: number): Spot => {
    const side = i % 2 ? 1 : -1
    return { x: scene.lead.x + side * 0.06 * (Math.floor(i / 2) + 1), y: scene.lead.y + 0.03, scale: scene.lead.scale * 0.95 }
  }
  const fresh = (a: Agent) => a.firstAt > opened.current - 300

  return (
    <div className="absolute inset-0">
      <Backdrop scene={scene} />
      {main && (
        <svg viewBox="0 0 1600 900" className="pointer-events-none absolute inset-0 z-[5] h-full w-full">
          {working.filter(fresh).map((a, i) => {
            const st = station(members.indexOf(a))
            return (
              <motion.line
                key={a.id} x1={scene.lead.x * 1600} y1={scene.lead.y * 900 - 70} x2={st.x * 1600} y2={st.y * 900 - 70}
                stroke={who(a.type, squad).color} strokeWidth={6} strokeLinecap="round" strokeDasharray="1 0"
                initial={{ pathLength: 0, opacity: 1 }} animate={{ pathLength: 1, opacity: [1, 1, 0] }}
                transition={{ duration: 2.2, delay: i * 0.05, times: [0, 0.6, 1] }}
              />
            )
          })}
        </svg>
      )}
      {main && (
        <StaticPlaced spot={scene.lead} size={ROOM_W}>
          <Actor who={who("lead", squad)} agent={lead} seed="lead" />
        </StaticPlaced>
      )}
      {members.map((a) => {
        const i = members.indexOf(a)
        if (!main && a.doneAt && a.doneAt < opened.current) return null
        const to = !a.doneAt ? station(i) : main ? home(done.indexOf(a)) : scene.bench
        return <Mover key={a.id} agent={a} squad={squad} from={fresh(a) ? scene.bench : station(i)} to={to} leave={!main && a.doneAt > 0} />
      })}
      {!working.length && !main && (
        <div className="absolute inset-x-0 top-[45%] text-center font-pixel text-[11px] text-gold-300 drop-shadow-[2px_2px_0_#000]">
          Nobody is working in here right now.
        </div>
      )}
    </div>
  )
}
