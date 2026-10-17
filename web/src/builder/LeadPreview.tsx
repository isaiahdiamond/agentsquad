import { useState } from "react"
import type { Look } from "@agentsquad/shared"
import { spriteSet, useSprites, type SpriteView } from "../ui/sprites"

type Props = {
  look: Look
  height: number          // max CSS height in px; the sprite is drawn at the largest whole-number scale that fits
  view?: SpriteView
  className?: string
}

// The lead's sprite variant (lead-<body>-<outfit>), drawn pixelated and anchored at the feet.
export default function LeadPreview({ look, height, view = "front", className = "" }: Props) {
  const { sprites, error } = useSprites()
  const [failed, setFailed] = useState("")
  const native = sprites?.height ?? 44
  const h = native * Math.max(1, Math.floor(height / native))
  const src = spriteSet(sprites, "lead", look)?.[view]

  if (!sprites && !error) return <div className={className} style={{ height: h }} />
  if (!src || failed === src) {
    return (
      <div
        className={`flex items-center justify-center border-2 border-black/60 bg-gold-600 font-pixel text-[10px] text-navy-950 ${className}`}
        style={{ height: h, width: h * 0.4 }}
        title={`missing art: lead-${look.body}-${look.outfit} ${view}`}
      >
        LEAD
      </div>
    )
  }
  return (
    <img
      src={src}
      alt="Lead"
      draggable={false}
      onError={() => setFailed(src)}
      className={`pixelated block max-w-none ${className}`}
      style={{ height: h }}
    />
  )
}
