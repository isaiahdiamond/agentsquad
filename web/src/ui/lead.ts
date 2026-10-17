import { useEffect, useState } from "react"
import type { Look } from "@agentsquad/shared"

// Layered lead art from web/public/art/lead/lead.json (tools/fetch_lead.py). See vault/Character Customization.md.
export type LeadView = "front" | "hand" | "sit"
export type Point = [number, number]

type OutfitView = { src: string; head: Point }
export type LeadManifest = {
  height: number
  skinTones: Record<string, string[]>            // 4 shades, light to dark
  hairColors: Record<string, string>
  bodies: Record<string, {
    skin: string[]                               // exact skin hexes in this body's sprites, darkest first
    outfits: Record<string, Record<LeadView, OutfitView>>
    hair: Record<string, { src: string; offset: Point } | null>
  }>
  characters: Record<string, Record<LeadView, { src: string }>>
}

// A composed lead sprite. The canvas is symmetric around the sprite's center and its bottom is the feet,
// so draw it like any other sprite (bottom-center anchor). `head` is the top-center of the head in canvas pixels.
export type LeadSprite = { canvas: HTMLCanvasElement; url: string; width: number; height: number; head: Point }

export const PEOPLE = ["a", "b"]
export const CHARACTERS = ["robot", "dog", "gator"]
export const DEFAULT_LOOK: Look = { body: "a", outfit: "blazer", skin: "s4", hair: "sidepart", hairColor: "black", hat: "none" }
const DEFAULT_HAIR: Record<string, string> = { a: "sidepart", b: "straight" }
const OLD_HAIR_COLORS: Record<string, string> = { "#000000": "black" }

export const isCharacter = (look: Look) => CHARACTERS.includes(look.body)

let manifestPromise: Promise<LeadManifest> | null = null

export function loadLead(): Promise<LeadManifest> {
  manifestPromise ??= fetch("/art/lead/lead.json")
    .then((r) => {
      if (!r.ok) throw new Error(`lead.json: ${r.status}`)
      return r.json() as Promise<LeadManifest>
    })
    .catch((err) => {
      manifestPromise = null
      throw err
    })
  return manifestPromise
}

export function useLeadManifest() {
  const [manifest, setManifest] = useState<LeadManifest | null>(null)
  useEffect(() => {
    let live = true
    loadLead().then((m) => live && setManifest(m), () => {})
    return () => {
      live = false
    }
  }, [])
  return manifest
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

function nearestColor(hex: string, colors: Record<string, string>) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null
  const c = rgb(hex)
  let best: string | null = null
  let bestD = Infinity
  for (const [id, h] of Object.entries(colors)) {
    const d = rgb(h).reduce((s, v, i) => s + (v - c[i]) ** 2, 0)
    if (d < bestD) [best, bestD] = [id, d]
  }
  return best
}

// Any saved or hand-written look (old 8-variant looks, "body-a", hex hair colors, missing skin) becomes a valid one.
// Without the manifest it only fixes the shape; pass the manifest to check every id against the art.
export function normalizeLook(raw: unknown, m?: LeadManifest | null): Look {
  const l = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const str = (v: unknown) => (typeof v === "string" ? v : "")
  const types = m ? [...Object.keys(m.bodies), ...Object.keys(m.characters)] : [...PEOPLE, ...CHARACTERS]
  const body = str(l.body).replace(/^body-/, "") || str(l.type)
  const look: Look = { ...DEFAULT_LOOK, body: types.includes(body) ? body : DEFAULT_LOOK.body, hat: "none" }
  const outfit = str(l.outfit).replace(/^outfit-/, "")
  const skin = str(l.skin)
  const hair = str(l.hair).replace(/^hair-/, "")
  const hairColor = str(l.hairColor)
  if (!m) {
    return {
      ...look,
      outfit: outfit || look.outfit,
      skin: skin || look.skin,
      hair: !hair || hair === "none" ? DEFAULT_HAIR[look.body] ?? look.hair : hair,
      hairColor: OLD_HAIR_COLORS[hairColor.toLowerCase()] ?? (hairColor.startsWith("#") ? look.hairColor : hairColor || look.hairColor),
    }
  }
  const b = m.bodies[look.body] ?? m.bodies[DEFAULT_LOOK.body]
  const outfits = Object.keys(b.outfits)
  return {
    ...look,
    outfit: outfits.includes(outfit) ? outfit : outfits.includes(DEFAULT_LOOK.outfit) ? DEFAULT_LOOK.outfit : outfits[0],
    skin: skin in m.skinTones ? skin : DEFAULT_LOOK.skin,
    hair: hair in b.hair ? hair : DEFAULT_HAIR[look.body] in b.hair ? DEFAULT_HAIR[look.body] : "bald",
    hairColor: hairColor in m.hairColors ? hairColor : nearestColor(hairColor, m.hairColors) ?? DEFAULT_LOOK.hairColor,
  }
}

const images = new Map<string, Promise<HTMLImageElement>>()

function loadImage(src: string) {
  let p = images.get(src)
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => {
        images.delete(src)
        reject(new Error(`missing art: ${src}`))
      }
      img.src = src
    })
    images.set(src, p)
  }
  return p
}

function pixels(img: HTMLImageElement) {
  const c = document.createElement("canvas")
  c.width = img.width
  c.height = img.height
  const ctx = c.getContext("2d")!
  ctx.drawImage(img, 0, 0)
  return { c, ctx, data: ctx.getImageData(0, 0, c.width, c.height) }
}

const sprites = new Map<string, Promise<LeadSprite>>()

export function leadKey(look: Look, view: LeadView) {
  if (isCharacter(look)) return `${look.body}/${view}`
  return [look.body, look.outfit, view, look.skin, look.hair, look.hairColor].join("/")
}

async function compose(m: LeadManifest, look: Look, view: LeadView): Promise<LeadSprite> {
  const ch = m.characters[look.body]
  if (ch) {
    const img = await loadImage(ch[view].src)
    const { c, data } = pixels(img)
    let top = 0
    while (top < c.height && ![...Array(c.width).keys()].some((x) => data.data[(top * c.width + x) * 4 + 3])) top++
    return { canvas: c, url: c.toDataURL(), width: c.width, height: c.height, head: [Math.round(c.width / 2), top] }
  }

  const b = m.bodies[look.body]
  const o = b.outfits[look.outfit][view]
  const h = b.hair[look.hair ?? ""] ?? null
  const [body, hairImg] = await Promise.all([loadImage(o.src), h ? loadImage(h.src) : null])

  const sprite = pixels(body)
  const tone = [...(m.skinTones[look.skin ?? ""] ?? m.skinTones[DEFAULT_LOOK.skin!])].reverse()
  const swap = new Map<number, number[]>()
  b.skin.forEach((hex, i) => {
    const [r, g, bl] = rgb(hex)
    swap.set((r << 16) | (g << 8) | bl, rgb(tone[Math.min(tone.length - 1, Math.floor((i * tone.length) / b.skin.length))]))
  })
  const d = sprite.data.data
  for (let i = 0; i < d.length; i += 4) {
    const to = d[i + 3] ? swap.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]) : undefined
    if (to) [d[i], d[i + 1], d[i + 2]] = to
  }
  sprite.ctx.putImageData(sprite.data, 0, 0)

  let hairCanvas: HTMLCanvasElement | null = null
  let hx = 0
  let hy = 0
  if (h && hairImg) {
    const hp = pixels(hairImg)
    const t = rgb(m.hairColors[look.hairColor] ?? m.hairColors[DEFAULT_LOOK.hairColor])
    const hd = hp.data.data
    for (let i = 0; i < hd.length; i += 4) {
      if (!hd[i + 3]) continue
      const k = 0.45 + (0.75 * (0.3 * hd[i] + 0.59 * hd[i + 1] + 0.11 * hd[i + 2])) / 255
      for (let j = 0; j < 3; j++) hd[i + j] = Math.min(255, Math.round(t[j] * k))
    }
    hp.ctx.putImageData(hp.data, 0, 0)
    hairCanvas = hp.c
    hx = o.head[0] + h.offset[0]
    hy = o.head[1] + h.offset[1]
  }

  const w = body.width
  const padX = hairCanvas ? Math.max(0, -hx, hx + hairCanvas.width - w) : 0
  const padTop = hairCanvas ? Math.max(0, -hy) : 0
  const out = document.createElement("canvas")
  out.width = w + padX * 2
  out.height = body.height + padTop
  const ctx = out.getContext("2d")!
  ctx.drawImage(sprite.c, padX, padTop)
  if (hairCanvas) ctx.drawImage(hairCanvas, padX + hx, padTop + hy)
  return { canvas: out, url: out.toDataURL(), width: out.width, height: out.height, head: [padX + o.head[0], padTop + o.head[1]] }
}

// Composed sprite for a look and view, cached by type/outfit/view/skin/hair/hairColor. Rejects if art is missing.
export async function leadSprite(look: Look, view: LeadView = "front"): Promise<LeadSprite> {
  const m = await loadLead()
  const l = normalizeLook(look, m)
  const key = leadKey(l, view)
  let p = sprites.get(key)
  if (!p) {
    p = compose(m, l, view)
    p.catch(() => sprites.delete(key))
    sprites.set(key, p)
  }
  return p
}

// React hook. `sprite` is null until the first compose, then keeps the previous sprite while a new look composes
// (no flicker). `failed` means the art could not load: draw a fallback.
export function useLeadSprite(look: Look | null, view: LeadView = "front") {
  const l = look ?? DEFAULT_LOOK
  const key = leadKey(l, view)
  const [state, setState] = useState<{ sprite: LeadSprite | null; failed: boolean }>({ sprite: null, failed: false })
  useEffect(() => {
    let live = true
    leadSprite(l, view).then(
      (sprite) => live && setState({ sprite, failed: false }),
      () => live && setState({ sprite: null, failed: true }),
    )
    return () => {
      live = false
    }
  }, [key])
  return state
}
