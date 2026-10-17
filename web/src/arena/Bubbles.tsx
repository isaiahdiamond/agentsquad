import { useContext, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import type { Squad } from "@agentsquad/shared"
import { useNow } from "./Hud"
import { H, Stage, TALL, W } from "./Sprite"
import { who, type Agent } from "./store"
import { plateShift, positions } from "./world"
import { LAND_AT, type Portal } from "./Portal"

const LIFE = 4000
const GAP = 6
const PLATE = 26
const PLATE_W = 150

type Rect = { l: number; r: number; t: number; b: number }

// Speech bubbles for key moments (task assigned, needs you, done): at most one per agent, 4s each, and never overlapping.
// Every frame each bubble is placed over its agent's nameplate; when it would touch an earlier bubble it moves up until it clears.
// A spawn bubble waits for its agent's portal landing, so task bubbles come in staggered with the squad.
export default function Bubbles({ agents, scope, squad, portals }: { agents: Agent[]; scope: string; squad: Squad | null; portals?: Map<string, Portal> }) {
  const now = useNow(150)
  const { ui } = useContext(Stage)
  const els = useRef(new Map<string, HTMLDivElement>())
  const startOf = (a: Agent) => {
    const p = portals?.get(a.id)
    return p && a.sayAt <= p.start ? p.start + LAND_AT : a.sayAt
  }
  const lifeOf = (a: Agent) => (a.sayLines ? a.sayLines.reduce((t, [, ms]) => t + ms, 0) : LIFE)
  const live = agents.filter((a) => a.say && now >= startOf(a) && now - startOf(a) < lifeOf(a)).sort((a, b) => startOf(a) - startOf(b) || a.order - b.order)
  // The line showing now, for a bubble that changes text in place ("Got it." then the task).
  const lineOf = (a: Agent) => {
    let t = now - startOf(a)
    for (const [i, [text, ms]] of (a.sayLines ?? []).entries()) {
      if (t < ms) return { i, text }
      t -= ms
    }
    return { i: 0, text: a.say ?? "" }
  }
  const bubbleKey = (a: Agent) => `${a.id}:${a.sayAt}:${lineOf(a).i}`
  const key = live.map(bubbleKey).join()

  useEffect(() => {
    if (!live.length) return
    let raf = 0
    const sizes = new Map<string, { w: number; h: number }>()
    // Where a nameplate sits, in native px: the plate's width is estimated, its height is fixed.
    const plateOf = (id: string, k: number): (Rect & { id: string }) | null => {
      const p = positions.get(`${scope}:${id}`)
      if (!p || (p.o?.get() ?? 1) <= 0.3) return null
      const x = p.x.get() * W
      const b = p.y.get() * H + (p.dy?.get() ?? 0) - TALL * p.s - 3 * p.s + (plateShift.get(`${scope}:${id}`) ?? 0)
      return { id, l: x - PLATE_W * k / 2, r: x + PLATE_W * k / 2, t: b - PLATE * k, b }
    }
    const place = () => {
      const k = ui.get()
      const plates = agents.map((a) => plateOf(a.id, k)).filter((r) => !!r)
      const placed: Rect[] = []
      for (const a of live) {
        const el = els.current.get(a.id)
        const p = positions.get(`${scope}:${a.id}`)
        if (!el) continue
        const visible = !!p && (p.o?.get() ?? 1) > 0.3
        el.style.visibility = visible ? "visible" : "hidden"
        if (!p || !visible) continue
        const sk = el.dataset.key ?? a.id
        let size = sizes.get(sk)
        if (!size) {
          size = { w: el.offsetWidth, h: el.offsetHeight }
          sizes.set(sk, size)
        }
        const w = size.w * k, h = size.h * k
        const x = p.x.get() * W
        let b = p.y.get() * H + (p.dy?.get() ?? 0) - TALL * p.s - 3 * p.s - PLATE * k + (plateShift.get(`${scope}:${a.id}`) ?? 0)
        let rect = { l: x - w / 2, r: x + w / 2, t: b - h, b }
        const others = [...placed, ...plates.filter((q) => q.id !== a.id)]
        for (let i = 0; i < 24; i++) {
          const hit = others.find((q) => rect.l < q.r + GAP * k && rect.r > q.l - GAP * k && rect.t < q.b + GAP * k && rect.b > q.t - GAP * k)
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
  }, [key, scope, agents.map((a) => a.id).join()])

  return (
    <div className="pointer-events-none absolute inset-0 z-[6000]">
      {live.map((a) => (
        <div
          key={bubbleKey(a)} data-key={bubbleKey(a)} className="absolute left-0 top-0" style={{ transformOrigin: "0 0", visibility: "hidden" }}
          ref={(el) => {
            if (el) els.current.set(a.id, el)
            else els.current.delete(a.id)
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
            className="relative mb-2 flex items-start gap-1.5 rounded-xl bg-white px-2.5 py-1.5 text-[12px] font-medium leading-snug text-[#050505] shadow-[0_4px_14px_rgba(0,0,0,.35)]"
            style={{ width: "max-content", maxWidth: 220 }}
          >
            <span className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: a.state === "waiting" ? "#f59e0b" : who(a.type, squad).color }} />
            {lineOf(a).text}
            <div className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-white" />
          </motion.div>
        </div>
      ))}
    </div>
  )
}
