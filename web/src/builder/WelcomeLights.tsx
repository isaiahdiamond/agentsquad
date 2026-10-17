import { useEffect, useRef } from "react"
import { DEEP_LEDS, IMG_H, IMG_W, LEDS, VP } from "./welcomeLeds"

const DEBUG = import.meta.env.DEV && new URLSearchParams(window.location.search).get("lights") === "debug"

type Led = { x: number; y: number; k: number; mode: number; rate: number; phase: number; duty: number; base: number; flash: number; deep: boolean }

const rand = (a: number, b: number) => a + Math.random() * (b - a)

function makeLeds(): Led[] {
  const all = [...LEDS.map((p) => [...p, 0]), ...DEEP_LEDS.map((p) => [...p, 1])]
  return all.map(([x, y, deep]) => {
    const r = Math.random()
    return {
      x,
      y,
      k: Math.min(1, Math.abs(x - VP[0]) / (x < VP[0] ? VP[0] : IMG_W - VP[0])),
      mode: r < 0.5 ? 0 : r < 0.85 ? 1 : 2,
      rate: r < 0.5 ? rand(0.5, 2) : rand(0.3, 2.5),
      phase: rand(0, 100),
      duty: rand(0.25, 0.7),
      base: rand(0.6, 1),
      flash: -10,
      deep: deep === 1,
    }
  })
}

function level(l: Led, t: number) {
  let v: number
  if (l.mode === 0) {
    const s = 0.5 + 0.5 * Math.sin(t * l.rate + l.phase)
    v = 0.15 + 0.85 * s * s
  } else if (l.mode === 1) {
    const c = (t * l.rate * 0.5 + l.phase) % 1
    const edge = 0.06
    v = c < l.duty ? Math.min(1, c / edge, (l.duty - c) / edge) : 0
    v = 0.08 + 0.92 * v
  } else {
    v = 0.75 + 0.25 * Math.sin(t * 9 + l.phase) * Math.sin(t * 0.7 + l.phase)
  }
  const f = t - l.flash
  if (f >= 0 && f < 0.5) v = Math.max(v, 1 - f / 0.5)
  return v
}

function glowSprite() {
  const c = document.createElement("canvas")
  c.width = c.height = 64
  const g = c.getContext("2d")!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, "rgba(240,250,255,1)")
  grad.addColorStop(0.12, "rgba(200,236,255,0.9)")
  grad.addColorStop(0.35, "rgba(150,170,250,0.28)")
  grad.addColorStop(0.65, "rgba(139,124,246,0.08)")
  grad.addColorStop(1, "rgba(139,124,246,0)")
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return c
}

export default function WelcomeLights({ src }: { src: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext("2d")!
    const sprite = glowSprite()
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const leds = makeLeds()
    let still = motion.matches
    let ready = false
    let w = 0, h = 0, scale = 1, ox = 0, oy = 0
    let raf = 0, last = 0, t = 0, nextCascade = 2

    const cascade = () => {
      const a = leds[Math.floor(Math.random() * leds.length)]
      const reach = 6 + 14 * a.k
      const row = leds.filter((l) => Math.abs(l.x - a.x) < reach && l.y >= a.y && l.y < a.y + 260 * (0.3 + a.k))
      // Flash together with random jitter: a timed sweep down the column reads as a moving light.
      row.forEach((l) => (l.flash = t + Math.random() * 0.15))
    }

    const draw = (dt: number) => {
      t += dt
      ctx.clearRect(0, 0, w, h)
      if (!ready) return
      if (DEBUG) {
        ctx.globalCompositeOperation = "source-over"
        ctx.globalAlpha = 1
        ctx.fillStyle = "#3dff6e"
        for (const l of leds) {
          const sx = l.x * scale + ox, sy = l.y * scale + oy
          ctx.strokeStyle = l.deep ? "#3dd8ff" : "#ff3df2"
          ctx.beginPath()
          ctx.arc(sx, sy, 4, 0, Math.PI * 2)
          ctx.stroke()
          ctx.fillRect(sx - 1, sy - 1, 2, 2)
        }
        return
      }
      if (!still) {
        nextCascade -= dt
        if (nextCascade <= 0) {
          cascade()
          nextCascade = rand(1.2, 3.5)
        }
      }
      ctx.globalCompositeOperation = "lighter"
      for (const l of leds) {
        const fade = l.deep ? Math.min(1, (l.k - 0.27) / 0.2) * 0.8 : 1
        const a = l.base * (still ? 0.55 : level(l, t)) * (0.35 + 0.95 * l.k) * fade
        if (a <= 0.01) continue
        const r = (l.deep ? 3 + 14 * l.k * l.k : 8 + 22 * l.k * l.k) * scale
        ctx.globalAlpha = Math.min(1, a)
        ctx.drawImage(sprite, l.x * scale + ox - r, l.y * scale + oy - r, r * 2, r * 2)
      }
      ctx.globalAlpha = 1
    }

    const frame = (now: number) => {
      draw(Math.min(0.05, (now - last) / 1000))
      last = now
      raf = requestAnimationFrame(frame)
    }
    const start = () => {
      if (still || DEBUG || !ready || raf || document.hidden) return
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
    const stop = () => {
      cancelAnimationFrame(raf)
      raf = 0
    }
    const setMotion = () => {
      still = motion.matches
      stop()
      draw(0)
      start()
    }

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      scale = Math.max(w / IMG_W, h / IMG_H)
      ox = (w - IMG_W * scale) / 2
      oy = (h - IMG_H * scale) / 2
      draw(0)
    }
    let dprQuery: MediaQueryList
    const watchDpr = () => {
      dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`)
      dprQuery.addEventListener("change", onDpr, { once: true })
    }
    const onDpr = () => {
      resize()
      watchDpr()
    }
    const onVisibility = () => (document.hidden ? stop() : start())

    const img = new Image()
    img.onload = () => {
      ready = true
      setMotion()
    }
    img.src = src

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    watchDpr()
    motion.addEventListener("change", setMotion)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      stop()
      img.onload = null
      ro.disconnect()
      dprQuery.removeEventListener("change", onDpr)
      motion.removeEventListener("change", setMotion)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [src])

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
}
