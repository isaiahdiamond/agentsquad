import { useEffect, useRef, useState } from "react"
import type { Look, LookManifest } from "@agentsquad/shared"

// Exact hair colors in the base sprite, ordered highlight to shadow. The art person supplies the real
// hex values; each one is replaced by a shade of the chosen hair color.
export const HAIR_SOURCE_COLORS = ["#d4d4d4"]

const SHADE_STEPS: Record<number, number[]> = {
  1: [0],
  2: [0, -0.3],
  3: [0.25, 0, -0.3],
  4: [0.25, 0, -0.25, -0.45],
}

let manifestPromise: Promise<LookManifest> | null = null

export function loadLookManifest() {
  manifestPromise ??= fetch("/art/looks.json").then((r) => {
    if (!r.ok) throw new Error(`looks.json: ${r.status}`)
    return r.json()
  })
  return manifestPromise
}

export function useLookManifest() {
  const [manifest, setManifest] = useState<LookManifest | null>(null)
  useEffect(() => {
    loadLookManifest().then(setManifest, (err) => console.error(err))
  }, [])
  return manifest
}

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// amount > 0 mixes toward white, < 0 toward black.
export function shade(hex: string, amount: number) {
  return hexToRgb(hex).map((c) => Math.round(amount > 0 ? c + (255 - c) * amount : c * (1 + amount)))
}

export function hairShades(hex: string) {
  const steps = SHADE_STEPS[HAIR_SOURCE_COLORS.length] ?? HAIR_SOURCE_COLORS.map((_, i) => -0.15 * i)
  return steps.map((s) => shade(hex, s))
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`missing art: ${src}`))
    img.src = src
  })
}

function recolorHair(img: HTMLImageElement, color: string) {
  const canvas = document.createElement("canvas")
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = data.data
  const sources = HAIR_SOURCE_COLORS.map(hexToRgb)
  const targets = hairShades(color)
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue
    // Small tolerance only absorbs alpha rounding on antialiased edges; real pixel art matches exactly.
    const k = sources.findIndex(
      (s) => Math.abs(px[i] - s[0]) <= 3 && Math.abs(px[i + 1] - s[1]) <= 3 && Math.abs(px[i + 2] - s[2]) <= 3,
    )
    if (k === -1) continue
    px[i] = targets[k][0]
    px[i + 1] = targets[k][1]
    px[i + 2] = targets[k][2]
  }
  ctx.putImageData(data, 0, 0)
  return canvas
}

type Props = {
  look: Look
  height: number          // max CSS height in px; the sprite is scaled by a whole number to fit
  manifest?: LookManifest
  className?: string
}

// The lead's layered sprite: outfit render, hair (palette swapped), hat. A hat hides the hair.
export default function LeadPreview({ look, height, manifest: given, className = "" }: Props) {
  const loaded = useLookManifest()
  const manifest = given ?? loaded
  const ref = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [missing, setMissing] = useState(false)

  const outfitSrc = manifest?.outfits.find((o) => o.id === look.outfit)?.file[look.body]
  const hatSrc = look.hat === "none" ? undefined : manifest?.hats.find((h) => h.id === look.hat)?.file[look.body]
  const hairSrc = hatSrc || look.hair === "none" ? undefined : manifest?.hair.find((h) => h.id === look.hair)?.file[look.body]

  useEffect(() => {
    if (!manifest) return
    let cancelled = false
    ;(async () => {
      if (!outfitSrc) return setMissing(true)
      try {
        const [outfit, hair, hat] = await Promise.all([
          loadImage(outfitSrc),
          hairSrc ? loadImage(hairSrc).catch(() => null) : null,
          hatSrc ? loadImage(hatSrc).catch(() => null) : null,
        ])
        const canvas = ref.current
        if (cancelled || !canvas) return
        canvas.width = outfit.naturalWidth
        canvas.height = outfit.naturalHeight
        const ctx = canvas.getContext("2d")!
        ctx.imageSmoothingEnabled = false
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(outfit, 0, 0)
        if (hair) ctx.drawImage(recolorHair(hair, look.hairColor), 0, 0)
        if (hat) ctx.drawImage(hat, 0, 0)
        setSize({ w: canvas.width, h: canvas.height })
        setMissing(false)
      } catch {
        if (!cancelled) setMissing(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [manifest, outfitSrc, hairSrc, hatSrc, look.hairColor])

  if (missing) {
    return (
      <div
        className={`flex items-center justify-center border-2 border-black/60 bg-gold-600 font-pixel text-[10px] text-navy-950 ${className}`}
        style={{ height, width: height / 2 }}
        title={`missing art: ${outfitSrc ?? `${look.body} ${look.outfit}`}`}
      >
        LEAD
      </div>
    )
  }

  let w = 0
  let h = 0
  if (size) {
    const up = Math.floor(height / size.h)
    const down = Math.ceil(size.h / height)
    w = up >= 1 ? size.w * up : Math.floor(size.w / down)
    h = up >= 1 ? size.h * up : Math.floor(size.h / down)
  }
  return (
    <canvas
      ref={ref}
      className={`pixelated ${className}`}
      style={{ width: w, height: h, imageRendering: "pixelated", visibility: size ? "visible" : "hidden" }}
    />
  )
}
