import { useEffect, useState } from "react"
import type { Look } from "@agentsquad/shared"

// Shape of web/public/art/sprites.json, written by tools/fetch_art.py. See vault/Art Pack.md.
export type SpriteView = "front" | "back" | "hand"
export type SpriteSet = Record<SpriteView, string> & { sit?: string[] }

export type SpriteManifest = {
  height: number
  lead: { bodies: string[]; outfits: string[]; looks: Record<string, SpriteSet> }
  team: Record<string, SpriteSet>
  desks: Record<string, string>
  scenes: Record<string, string>
}

let manifestPromise: Promise<SpriteManifest> | null = null

export function loadSprites(): Promise<SpriteManifest> {
  manifestPromise ??= fetch("/art/sprites.json")
    .then((r) => {
      if (!r.ok) throw new Error(`sprites.json: ${r.status}`)
      return r.json() as Promise<SpriteManifest>
    })
    .catch((err) => {
      manifestPromise = null
      throw err
    })
  return manifestPromise
}

export function useSprites() {
  const [sprites, setSprites] = useState<SpriteManifest | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    loadSprites().then(
      (m) => live && setSprites(m),
      (err) => live && setError(String(err)),
    )
    return () => {
      live = false
    }
  }, [])
  return { sprites, error }
}

export const DEFAULT_LEAD_LOOK: Look = { body: "a", hair: "none", hairColor: "#000000", outfit: "blazer", hat: "none" }

// Lead looks are full variants named lead-<body>-<outfit>.
export function leadSpriteKey(look: Look | null) {
  const l = look ?? DEFAULT_LEAD_LOOK
  return `lead-${l.body}-${l.outfit}`
}

// Sprite set for a roster id or the lead. Null when the art doesn't have it: callers draw their fallback.
export function spriteSet(m: SpriteManifest | null, agentType: string, look: Look | null = null): SpriteSet | null {
  if (!m) return null
  if (agentType === "lead") return m.lead.looks[leadSpriteKey(look)] ?? null
  return m.team[agentType] ?? null
}
