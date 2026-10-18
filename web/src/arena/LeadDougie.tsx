import { motion, useReducedMotion } from "framer-motion"
import { useLeadSprite } from "../ui/lead"
import type { Who } from "./store"

// Animate regions of the actual customized sprite, preserving its face,
// hair, skin tone and clothes rather than replacing it with a dance costume.
export default function LeadDougie({ who, s }: { who: Who; s: number }) {
  const { sprite } = useLeadSprite(who.look ?? null, "front")
  const reduced = useReducedMotion()
  if (!sprite) return null
  const { width: w, height: h, head: [hx, hy] } = sprite
  const shoulder = hy + 33, waist = hy + 62, split = hx + 3
  const transition = { duration: 2.4, repeat: Infinity, ease: "easeInOut" as const }
  const rect = (left: number, top: number, right: number, bottom: number) =>
    `inset(${top*s}px ${(w-right)*s}px ${(h-bottom)*s}px ${left*s}px)`
  const image = (clip: string) => <img src={sprite.url} alt="" draggable={false} className="pixelated absolute inset-0 h-full w-full max-w-none" style={{ clipPath: clip }} />
  const still = !!reduced
  return <div aria-hidden="true" className="absolute bottom-0 left-1/2" style={{ width: w*s, height: h*s, marginLeft: -w*s/2 }}>
    <motion.div className="absolute inset-0" style={{ transformOrigin: `${split*s}px ${waist*s}px` }} animate={still ? {} : { x: [0,-2*s,0,2*s,0], rotate: [0,3,0,-3,0], scaleY: [1,.97,1,.97,1] }} transition={transition}>
      {image(`polygon(${(hx-7)*s}px ${waist*s}px,${(hx+12)*s}px ${waist*s}px,${(hx+12)*s}px ${(hy+65)*s}px,${w*s}px ${(hy+65)*s}px,${w*s}px ${h*s}px,0 ${h*s}px,0 ${(hy+65)*s}px,${(hx-7)*s}px ${(hy+65)*s}px)`)}
    </motion.div>
    <motion.div className="absolute inset-0" style={{ transformOrigin: `${split*s}px ${(hy+56)*s}px` }} animate={still ? {} : { x: [0,-2*s,0,2*s,0], y: [0,s,0,s,0], rotate: [-3,-8,3,8,-3] }} transition={transition}>
      {image(`polygon(0 0,100% 0,100% ${(hy+28)*s}px,${(hx+12)*s}px ${(hy+28)*s}px,${(hx+12)*s}px ${waist*s}px,${(hx-7)*s}px ${waist*s}px,${(hx-7)*s}px ${(hy+28)*s}px,0 ${(hy+28)*s}px)`)}
      <motion.div className="absolute inset-0" style={{ transformOrigin: `${(hx-9)*s}px ${shoulder*s}px` }} animate={still ? {} : { rotate: [0,-125,-85,0,0], x: [0,s,0,0,0] }} transition={transition}>
        {image(rect(0,hy+28,hx-7,Math.min(h,hy+65)))}
      </motion.div>
      <motion.div className="absolute inset-0" style={{ transformOrigin: `${(hx+12)*s}px ${shoulder*s}px` }} animate={still ? {} : { rotate: [0,0,0,125,0], x: [0,0,0,-s,0] }} transition={transition}>
        {image(rect(hx+12,hy+28,w,Math.min(h,hy+65)))}
      </motion.div>
    </motion.div>
  </div>
}
