import { useEffect, useState } from "react"
import type { Look } from "@agentsquad/shared"

// Layered lead art from web/public/art/lead/lead.json (tools/fetch_lead.py). See vault/Character Customization.md.
export type LeadView = "front" | "hand" | "sit"
export type Point = [number, number]

type OutfitView = {
  src: string
  head: Point
  palette?: Record<string, string>
  sleeveColor?: string
  graphics?: { offset: Point; rows: string[]; color: string }[]
}
export type LeadManifest = {
  height: number
  athleticBottoms?: { src: string; columns: number; rows: number }
  denimBottoms?: { src: string; columns: number; rows: number }
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
export const CHARACTERS = ["dog", "gator"]
export const DEFAULT_LOOK: Look = { body: "a", outfit: "blazer", skin: "s4", hair: "sidepart", hairColor: "brown", hat: "none" }
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
  if (body === "robot") return normalizeLook(DEFAULT_LOOK, m)
  const look: Look = { ...DEFAULT_LOOK, body: types.includes(body) ? body : DEFAULT_LOOK.body, hat: "none" }
  for (const field of ["topColor", "pantsColor", "shoeColor", "sleeveColor", "graphicColor"] as const) {
    if (/^#[0-9a-f]{6}$/i.test(str(l[field]))) look[field] = str(l[field])
  }
  if (["default", "none", "uf", "star", "letter", "tour", "gull", "sunset", "checker"].includes(str(l.graphic))) look.graphic = l.graphic as Look["graphic"]
  if (l.bottoms === "original" || (look.body === "b" && ["gym-shorts", "leggings"].includes(str(l.bottoms)))) look.bottoms = l.bottoms as Look["bottoms"]
  if (l.bottoms === "jorts" && look.body === "a") look.bottoms = "jorts"
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
    hair: hair in b.hair ? hair : DEFAULT_HAIR[look.body] in b.hair ? DEFAULT_HAIR[look.body] : Object.keys(b.hair).find((s) => s !== "bald") ?? "bald",
    hairColor: hairColor in m.hairColors ? hairColor : nearestColor(hairColor, m.hairColors) ?? DEFAULT_LOOK.hairColor,
  }
}

// Type tiles and newly selected people start with a distinct hairstyle.
// Hair remains independently editable after choosing a type.
export function lookForBody(look: Look, body: string, m?: LeadManifest | null): Look {
  return normalizeLook({ ...look, body, hair: DEFAULT_HAIR[body] ?? look.hair }, m)
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
const MAX_SPRITES = 200

export function leadKey(look: Look, view: LeadView) {
  if (isCharacter(look)) return `${look.body}/${view}`
  return [look.body, look.outfit, view, look.skin, look.hair, look.hairColor, look.topColor, look.pantsColor, look.bottoms, look.shoeColor, look.sleeveColor, look.graphic, look.graphicColor].join("/")
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
  const athleticMask = new Uint8Array(body.width * body.height)
  const bareLegMask = new Uint8Array(body.width * body.height)
  const denim = look.body === "a" && look.bottoms === "jorts" && !!m.denimBottoms
  if ((look.body === "b" && look.bottoms && look.bottoms !== "original" && m.athleticBottoms) || denim) {
    const sheet = (denim ? m.denimBottoms : m.athleticBottoms)!
    const image = await loadImage(sheet.src)
    const column = view === "sit" ? 2 : view === "hand" ? 1 : 0
    const row = denim || look.bottoms === "gym-shorts" ? 0 : 1
    const cell = document.createElement("canvas")
    const sx = Math.round(image.width * column / sheet.columns), sy = Math.round(image.height * row / sheet.rows)
    cell.width = Math.round(image.width * (column + 1) / sheet.columns) - sx
    cell.height = Math.round(image.height * (row + 1) / sheet.rows) - sy
    const ctx = cell.getContext("2d")!
    ctx.drawImage(image, sx, sy, cell.width, cell.height, 0, 0, cell.width, cell.height)
    const framePixels = ctx.getImageData(0, 0, cell.width, cell.height)
    const data = framePixels.data
    let left = cell.width, right = 0, top = cell.height, bottom = 0
    for (let y = 0; y < cell.height; y++) for (let x = 0; x < cell.width; x++) {
      const alpha = (y * cell.width + x) * 4 + 3
      if (data[alpha] < 128) { data[alpha] = 0; continue }
      data[alpha] = 255
      left = Math.min(left, x); right = Math.max(right, x + 1)
      top = Math.min(top, y); bottom = Math.max(bottom, y + 1)
    }
    ctx.putImageData(framePixels, 0, 0)
    if (right <= left || bottom <= top) throw new Error("Empty athletic clothing layer")
    // A fixed body waist keeps leg length independent of the selected top.
    // Extend the short-tee torso to that waist instead of stretching the legs
    // upward into the old skirt region.
    const waist = o.head[1] + (denim ? 55 : 53)
    if (/-gameday-|-sundress-/.test(o.src)) {
      const torsoTop = o.head[1] + 32, oldWaist = o.head[1] + 49
      sprite.ctx.imageSmoothingEnabled = false
      sprite.ctx.clearRect(0, torsoTop, body.width, waist - torsoTop)
      sprite.ctx.drawImage(body, 0, torsoTop, body.width, oldWaist - torsoTop, 0, torsoTop, body.width, waist - torsoTop)
      sprite.data.data.set(sprite.ctx.getImageData(0, 0, body.width, body.height).data)
    }
    const layer = document.createElement("canvas")
    layer.width = body.width; layer.height = body.height
    const lc = layer.getContext("2d")!
    lc.imageSmoothingEnabled = false
    const height = body.height - waist
    // Match waist width separately from height: the generated fitted layers
    // have a much narrower waistband than their hips, knees, and shoes.
    const bandY = Math.min(bottom - 1, top + Math.round((bottom - top) * 0.04))
    let bandLeft = right, bandRight = left
    for (let bx = left; bx < right; bx++) {
      if (!data[(bandY * cell.width + bx) * 4 + 3]) continue
      bandLeft = Math.min(bandLeft, bx); bandRight = Math.max(bandRight, bx + 1)
    }
    const waistband = Math.max(1, bandRight - bandLeft)
    const targetWaist = denim ? (view === "sit" ? 24 : 22) : (view === "sit" ? 22 : 20)
    // Athletic hips are subtly fuller than the torso; keep the waist fitted
    // while allowing the thighs and flared hems their natural width.
    const maxWidth = denim ? (view === "sit" ? 35 : 32) : (view === "sit" ? 38 : 36)
    const width = Math.min(maxWidth, body.width - 2, Math.round((right - left) * targetWaist / waistband))
    const center = o.head[0] + (view === "sit" ? 7 : 3)
    const x = Math.max(0, Math.min(body.width - width, Math.round(center - width / 2)))
    // Female source layers include a small bare waist strip. Remove it so
    // shirts meet the waistband instead of floating above a skin-colored gap.
    const garmentTop = denim ? top : top + Math.round((bottom - top) * 0.06)
    lc.drawImage(cell, left, garmentTop, right - left, bottom - garmentTop, x, waist, width, height)
    const lower = lc.getImageData(0, 0, layer.width, layer.height).data
    const sourceSkin = b.skin.map(rgb)
    const shorts = !denim && look.bottoms === "gym-shorts"
    const skinRamp = [...(m.skinTones[look.skin ?? ""] ?? m.skinTones[DEFAULT_LOOK.skin!])].reverse().map(rgb)
    const isLegSkin = (i: number) => lower[i + 3] > 0 && lower[i] > lower[i + 1] * 1.08 && lower[i + 1] > lower[i + 2] * 1.03 && lower[i] - lower[i + 2] > 12
    for (let y = waist; y < body.height; y++) for (let x = 0; x < body.width; x++) {
      const i = (y * body.width + x) * 4
      const old = [sprite.data.data[i], sprite.data.data[i + 1], sprite.data.data[i + 2]]
      // Preserve foreground fingers at the waistband in seated poses.
      const finger = old[0] > old[1] * 1.2 && old[0] < old[1] * 1.8 && old[1] > old[2] * 1.15 && old[2] > 30
      if (y < waist + 5 && finger && Math.abs(x - center) > 6) continue
      for (let k = 0; k < 4; k++) sprite.data.data[i + k] = lower[i + k]
      athleticMask[i / 4] = 1
      const r = lower[i], g = lower[i + 1], bl = lower[i + 2]
      if (shorts && isLegSkin(i)) {
        // The source's fine shading became speckled when reduced to a tiny
        // sprite and snapped to a six-color palette. Smooth only bare skin,
        // keeping the hem, leg gap, shoes and dark contour untouched.
        let light = 0, weight = 0
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || nx >= body.width || ny < waist || ny >= body.height) continue
          const j = (ny * body.width + nx) * 4
          if (!isLegSkin(j)) continue
          const w = dx === 0 && dy === 0 ? 2 : 1
          light += (lower[j] * .3 + lower[j + 1] * .59 + lower[j + 2] * .11) * w
          weight += w
        }
        const shade = Math.max(0, Math.min(skinRamp.length - 1, ((light / weight - 72) / 85) * (skinRamp.length - 1)))
        const lo = Math.floor(shade), hi = Math.min(skinRamp.length - 1, lo + 1), fraction = shade - lo
        for (let k = 0; k < 3; k++) sprite.data.data[i + k] = Math.round(skinRamp[lo][k] * (1 - fraction) + skinRamp[hi][k] * fraction)
        bareLegMask[i / 4] = 1
      } else if (lower[i + 3] && r > g * 1.2 && g > bl * 1.15) {
        const nearest = sourceSkin.reduce((a, b) => (r - a[0]) ** 2 + (g - a[1]) ** 2 + (bl - a[2]) ** 2 < (r - b[0]) ** 2 + (g - b[1]) ** 2 + (bl - b[2]) ** 2 ? a : b)
        for (let k = 0; k < 3; k++) sprite.data.data[i + k] = nearest[k]
      }
    }
  } else if (look.bottoms && look.bottoms !== "original") {
    // Reuse pose-matched athletic art rather than painting over a skirt or
    // exposing standing legs when the character sits down.
    const shorts = look.bottoms === "gym-shorts" || look.bottoms === "jorts"
    const lowerBody = shorts ? m.bodies.a : b
    const lower = lowerBody.outfits[shorts ? "gameday" : "hoodie"][view]
    const layer = pixels(await loadImage(lower.src))
    const skin = new Map(lowerBody.skin.map((hex, i) => [hex.toUpperCase(), rgb(b.skin[Math.min(b.skin.length - 1, i)])]))
    const jorts = look.bottoms === "jorts"
    const waist = o.head[1] + (jorts ? 55 : 59)
    const lowerWaist = lower.head[1] + 59
    for (let y = waist; y < body.height; y++) for (let x = 0; x < body.width; x++) {
      // Give denim a relaxed fit and use the same body waist as the athletic
      // bottoms, rather than attaching narrow shorts below a long torso.
      const sx = jorts
        ? Math.round((x - o.head[0] - 2) / 1.18 + lower.head[0] + 2)
        : x - o.head[0] + lower.head[0]
      const sy = jorts
        ? lowerWaist + Math.floor((y - waist) * (layer.c.height - lowerWaist) / (body.height - waist))
        : y - o.head[1] + lower.head[1]
      const i = (y * body.width + x) * 4
      const j = (sy * layer.c.width + sx) * 4
      const inside = sx >= 0 && sx < layer.c.width && sy >= 0 && sy < layer.c.height
      for (let k = 0; k < 4; k++) sprite.data.data[i + k] = inside ? layer.data.data[j + k] : 0
      athleticMask[i / 4] = 1
      if (!sprite.data.data[i + 3]) continue
      const hex = "#" + [0, 1, 2].map((k) => sprite.data.data[i + k].toString(16).padStart(2, "0")).join("").toUpperCase()
      const tone = skin.get(hex)
      const rawR = layer.data.data[j], rawG = layer.data.data[j + 1], rawB = layer.data.data[j + 2]
      if (look.bottoms === "jorts" && sy >= lower.head[1] + 62 && sy < lower.head[1] + 74 && (view === "sit" || Math.abs(sx - lower.head[0] - 2) <= 10) && rawR > rawG * 1.2 && rawG > rawB * 1.15 && rawR * 0.3 + rawG * 0.59 + rawB * 0.11 > 45) {
        // Jorts reach toward the knee, past the athletic shorts' high hem.
        const shade = Math.min(1, (rawR + rawG + rawB) / 350)
        const denim = [38 + shade * 69, 61 + shade * 87, 88 + shade * 99]
        for (let k = 0; k < 3; k++) sprite.data.data[i + k] = Math.round(denim[k])
      } else if (tone) {
        for (let k = 0; k < 3; k++) sprite.data.data[i + k] = tone[k]
      } else if (look.bottoms === "jorts" && sy < lower.head[1] + 77) {
        const r = layer.data.data[j], g = layer.data.data[j + 1], blue = layer.data.data[j + 2]
        if (blue > r * 1.25 && blue > g * 1.08) {
          // Retain folds and the dark seam, with a washed-denim blue ramp.
          const light = Math.min(1, (r * 0.3 + g * 0.59 + blue * 0.11) / 100)
          const denim = [38 + light * 69, 61 + light * 87, 88 + light * 99]
          for (let k = 0; k < 3; k++) sprite.data.data[i + k] = Math.round(denim[k])
        }
      } else if (!shorts && y < body.height - 10) {
        const brightness = layer.data.data[j] * 0.3 + layer.data.data[j + 1] * 0.59 + layer.data.data[j + 2] * 0.11
        if (brightness > 28) {
          const shade = Math.round(14 + brightness * 0.2)
          sprite.data.data[i] = shade; sprite.data.data[i + 1] = shade; sprite.data.data[i + 2] = shade + 6
        }
      }
    }
  }
  const tone = [...(m.skinTones[look.skin ?? ""] ?? m.skinTones[DEFAULT_LOOK.skin!])].reverse()
  const swap = new Map<number, number[]>()
  b.skin.forEach((hex, i) => {
    const [r, g, bl] = rgb(hex)
    swap.set((r << 16) | (g << 8) | bl, rgb(tone[Math.min(tone.length - 1, Math.floor((i * tone.length) / b.skin.length))]))
  })
  const d = sprite.data.data
  const clothing = new Uint8Array(body.width * body.height)
  const outfitColors = new Map<number, number[]>()
  for (const [from, to] of Object.entries(o.palette ?? {})) {
    const [r, g, b] = rgb(from)
    outfitColors.set((r << 16) | (g << 8) | b, rgb(to))
  }
  // Limit scalp repairs to the head's connected silhouette on each row.
  // A raised hand can share the same skin colors and height as the face.
  const headRows = new Map<number, [number, number]>()
  for (let y = Math.max(0, o.head[1]); y < Math.min(body.height, o.head[1] + 17); y++) {
    const cx = o.head[0]
    if (!d[(y * body.width + cx) * 4 + 3]) continue
    let left = cx, right = cx
    while (left > Math.max(0, cx - 16) && d[(y * body.width + left - 1) * 4 + 3]) left--
    while (right < Math.min(body.width - 1, cx + 16) && d[(y * body.width + right + 1) * 4 + 3]) right++
    headRows.set(y, [left, right])
  }
  const scalp: Point[] = []
  for (let i = 0; i < d.length; i += 4) {
    // Bare legs already use the selected skin tone. Bottoms colors and
    // outfit palettes must never recolor their remaining highlight pixels.
    if (bareLegMask[i / 4]) continue
    const to = d[i + 3] ? swap.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]) : undefined
    if (to) {
      const x = (i / 4) % body.width, y = Math.floor(i / 4 / body.width)
      const dy = y - o.head[1], dx = Math.abs(x - o.head[0])
      // Extracted hair layers can be narrower than an outfit's head. Cover
      // the crown and upper temples, keeping the forehead, face and ears clear.
      const row = headRows.get(y)
      if (row && x >= row[0] && x <= row[1] && (dy < 6 || (dy < 11 && dx >= 11))) scalp.push([x, y])
      ;[d[i], d[i + 1], d[i + 2]] = to
    } else if (d[i + 3]) {
      const x = (i / 4) % body.width, y = Math.floor(i / 4 / body.width)
      // Eye, eyebrow and ear shades can share exact colors with an outfit.
      // Clothing palettes must never recolor facial details or hand outlines.
      if (y < o.head[1] + 29) continue
      clothing[i / 4] = 1
      const brightness = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]
      const section = y >= body.height - 10 ? look.shoeColor : athleticMask[i / 4] || y >= o.head[1] + 61 ? look.pantsColor : y >= o.head[1] + 29 ? (Math.abs(x - o.head[0]) > 9 ? look.sleeveColor ?? look.topColor : look.topColor) : undefined
      if (section && brightness > 28) {
        const shade = 0.35 + 0.65 * brightness / 255
        const color = rgb(section).map((v) => Math.round(v * shade))
        ;[d[i], d[i + 1], d[i + 2]] = color
        continue
      }
      const color = athleticMask[i / 4] ? undefined : outfitColors.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2])
      if (color) {
        const x = (i / 4) % body.width, y = Math.floor(i / 4 / body.width)
        if (o.sleeveColor && Math.abs(x - o.head[0]) > 9 && y < o.head[1] + 57) {
          const shade = Math.min(1, (d[i] + d[i + 1] + d[i + 2]) / 145)
          const sleeve = rgb(o.sleeveColor).map((v) => Math.round(v * shade))
          ;[d[i], d[i + 1], d[i + 2]] = sleeve
        } else [d[i], d[i + 1], d[i + 2]] = color
      }
    }
  }
  // Pixel graphics follow each pose's head anchor and only paint clothing,
  // keeping a seated forearm or hand in front of the shirt print.
  const designs = {
    uf: ["#.#.###", "#.#.#..", "#.#.##.", "#.#.#..", "###.#.."],
    star: ["...#...", "..###..", "#######", ".#####.", "..###..", ".#...#."],
    letter: ["#...#", "#...#", "#...#", "#...#", ".###."],
    tour: ["#########", ".........", "....##...", "...##....", "..#####..", "....##...", "...##....", ".........", "#.#.#.#.#"],
    gull: ["##.....##", ".##...##.", "..##.##..", "...###...", "....#...."],
    sunset: ["...###...", "..#####..", "..#####..", ".........", "###...###", "...###...", "###...###"],
    checker: ["##..##..", "##..##..", "..##..##", "..##..##", "##..##..", "##..##.."],
  }
  const graphics = look.graphic === "none" ? [] : look.graphic && look.graphic !== "default"
    ? [{ offset: [-2, 38] as Point, rows: designs[look.graphic], color: "#F4E5C9" }]
    : o.graphics ?? []
  for (const graphic of graphics) {
    const color = rgb(look.graphicColor ?? graphic.color)
    graphic.rows.forEach((row, dy) => [...row].forEach((pixel, dx) => {
      if (pixel !== "#") return
      const x = o.head[0] + graphic.offset[0] + dx, y = o.head[1] + graphic.offset[1] + dy
      if (x < 0 || x >= body.width || y < 0 || y >= body.height) return
      const index = y * body.width + x
      if (!clothing[index]) return
      const i = index * 4
      ;[d[i], d[i + 1], d[i + 2]] = color
    }))
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
    for (const [x, y] of scalp) {
      const lx = x - hx, ly = y - hy
      if (lx >= 0 && lx < hp.c.width && ly >= 0 && ly < hp.c.height && hd[(ly * hp.c.width + lx) * 4 + 3]) continue
      // Extend the closest strand's shade rather than adding a flat cap.
      let nearest = Infinity
      let color = t.map((v) => Math.round(v * 0.55))
      for (let py = 0; py < hp.c.height; py++) {
        for (let px = 0; px < hp.c.width; px++) {
          const i = (py * hp.c.width + px) * 4
          const distance = (px - lx) ** 2 + (py - ly) ** 2
          if (hd[i + 3] && distance < nearest) {
            nearest = distance
            color = [hd[i], hd[i + 1], hd[i + 2]]
          }
        }
      }
      sprite.ctx.fillStyle = `rgb(${color.join(",")})`
      sprite.ctx.fillRect(x, y, 1, 1)
    }

  }

  const w = body.width
  const padX = Math.max(3, hairCanvas ? Math.max(0, -hx, hx + hairCanvas.width - w) : 0)
  const padTop = hairCanvas ? Math.max(0, -hy) : 0
  const out = document.createElement("canvas")
  out.width = w + padX * 2
  out.height = body.height + padTop
  const ctx = out.getContext("2d")!
  ctx.drawImage(sprite.c, padX, padTop)
  if (hairCanvas) ctx.drawImage(hairCanvas, padX + hx, padTop + hy)
  return { canvas: out, url: out.toDataURL(), width: out.width, height: out.height, head: [padX + o.head[0], padTop + o.head[1]] }
}

// Composed sprite for a look and view, cached by type/outfit/view/skin/hair/hairColor (least recently used dropped past 200).
// Rejects if art is missing.
export async function leadSprite(look: Look, view: LeadView = "front"): Promise<LeadSprite> {
  const m = await loadLead()
  const l = normalizeLook(look, m)
  const key = leadKey(l, view)
  let p = sprites.get(key)
  if (p) {
    sprites.delete(key)
  } else {
    p = compose(m, l, view)
    p.catch(() => sprites.delete(key))
  }
  sprites.set(key, p)
  if (sprites.size > MAX_SPRITES) sprites.delete(sprites.keys().next().value!)
  return p
}

// React hook. `sprite` is null until the first compose, then keeps the previous sprite while a new look composes
// or if it fails (no flicker). `failed` means the current look's art could not load.
export function useLeadSprite(look: Look | null, view: LeadView = "front") {
  const l = look ?? DEFAULT_LOOK
  const key = leadKey(l, view)
  const [state, setState] = useState<{ sprite: LeadSprite | null; failed: boolean }>({ sprite: null, failed: false })
  useEffect(() => {
    let live = true
    leadSprite(l, view).then(
      (sprite) => live && setState({ sprite, failed: false }),
      () => live && setState((s) => ({ sprite: s.sprite, failed: true })),
    )
    return () => {
      live = false
    }
  }, [key])
  return state
}
