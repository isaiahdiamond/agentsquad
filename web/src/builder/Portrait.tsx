import { useState } from "react"
import type { Character } from "@agentsquad/shared"

type Props = { c: Pick<Character, "name" | "color" | "portrait">; scale?: number; top?: number; className?: string }

const SPRITE_HEIGHT = 96

// Head-and-shoulders crop of the front sprite: drawn at a whole-number scale from the top, the frame clips the rest.
export default function Portrait({ c, scale = 3, top = 2, className = "" }: Props) {
  const [failed, setFailed] = useState("")
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{ background: `radial-gradient(circle at 50% 35%, ${c.color}, color-mix(in srgb, ${c.color} 70%, black))` }}
      title={failed === c.portrait ? `missing art: ${c.portrait}` : undefined}
    >
      {!c.portrait || failed === c.portrait ? (
        <span className="text-[11px] font-semibold text-white">{c.name.replace(" Agent", "")}</span>
      ) : (
        <img
          src={c.portrait}
          alt={c.name}
          draggable={false}
          onError={() => setFailed(c.portrait)}
          className="pixelated absolute left-1/2 max-w-none -translate-x-1/2"
          style={{ top: scale * top, height: scale * SPRITE_HEIGHT }}
        />
      )}
    </div>
  )
}
