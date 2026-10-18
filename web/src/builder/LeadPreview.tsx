import type { CSSProperties } from "react"
import type { Look } from "@agentsquad/shared"
import { useLeadSprite, type LeadView } from "../ui/lead"

type Props = { look: Look; scale: number; view?: LeadView; className?: string }

// The composed lead (outfit + skin + hair, or a character), drawn pixelated at a whole-number scale.
// The box is the sprite's size, anchored at the feet (bottom center).
export default function LeadPreview({ look, scale, view = "front", className = "" }: Props) {
  const { sprite, failed } = useLeadSprite(look, view)
  if (failed && !sprite) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg bg-accent-soft text-[11px] font-semibold text-accent ${className}`}
        style={{ height: 96 * scale, width: 38 * scale }}
        title={`missing lead art: ${look.body} ${look.outfit} ${view}`}
      >
        Lead
      </div>
    )
  }
  if (!sprite) return <div className={className} style={{ height: 96 * scale, width: 38 * scale }} />
  return (
    <img
      src={sprite.url}
      alt="Lead"
      draggable={false}
      className={`pixelated block max-w-none ${className}`}
      style={{ width: sprite.width * scale, height: sprite.height * scale }}
    />
  )
}

type HeadProps = { look: Look; scale: number; top?: number; className?: string; style?: CSSProperties }

// Head crop of the composed front view: the head's top-center sits `top` sprite pixels below the frame's top center. Position the frame (relative or absolute) via className.
export function LeadHead({ look, scale, top = 3, className = "", style }: HeadProps) {
  const { sprite } = useLeadSprite(look, "front")
  return (
    <div className={`overflow-hidden ${className}`} style={style}>
      {sprite && (
        <img
          src={sprite.url}
          alt=""
          draggable={false}
          className="pixelated absolute max-w-none"
          style={{
            width: sprite.width * scale,
            height: sprite.height * scale,
            left: `calc(50% - ${sprite.head[0] * scale}px)`,
            // Tall styles (puffs, buns, afros) extend above the scalp anchor.
            // Keep the whole hair layer inside the crop instead of cutting it off.
            top: Math.max(0, top - sprite.head[1]) * scale,
          }}
        />
      )}
    </div>
  )
}
