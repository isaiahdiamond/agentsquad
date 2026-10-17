import { useState } from "react"

type Props = {
  src: string
  label: string
  color?: string
  className?: string
  pixelated?: boolean
}

// Every art file may be missing until the Art stream delivers it. Draw a labeled box instead.
// Big scene art is shown smaller than it was drawn, so it scales smoothly; pass `pixelated` for sprites at integer scale.
export default function ArtImage({ src, label, color = "#334155", className = "", pixelated = false }: Props) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-[10px] border border-line text-center text-xs font-medium text-white/80 ${className}`}
        style={{ background: color }}
        title={`missing art: ${src}`}
      >
        {label}
      </div>
    )
  }
  return <img src={src} alt={label} className={`${pixelated ? "pixelated " : ""}${className}`} onError={() => setFailed(true)} draggable={false} />
}
