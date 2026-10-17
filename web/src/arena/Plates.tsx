import { useContext, useEffect } from "react"
import { Stage } from "./Sprite"
import { plateShift, plates, positions, signs } from "./world"

const GAP = 3

type Box = { l: number; r: number; t: number; b: number }
const hits = (a: Box, b: Box) => a.l < b.r + GAP && a.r > b.l - GAP && a.t < b.b + GAP && a.b > b.t - GAP

// Every frame: working plates (the lead first) keep their spot, then finished ones; a plate that touches an earlier plate
// moves up until it clears, and one that touches a sign takes the shorter way off it (down only a little, so it stays by its head).
export default function PlateLayout({ scope }: { scope: string }) {
  const { ui } = useContext(Stage)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const k = ui.get()
      const fixed: Box[] = []
      for (const [key, el] of signs) {
        if (!key.startsWith(`${scope}:`)) continue
        const r = el.getBoundingClientRect()
        if (r.width) fixed.push({ l: r.left, r: r.right, t: r.top, b: r.bottom })
      }
      const list = [...plates.entries()].filter(([key]) => key.startsWith(`${scope}:`)).map(([key, p]) => {
        const pos = positions.get(key)
        const r = p.el.getBoundingClientRect()
        const visible = !!pos && (pos.o?.get() ?? 1) > 0.3 && r.width > 0
        return { key, p, visible, box: { l: r.left, r: r.right, t: r.top - p.dy, b: r.bottom - p.dy } }
      })
      const rank = (x: (typeof list)[number]) => (x.p.lead ? 0 : x.p.done ? 2 : 1)
      list.sort((a, b) => rank(a) - rank(b) || b.box.b - a.box.b)
      const placed: Box[] = []
      for (const { key, p, visible, box } of list) {
        let off = 0
        if (visible) {
          for (let i = 0; i < 12; i++) {
            const cur = { ...box, t: box.t + off, b: box.b + off }
            const plate = placed.find((q) => hits(cur, q))
            if (plate) {
              off = plate.t - GAP - box.b
              continue
            }
            const sign = fixed.find((q) => hits(cur, q))
            if (!sign) break
            const up = sign.t - GAP - box.b, down = sign.b + GAP - box.t
            off = down < 28 && down < -up ? down : up
          }
          placed.push({ ...box, t: box.t + off, b: box.b + off })
        }
        if (Math.round(off) !== Math.round(p.dy)) p.el.style.translate = `0 ${Math.round(off)}px`
        p.dy = off
        plateShift.set(key, off * k)
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [scope])
  return null
}
