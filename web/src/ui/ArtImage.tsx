import { useState } from "react"

type Props = {
  src: string
  label: string
  color?: string
  className?: string
}

// Every art file may be missing until the Art stream delivers it. Draw a labeled box instead.
export default function ArtImage({ src, label, color = "#334155", className = "" }: Props) {
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
  return <img src={src} alt={label} className={`pixelated ${className}`} onError={() => setFailed(true)} draggable={false} />
}
