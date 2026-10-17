import { useState } from "react"
import type { Character } from "@agentsquad/shared"

type Props = { c: Pick<Character, "name" | "color" | "portrait">; scale?: number; className?: string }

// Head-and-shoulders crop of the front sprite: drawn at a whole-number scale from the top, the frame clips the rest.
export default function Portrait({ c, scale = 6, className = "" }: Props) {
  const [failed, setFailed] = useState("")
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{ background: `repeating-linear-gradient(135deg, ${c.color}, ${c.color} 6px, ${c.color}dd 6px, ${c.color}dd 12px)` }}
      title={failed === c.portrait ? `missing art: ${c.portrait}` : undefined}
    >
      {!c.portrait || failed === c.portrait ? (
        <span className="font-pixel text-[10px] text-white">{c.name.replace(" Agent", "").toUpperCase()}</span>
      ) : (
        <img
          src={c.portrait}
          alt={c.name}
          draggable={false}
          onError={() => setFailed(c.portrait)}
          className="pixelated absolute left-1/2 max-w-none -translate-x-1/2"
          style={{ top: scale * 2, height: scale * 44 }}
        />
      )}
    </div>
  )
}
