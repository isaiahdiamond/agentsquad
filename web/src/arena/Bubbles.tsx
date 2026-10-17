import { useContext, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import type { Squad } from "@agentsquad/shared"
import { useNow } from "./Hud"
import { H, Stage, TALL, W } from "./Sprite"
import { who, type Agent } from "./store"
import { positions } from "./world"

const LIFE = 4000
const GAP = 6
const PLATE = 26

type Rect = { l: number; r: number; t: number; b: number }

// Speech bubbles for key moments (task assigned, needs you, done): at most one per agent, 4s each, and never overlapping.
// Every frame each bubble is placed over its agent's nameplate; when it would touch an earlier bubble it moves up until it clears.
export default function Bubbles({ agents, scope, squad }: { agents: Agent[]; scope: string; squad: Squad | null }) {
  const now = useNow(250)
  const { ui } = useContext(Stage)
  const els = useRef(new Map<string, HTMLDivElement>())
  const live = agents.filter((a) => a.say && now - a.sayAt < LIFE).sort((a, b) => a.sayAt - b.sayAt || a.order - b.order)
  const key = live.map((a) => `${a.id}:${a.sayAt}`).join()

  useEffect(() => {
    if (!live.length) return
    let raf = 0
    const place = () => {
      const k = ui.get()
      const placed: Rect[] = []
      for (const a of live) {
        const el = els.current.get(a.id)
        const p = positions.get(`${scope}:${a.id}`)
        if (!el) continue
        const visible = !!p && (p.o?.get() ?? 1) > 0.3
        el.style.visibility = visible ? "visible" : "hidden"
        if (!p || !visible) continue
        const w = el.offsetWidth * k, h = el.offsetHeight * k
        const x = p.x.get() * W
        let b = p.y.get() * H + (p.dy?.get() ?? 0) - TALL * p.s - 3 * p.s - PLATE * k
        let rect = { l: x - w / 2, r: x + w / 2, t: b - h, b }
        for (let i = 0; i < 24; i++) {
          const hit = placed.find((q) => rect.l < q.r + GAP * k && rect.r > q.l - GAP * k && rect.t < q.b + GAP * k && rect.b > q.t - GAP * k)
          if (!hit) break
          b = hit.t - GAP * k
          rect = { ...rect, t: b - h, b }
        }
        placed.push(rect)
        el.style.transform = `translate(${Math.round(rect.l)}px, ${Math.round(rect.t)}px) scale(${k})`
      }
      raf = requestAnimationFrame(place)
    }
    place()
    return () => cancelAnimationFrame(raf)
  }, [key, scope])

  return (
    <div className="pointer-events-none absolute inset-0 z-[6000]">
      {live.map((a) => (
        <div
          key={`${a.id}:${a.sayAt}`} className="absolute left-0 top-0" style={{ transformOrigin: "0 0", visibility: "hidden" }}
          ref={(el) => {
            if (el) els.current.set(a.id, el)
            else els.current.delete(a.id)
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
            className="relative mb-2 flex items-start gap-1.5 rounded-xl bg-white px-2.5 py-1.5 text-[12px] font-medium leading-snug text-[#0b0d12] shadow-[0_4px_14px_rgba(0,0,0,.35)]"
            style={{ width: "max-content", maxWidth: 220 }}
          >
            <span className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: a.state === "waiting" ? "#f59e0b" : who(a.type, squad).color }} />
            {a.say}
            <div className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-white" />
          </motion.div>
        </div>
      ))}
    </div>
  )
}
