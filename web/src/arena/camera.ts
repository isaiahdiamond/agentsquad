import { useCallback, useMemo, useRef, useState } from "react"
import { animate, useMotionValue, useTransform, type AnimationPlaybackControls } from "framer-motion"
import type { Scene } from "@agentsquad/shared"
import { H, W } from "./Sprite"

export const MAX_ZOOM = 2.5
const EASE = [0.4, 0, 0.2, 1] as const

export type Point = { x: number; y: number }

// Where the camera rests for a scene: the middle of everything that matters (lead, bench, desks, doors and their signs),
// so cover cropping trims scenery before it trims stations.
export function homeOf(scene: Scene): Point {
  const pts = [scene.lead, scene.bench, ...scene.stations, ...(scene.buildings ?? []).flatMap((b) => [b.door, { ...b.door, y: b.door.y - 0.14 }])]
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
  return { x: ((Math.min(...xs) + Math.max(...xs)) / 2) * W, y: ((Math.min(...ys) + Math.max(...ys)) / 2) * H }
}

// The stage always covers the viewport (no bars). cx, cy is the stage point at the middle of the screen; z is zoom on top of cover.
export function useCamera() {
  const [view, setView] = useState({ w: 0, h: 0 })
  const cover = view.w ? Math.max(view.w / W, view.h / H) : 0.5
  const cx = useMotionValue(W / 2), cy = useMotionValue(H / 2), z = useMotionValue(1)
  const running = useRef<AnimationPlaybackControls[]>([])
  const live = useRef({ cover, view })
  live.current = { cover, view }

  const clamp = useCallback((p: Point, zoom: number): Point => {
    const { cover, view } = live.current
    const fit = cover * zoom
    const hw = view.w / 2 / fit, hh = view.h / 2 / fit
    return { x: Math.min(W - hw, Math.max(hw, p.x)), y: Math.min(H - hh, Math.max(hh, p.y)) }
  }, [])

  const transform = useTransform([cx, cy, z], ([x, y, k]: number[]) => {
    const { cover, view } = live.current
    const fit = cover * k
    const c = clamp({ x, y }, k)
    return `translate(${Math.round(view.w / 2 - c.x * fit)}px, ${Math.round(view.h / 2 - c.y * fit)}px) scale(${fit})`
  })
  const ui = useTransform(z, (k) => 1 / (live.current.cover * k))

  const stop = useCallback(() => {
    running.current.forEach((c) => c.stop())
    running.current = []
  }, [])

  const moveTo = useCallback((p: Point, zoom: number, ms = 800) => {
    stop()
    const k = Math.min(MAX_ZOOM, Math.max(1, zoom))
    const c = clamp(p, k)
    const opts = { duration: ms / 1000, ease: EASE }
    if (ms <= 0) {
      cx.set(c.x)
      cy.set(c.y)
      z.set(k)
      return
    }
    running.current = [animate(cx, c.x, opts), animate(cy, c.y, opts), animate(z, k, opts)]
  }, [])

  // Pan by a screen-pixel delta, keeping the center inside the clamp so it never drifts past the edge.
  const panBy = useCallback((dx: number, dy: number) => {
    stop()
    const fit = live.current.cover * z.get()
    const c = clamp({ x: cx.get() - dx / fit, y: cy.get() - dy / fit }, z.get())
    cx.set(c.x)
    cy.set(c.y)
  }, [])

  // Zoom around a screen point, which stays under the cursor.
  const zoomAt = useCallback((sx: number, sy: number, factor: number) => {
    stop()
    const { cover, view } = live.current
    const k0 = z.get(), k1 = Math.min(MAX_ZOOM, Math.max(1, k0 * factor))
    const c0 = clamp({ x: cx.get(), y: cy.get() }, k0)
    const px = c0.x + (sx - view.w / 2) / (cover * k0), py = c0.y + (sy - view.h / 2) / (cover * k0)
    const c1 = clamp({ x: px - (sx - view.w / 2) / (cover * k1), y: py - (sy - view.h / 2) / (cover * k1) }, k1)
    cx.set(c1.x)
    cy.set(c1.y)
    z.set(k1)
  }, [])

  const observer = useRef<ResizeObserver>(null)
  const ref = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect()
    if (!el) return
    observer.current = new ResizeObserver(() => setView({ w: el.clientWidth, h: el.clientHeight }))
    observer.current.observe(el)
  }, [])

  return useMemo(() => ({ ref, view, cover, transform, ui, z, moveTo, panBy, zoomAt, stop }), [view.w, view.h, cover])
}

export type Camera = ReturnType<typeof useCamera>
