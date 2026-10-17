import { useEffect, useRef } from "react"

type Pt = [number, number]

const IMG_W = 2688
const IMG_H = 1520

// Measured on welcome-bg.png (image px). Rack top and bottom edges on both walls meet at VP
// (least squares over four rack edges); the floor tiles are drawn to a higher point (four tile lines agree within 10px).
const VP: Pt = [1379, 769]
const FLOOR_VP: Pt = [1351, 583]
const WALLS: { top: Pt; bottom: Pt; edge: number }[] = [
  { top: [75, 182], bottom: [95, 1000], edge: 0 },
  { top: [2618, 182], bottom: [2503, 985], edge: IMG_W },
]

// Brightest LED pixels on the rack faces, sampled from the art.
const LEDS: Pt[] = [
  [10, 257], [20, 689], [22, 995], [22, 465], [22, 872], [22, 546], [22, 804], [23, 933], [98, 584], [100, 797],
  [100, 900], [100, 469], [100, 321], [101, 966], [124, 404], [126, 682], [143, 271], [173, 947], [174, 329], [265, 794],
  [265, 456], [265, 682], [265, 884], [265, 372], [282, 567], [321, 922], [323, 344], [323, 647], [323, 430], [394, 477],
  [437, 667], [437, 894], [494, 715], [495, 835], [496, 485], [498, 534], [523, 879], [525, 683],
  [2105, 875], [2107, 536], [2160, 791], [2188, 485], [2188, 833], [2190, 667], [2191, 891], [2191, 522], [2191, 863],
  [2252, 738], [2253, 601], [2291, 430], [2292, 912], [2294, 686], [2294, 834], [2368, 346], [2370, 844], [2370, 462],
  [2395, 549], [2395, 935], [2421, 654], [2426, 405], [2426, 796], [2514, 958], [2536, 655], [2540, 520], [2541, 332],
  [2555, 427], [2589, 827], [2589, 919], [2590, 701], [2592, 979], [2593, 293], [2669, 468], [2672, 757], [2672, 918],
  [2672, 685], [2673, 587], [2682, 258],
]

const MAX_TRAVELERS = 36

type Traveler = { s: Pt; vp: Pt; z: number; speed: number; end: number; age: number; size: number; chase: boolean }

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const lineY = (p: Pt, x: number) => p[1] + ((VP[1] - p[1]) * (x - p[0])) / (VP[0] - p[0])
const depth = (x: number) => Math.min(1, Math.abs(x - VP[0]) / VP[0])

function spawn(warm: boolean): Traveler {
  const r = Math.random()
  const age = warm ? 2 : 0
  if (r < 0.1) {
    return { s: [rand(1000, 1460), rand(1110, 1150)], vp: FLOOR_VP, z: warm ? rand(1, 1.7) : 1, speed: rand(0.04, 0.07), end: 1.8, age, size: 9, chase: false }
  }
  if (r < 0.2) {
    return { s: [rand(150, IMG_W - 150), rand(-40, 40)], vp: VP, z: warm ? rand(1, 2.6) : 1, speed: rand(0.06, 0.1), end: 3, age, size: 10, chase: false }
  }
  const wall = WALLS[Math.random() < 0.5 ? 0 : 1]
  const u = rand(0.04, 0.96)
  const y = lineY(wall.top, wall.edge) * (1 - u) + lineY(wall.bottom, wall.edge) * u
  return { s: [wall.edge, y], vp: VP, z: warm ? rand(1, 5) : rand(0.95, 1.1), speed: rand(0.06, 0.11), end: 6, age, size: 16, chase: false }
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

export default function WelcomeLights() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext("2d")!
    const sprite = glowSprite()
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const leds = LEDS.map(([x, y]) => ({ x, y, k: depth(x), phase: rand(0, Math.PI * 2), rate: rand(0.4, 1.6), base: rand(0.35, 0.8) }))
    const travelers: Traveler[] = still ? [] : Array.from({ length: MAX_TRAVELERS }, () => spawn(true))
    let w = 0, h = 0, scale = 1, ox = 0, oy = 0
    let raf = 0, last = 0, t = 0, nextChase = 1

    const glow = (x: number, y: number, r: number, a: number) => {
      if (a <= 0.004) return
      const sx = x * scale + ox, sy = y * scale + oy, sr = r * scale
      ctx.globalAlpha = Math.min(1, a)
      ctx.drawImage(sprite, sx - sr, sy - sr, sr * 2, sr * 2)
    }

    const draw = (dt: number) => {
      t += dt
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = "lighter"

      for (const l of leds) {
        const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(t * l.rate + l.phase)
        glow(l.x, l.y, 6 + 14 * l.k, l.base * (0.2 + 0.8 * pulse * pulse * pulse) * (0.5 + 0.5 * l.k))
      }
      if (still) return

      nextChase -= dt
      if (nextChase <= 0 && travelers.length < MAX_TRAVELERS + 4) {
        const l = leds[Math.floor(Math.random() * leds.length)]
        travelers.push({ s: [l.x, l.y], vp: VP, z: 1, speed: rand(0.22, 0.32), end: 1.55, age: 0, size: 5 + 9 * l.k, chase: true })
        nextChase = rand(0.6, 1.6)
      }

      ctx.lineCap = "round"
      for (let i = travelers.length - 1; i >= 0; i--) {
        const p = travelers[i]
        p.age += dt
        p.z += p.speed * dt * Math.sqrt(p.z)
        if (p.z >= p.end) {
          if (p.chase) travelers.splice(i, 1)
          else travelers[i] = spawn(false)
          continue
        }
        const k = 1 / p.z
        const x = p.vp[0] + (p.s[0] - p.vp[0]) * k
        const y = p.vp[1] + (p.s[1] - p.vp[1]) * k
        const life = (p.z - 1) / (p.end - 1)
        const fadeIn = Math.min(1, p.age / 1.2)
        const a = p.chase
          ? Math.sin(Math.PI * life) * 0.75
          : fadeIn * Math.min(1, (1 - life) * 4) * Math.min(1, Math.max(0, (k - 0.17) / 0.4)) * 0.8
        const r = p.size * (p.chase ? 1 : Math.pow(k, 0.8))

        const k2 = 1 / (p.z * 0.95)
        const tx = p.vp[0] + (p.s[0] - p.vp[0]) * k2
        const ty = p.vp[1] + (p.s[1] - p.vp[1]) * k2
        ctx.globalAlpha = a * 0.22
        ctx.strokeStyle = "rgb(170,215,255)"
        ctx.lineWidth = Math.max(0.6, r * scale * 0.28)
        ctx.beginPath()
        ctx.moveTo(tx * scale + ox, ty * scale + oy)
        ctx.lineTo(x * scale + ox, y * scale + oy)
        ctx.stroke()
        glow(x, y, r, a)
      }
      ctx.globalAlpha = 1
    }

    const frame = (now: number) => {
      draw(Math.min(0.05, (now - last) / 1000))
      last = now
      raf = requestAnimationFrame(frame)
    }
    const start = () => {
      if (still || raf || document.hidden) return
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
    const stop = () => {
      cancelAnimationFrame(raf)
      raf = 0
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
    const onVisibility = () => (document.hidden ? stop() : start())

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    document.addEventListener("visibilitychange", onVisibility)
    start()
    return () => {
      stop()
      ro.disconnect()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
}
