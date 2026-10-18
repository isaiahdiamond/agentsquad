import { useEffect, useState } from "react"

export const PARTY_ART = "/art/scenes/club-party-guests.png"
export const NATURAL_PARTY_ART = "/art/scenes/club-party-natural-guests.png"
export type PartyFrame = { url: string; width: number; height: number }
// The artist's seated row is shorter than the standing rows. Explicit row
// boundaries keep every person intact instead of cutting into legs or hair.
const ROWS = [[0, 402 / 1086], [405 / 1086, 688 / 1086], [688 / 1086, 1]]
export function extractPartyArt(image: HTMLImageElement, rows = ROWS, isolate = false, columns = 4): PartyFrame[] {
  return rows.flatMap(([top, bottom]) => Array.from({ length: columns }, (_, column) => {
    // Reclining feet and swimmers' elbows extend across the nominal grid.
    // Overlap columns, then isolate the connected person instead of clipping.
    const margin = isolate ? Math.round(image.width / (columns * 4)) : 0
    const sx = Math.max(0, Math.round(image.width * column / columns) - margin), sy = Math.round(image.height * top)
    const width = Math.min(image.width, Math.round(image.width * (column + 1) / columns) + margin) - sx
    const height = Math.round(image.height * bottom) - sy
    const cell = document.createElement("canvas")
    cell.width = width; cell.height = height
    const ctx = cell.getContext("2d")!
    ctx.drawImage(image, sx, sy, width, height, 0, 0, width, height)
    const imageData = ctx.getImageData(0, 0, width, height)
    const pixels = imageData.data
    if (isolate) {
      // Rows overlap in the generated atlas. Keep the main connected person
      // in each cell so a neighboring row's hair or feet cannot leak in.
      const visited = new Uint8Array(width * height)
      let largest: number[] = []
      for (let start = 0; start < visited.length; start++) {
        if (visited[start] || pixels[start * 4 + 3] < 32) continue
        const connected = [start]
        visited[start] = 1
        for (let cursor = 0; cursor < connected.length; cursor++) {
          const at = connected[cursor], x = at % width, y = Math.floor(at / width)
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) continue
            const next = at + dx + dy * width
            if (visited[next] || pixels[next * 4 + 3] < 32) continue
            visited[next] = 1; connected.push(next)
          }
        }
        if (connected.length > largest.length) largest = connected
      }
      const keep = new Uint8Array(width * height)
      for (const at of largest) {
        const x = at % width, y = Math.floor(at / width)
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height) keep[at + dx + dy * width] = 1
        }
      }
      for (let i = 0; i < keep.length; i++) if (!keep[i]) pixels[i * 4 + 3] = 0
      ctx.putImageData(imageData, 0, 0)
    }
    let left = width, right = 0, first = height, last = 0
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] < 16) continue
      left = Math.min(left, x); right = Math.max(right, x + 1)
      first = Math.min(first, y); last = Math.max(last, y + 1)
    }
    if (right <= left || last <= first) throw new Error("Missing pool party guest artwork")
    const frame = document.createElement("canvas")
    frame.width = right - left; frame.height = last - first
    frame.getContext("2d")!.drawImage(cell, left, first, frame.width, frame.height, 0, 0, frame.width, frame.height)
    return { url: frame.toDataURL(), width: frame.width, height: frame.height }
  }))
}
export type PartyArt = { base: PartyFrame[]; natural: PartyFrame[]; relaxed: PartyFrame[]; staff: PartyFrame[]; candid: PartyFrame[]; reclining: PartyFrame[] }
export const NATURAL_ROWS = [[0, 458/1402], [458/1402, 665/1402], [650/1402, 1004/1402], [980/1402, 1240/1402], [1225/1402, 1]]
export const CANDID_ROWS = [[0, 440/1086], [440/1086, 804/1086], [790/1086, 1]]
let loading: Promise<PartyArt> | null = null
function loadSheet(src: string, rows: number[][], isolate = false, columns = 4) {
  return new Promise<PartyFrame[]>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      try { resolve(extractPartyArt(image, rows, isolate, columns)) } catch (error) { reject(error) }
    }
    image.onerror = () => reject(new Error(`Could not load pool party guests: ${src}`))
    image.src = src
  })
}
function loadPartyArt() {
  loading ??= Promise.all([loadSheet(PARTY_ART, ROWS), loadSheet(NATURAL_PARTY_ART, NATURAL_ROWS, true), loadSheet("/art/scenes/club-party-relaxed-guests.png", [[0,1]], true), loadSheet("/art/scenes/club-bartenders.png", [[0,1]], true, 2), loadSheet("/art/scenes/club-party-candid-guests.png", CANDID_ROWS, true), loadSheet("/art/scenes/club-pool-facing-recliners.png", [[0,1]], true, 2)])
    .then(([base, natural, relaxed, staff, candid, reclining]) => ({base, natural, relaxed, staff, candid, reclining}))
    .catch(error => { loading = null; throw error })
  return loading
}
export function usePartyArt() {
  const [frames, setFrames] = useState<PartyArt | null>(null)
  useEffect(() => {
    let alive = true
    loadPartyArt().then(value => { if (alive) setFrames(value) }, error => console.error(error))
    return () => { alive = false }
  }, [])
  return frames
}
