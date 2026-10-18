import { motion, useReducedMotion } from "framer-motion"
import { W, H } from "./Sprite"
import { GUESTS, type Guest } from "./club-navigation"
import { usePartyArt, type PartyArt } from "./party-art"

function guestRole(g: Guest) {
  return g.mode === "sit" ? g.x > .7 ? "stool" : g.y < .4 ? "cabana" : "recliner" : g.mode
}
// Cycle appearances within each activity, rather than reusing the same two
// women for almost every chair and swimmer.
const variations = new Map<string, number>()
const PARTY_GUESTS = GUESTS.map(guest => {
  const key = `${guestRole(guest)}:${!!guest.female}`
  const variant = variations.get(key) ?? 0
  variations.set(key, variant + 1)
  return { guest, variant }
})
function frameFor(g: Guest, variant: number, art: PartyArt) {
  const role = guestRole(g)
  if (role === "swim") return art.natural[(g.female ? 4 : 16) + variant % 4]
  if (role === "stool") return art.natural[8 + (g.female ? 0 : 1) + 2 * (variant % 2)]
  if (role === "cabana") return art.candid[4 + (g.female ? 0 : 1) + 2 * (variant % 2)]
  // Lie back along the lounger with the head turned toward the water.
  if (role === "recliner") return art.reclining[g.female ? 0 : 1]
  if (role === "bar") return art.staff[g.female ? 1 : 0]
  if (role === "float") return art.base[(g.female ? 4 : 5) + 2 * (variant % 2)]
  if (role === "dance") return g.female ? art.natural[variant % 4] : art.base[1 + 2 * (variant % 2)]
  if (role === "lounge") return art.candid[(g.female ? 0 : 1) + 2 * (variant % 2)]
  return art.base[9]
}
function PartyGuest({ guest: g, variant, index, chatting, frames }: { guest: Guest; variant: number; index: number; chatting: boolean; frames: PartyArt }) {
  const reduced = useReducedMotion()
  const frame = frameFor(g, variant, frames)
  const role = guestRole(g)
  const swimming = role === "swim", seated = g.mode === "sit" || g.mode === "float"
  const dancing = g.mode === "dance"
  const height = swimming ? 52 : role === "recliner" ? 88 : role === "cabana" ? 122 : role === "stool" ? 122 : seated ? 105 : g.mode === "bar" ? 112 : 150
  const width = height * frame.width / frame.height
  const visibleHeight = height
  const sway = index % 2 ? -1 : 1
  // Rear-view bar patrons face the counter; cabana sofas look out at the pool.
  // Standing pairs turn toward each other, while swimmers face both ways.
  const seatFacesLeft = !g.female && variant % 2 === 1
  const flip = swimming ? variant % 2 === 0
    : role === "stool" ? false
    : role === "cabana" ? seatFacesLeft
    : role === "lounge" ? variant % 2 === 1 : false
  return <div aria-hidden="true" className="pointer-events-none absolute" style={{ left: g.x * W, top: g.y * H, zIndex: Math.round(g.y * H) }}>
    {!swimming && !seated && g.mode !== "bar" && <div className="absolute rounded-[50%] bg-[#6b5032]/20 blur-[2px]" style={{ width: 35, height: 8, left: -17.5, top: -4 }} />}
    {swimming && <motion.svg className="absolute" style={{ width: 80, height: 25, left: -40, top: -12 }} viewBox="0 0 80 25"
      animate={reduced ? {} : { scale: [1,1.18,1], opacity: [.35,.7,.35] }} transition={{ duration: 3.5, repeat: Infinity, delay: index * .17 }}>
      <ellipse cx="40" cy="12" rx="35" ry="8" fill="#20c6d5" fillOpacity=".2" stroke="#c7f9ef" strokeOpacity=".65" strokeWidth="1.5" />
      <path d="M13 17q27 11 54 0" fill="none" stroke="#fff" strokeOpacity=".35" />
    </motion.svg>}
    <div style={{ position: "absolute", bottom: 0, left: -width * (role === "recliner" ? .8 : .5), width, height: visibleHeight, transform: flip ? "scaleX(-1)" : undefined, overflow: swimming ? "hidden" : undefined, maskImage: swimming ? "linear-gradient(to bottom,black 75%,transparent 100%)" : undefined }}>
      <motion.img src={frame.url} alt="" draggable={false} className="block max-w-none select-none"
        style={{ width, height, transformOrigin: "50% 90%", imageRendering: "auto", maskImage: g.mode === "bar" ? "linear-gradient(to bottom,black 90%,transparent 100%)" : undefined, clipPath: g.mode === "dj" ? "inset(0 0 40% 0)" : undefined, filter: "saturate(.9)" }}
        animate={reduced ? {} : dancing ? {
          x: [0,3*sway,-3*sway,0], y: [0,-2,0,-3,0], rotate: [0,3*sway,-2*sway,0],
        } : g.mode === "bar" ? { y: [0,-.35,0] }
          : g.mode === "float" ? { y: [-1.5,1.5,-1.5], rotate: [-1,1,-1] }
          : swimming ? { y: [0,1,0], rotate: [-.3,.3,-.3] }
          : { y: [0,-.5,0] }}
        transition={{ duration: dancing ? 2.4 + index % 3 * .2 : g.mode === "bar" ? 6.2 : 4, repeat: Infinity, delay: index * .07, ease: "easeInOut" }} />
    </div>
    {g.mode === "sit" && chatting && <motion.div className="absolute rounded-xl bg-[#fff2d6]/90 px-3 py-1 text-[18px] text-[#493729]" style={{ left: 20, bottom: height - 4 }} animate={reduced ? {} : { opacity: [0,1,1,0] }} transition={{ duration: 4, repeat: Infinity, delay: index * .4 }}>•••</motion.div>}
  </div>
}
export default function ClubParty({ chatting, background }: { chatting: boolean; background: string }) {
  const reduced = useReducedMotion()
  const frames = usePartyArt()
  return <>
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${W} ${H}`}>
      {[0,1,2].map(i => <motion.path key={i} d={`M${W*(.44+i*.055)} ${H*.14} l-100 330 h250 Z`} fill={["#80e4ed","#ffce6f","#f29bc8"][i]} style={{ mixBlendMode: "screen", transformOrigin: "50% 20%" }} animate={reduced ? { opacity: .06 } : { opacity: [.03,.15,.03], rotate: [-5,5,-5] }} transition={{ duration: 4+i, repeat: Infinity }} />)}
    </svg>
    {/* Repaint the actual counter and front post above staff, below patrons.
        Moving a sprite upward alone cannot put it behind painted furniture. */}
    <img src={background} alt="" draggable={false} className="pixelated pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: Math.max(...GUESTS.filter(g=>g.mode === "bar").map(g=>Math.round(g.y*H))) + 1, clipPath: "polygon(67.5% 40.9%,86.5% 48.5%,91% 44.7%,94.5% 44.5%,95% 46.4%,86.5% 55.1%,67.5% 45.6%)" }} />
    <img src={background} alt="" draggable={false} className="pixelated pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: Math.max(...GUESTS.filter(g=>g.mode === "bar").map(g=>Math.round(g.y*H))) + 1, clipPath: "polygon(86.1% 36%,87% 36%,87% 49.7%,86.1% 49.7%)" }} />
    {frames && PARTY_GUESTS.map(({guest,variant},index)=><PartyGuest key={index} guest={guest} variant={variant} index={index} chatting={chatting} frames={frames} />)}
  </>
}
