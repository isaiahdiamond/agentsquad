import type { Character } from "@agentsquad/shared"
import ArtImage from "../ui/ArtImage"

export default function Portrait({ c, className = "" }: { c: Character; className?: string }) {
  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{ background: `repeating-linear-gradient(135deg, ${c.color}, ${c.color} 6px, ${c.color}dd 6px, ${c.color}dd 12px)` }}
    >
      <ArtImage src={c.portrait} label={c.name.replace(" Agent", "")} color="transparent" className="h-full w-full object-contain" />
    </div>
  )
}
