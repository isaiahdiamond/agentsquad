import { useEffect, useRef } from "react"

type Pt = [number, number]

const IMG_W = 2688
const IMG_H = 1520

// Hallway vanishing point on welcome-bg.png (image px), from the rack edges. Only used for depth.
const VP_X = 1379

// Status LED pixels on the rack faces, sampled from the art (bright pixels between each wall's rack top and bottom edges).
const LEDS: Pt[] = [
  [10, 257], [17, 314], [19, 287], [19, 503], [19, 584], [19, 725], [19, 756], [19, 912], [20, 689], [22, 465],
  [22, 546], [22, 804], [22, 872], [23, 933], [23, 990], [98, 584], [100, 296], [100, 321], [100, 469], [100, 519],
  [100, 681], [100, 798], [100, 900], [101, 926], [101, 966], [102, 569], [102, 734], [103, 626], [103, 704],
  [106, 649], [122, 929], [123, 682], [124, 382], [124, 628], [128, 325], [131, 648], [132, 411], [132, 429],
  [136, 383], [136, 958], [137, 925], [139, 671], [143, 271], [145, 327], [151, 955], [173, 286], [173, 947],
  [174, 329], [174, 648], [265, 604], [265, 639], [265, 655], [265, 794], [266, 326], [266, 458], [266, 816],
  [267, 842], [268, 354], [268, 374], [268, 683], [268, 882], [268, 932], [269, 438], [270, 524], [270, 567],
  [274, 904], [282, 327], [282, 379], [282, 408], [282, 567], [285, 520], [286, 363], [290, 931], [291, 812],
  [291, 900], [293, 439], [298, 570], [299, 333], [321, 570], [321, 647], [322, 459], [322, 919], [323, 344],
  [323, 430], [324, 378], [325, 526], [394, 477], [394, 497], [394, 875], [394, 907], [395, 686], [397, 434],
  [397, 650], [397, 709], [437, 667], [437, 894], [492, 701], [492, 784], [496, 485], [497, 680], [498, 523],
  [523, 879], [525, 683], [2105, 875], [2107, 536], [2108, 842], [2161, 493], [2185, 798], [2188, 485], [2188, 785],
  [2188, 833], [2190, 667], [2190, 741], [2191, 522], [2191, 697], [2191, 863], [2191, 891], [2251, 669], [2251, 868],
  [2252, 604], [2252, 738], [2252, 830], [2253, 446], [2253, 702], [2253, 906], [2291, 430], [2292, 912], [2294, 834],
  [2297, 689], [2297, 703], [2368, 346], [2368, 795], [2370, 378], [2370, 462], [2370, 844], [2370, 928], [2371, 488],
  [2371, 542], [2371, 812], [2371, 900], [2395, 549], [2395, 935], [2398, 383], [2399, 414], [2399, 811], [2400, 445],
  [2403, 906], [2404, 363], [2405, 637], [2411, 411], [2418, 814], [2419, 453], [2419, 501], [2419, 907], [2421, 654],
  [2422, 891], [2423, 356], [2423, 371], [2424, 408], [2424, 639], [2426, 554], [2426, 796], [2426, 846], [2426, 940],
  [2513, 924], [2514, 958], [2516, 899], [2519, 648], [2536, 655], [2538, 928], [2539, 903], [2540, 517], [2541, 332],
  [2545, 270], [2550, 654], [2551, 409], [2551, 555], [2553, 374], [2553, 893], [2554, 280], [2554, 329], [2554, 477],
  [2554, 872], [2554, 970], [2555, 427], [2556, 308], [2556, 936], [2563, 468], [2564, 680], [2567, 709], [2569, 648],
  [2571, 362], [2572, 407], [2575, 301], [2589, 421], [2589, 461], [2589, 650], [2589, 683], [2589, 906], [2589, 919],
  [2589, 979], [2590, 701], [2590, 805], [2590, 827], [2590, 939], [2593, 293], [2668, 505], [2669, 264], [2669, 468],
  [2669, 728], [2672, 285], [2672, 546], [2672, 688], [2672, 757], [2672, 880], [2672, 915], [2673, 587], [2682, 258],
  [2685, 995],
]

const DEBUG = import.meta.env.DEV && new URLSearchParams(window.location.search).get("lights") === "debug"

type Led = { x: number; y: number; k: number; mode: number; rate: number; phase: number; duty: number; base: number; flash: number }

const rand = (a: number, b: number) => a + Math.random() * (b - a)

function makeLeds(): Led[] {
  return LEDS.map(([x, y]) => {
    const r = Math.random()
    return {
      x,
      y,
      k: Math.min(1, Math.abs(x - VP_X) / VP_X),
      mode: r < 0.5 ? 0 : r < 0.85 ? 1 : 2,
      rate: r < 0.5 ? rand(0.5, 2) : rand(0.3, 2.5),
      phase: rand(0, 100),
      duty: rand(0.25, 0.7),
      base: rand(0.6, 1),
      flash: -10,
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
      row.sort((p, q) => p.y - q.y)
      row.forEach((l, i) => (l.flash = t + i * 0.07))
    }

    const draw = (dt: number) => {
      t += dt
      ctx.clearRect(0, 0, w, h)
      if (!ready) return
      if (DEBUG) {
        ctx.globalCompositeOperation = "source-over"
        ctx.globalAlpha = 1
        ctx.strokeStyle = "#ff3df2"
        ctx.fillStyle = "#3dff6e"
        for (const l of leds) {
          const sx = l.x * scale + ox, sy = l.y * scale + oy
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
        const a = l.base * (still ? 0.55 : level(l, t)) * (0.35 + 0.95 * l.k)
        if (a <= 0.01) continue
        const r = (8 + 22 * l.k * l.k) * scale
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
