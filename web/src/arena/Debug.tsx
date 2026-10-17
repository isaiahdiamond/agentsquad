import type { Scene, Spot } from "@agentsquad/shared"
import { sceneScale } from "./MapView"
import { deskScale, deskSpots, seatLift, useDesk } from "./RoomView"
import { H, TALL, W } from "./Sprite"

const F = 24
const label = { fontFamily: "Inter, sans-serif", fontWeight: 600, stroke: "#0b0d12", strokeLinejoin: "round" as const, paintOrder: "stroke" }

function Dot({ s, text, color }: { s: Spot; text: string; color: string }) {
  return (
    <g>
      <circle cx={s.x * W} cy={s.y * H} r={11} fill={color} stroke="#0b0d12" strokeWidth={5} />
      <text x={s.x * W + 18} y={s.y * H - 16} fontSize={F} fill="#fff" strokeWidth={6} {...label}>
        {text} ({s.x.toFixed(3)}, {s.y.toFixed(3)})
      </text>
    </g>
  )
}

// Press D: every spot in the scene, labeled, in native pixels, so coordinates can be tuned against the art.
// Rooms also show each desk's footprint, the seat point, and a standing-height ruler at the lead.
export default function Debug({ scene }: { scene: Scene }) {
  const s = sceneScale(scene)
  const desk = useDesk(scene.id).size ?? { w: 62, h: 52 }
  const tall = TALL * s
  const ds = deskScale(s, desk)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 z-[9000] h-full w-full">
      <rect width={W} height={H} fill="none" stroke="#5a8fe6" strokeWidth={6} />
      {(scene.paths ?? []).map((p, i) => (
        <g key={i}>
          <polyline points={p.map((q) => `${q.x * W},${q.y * H}`).join(" ")} fill="none" stroke="#38bdf8" strokeWidth={5} />
          {p.map((q, j) => (
            <g key={j}>
              <circle cx={q.x * W} cy={q.y * H} r={8} fill="#38bdf8" />
              <text x={q.x * W + 12} y={q.y * H + 7} fontSize={18} fill="#bae6fd" strokeWidth={5} {...label}>{j}</text>
            </g>
          ))}
          <text x={p[1]?.x * W} y={p[1]?.y * H + 36} fontSize={22} fill="#38bdf8" strokeWidth={6} {...label}>
            path[{i}] → {scene.buildings?.[i]?.id ?? "?"}
          </text>
        </g>
      ))}
      {(scene.buildings ?? []).map((b) => (
        <g key={b.id}>
          <rect x={b.area.x * W} y={b.area.y * H} width={b.area.w * W} height={b.area.h * H} fill="#5a8fe6" fillOpacity={0.08} stroke="#5a8fe6" strokeWidth={3} strokeDasharray="16 10" rx={26} />
          <text x={b.area.x * W + 14} y={b.area.y * H + 34} fontSize={F} fill="#5a8fe6" strokeWidth={6} {...label}>
            {b.id} → {b.interior} [{b.roles.join(", ")}]
          </text>
          <Dot s={b.door} text={`${b.id}.door`} color="#22c55e" />
          <Dot s={b.badge} text={`${b.id}.badge`} color="#eab308" />
        </g>
      ))}
      {deskSpots(scene).map((d, i) => {
        const x = d.x * W, y = d.y * H, w = desk.w * ds, h = desk.h * ds
        const seatY = y - seatLift(s, desk)
        return (
          <g key={i}>
            <rect x={x - w / 2} y={y - h} width={w} height={h} fill="#f97316" fillOpacity={0.12} stroke="#f97316" strokeWidth={3} strokeDasharray="10 6" />
            <line x1={x - w / 2} x2={x + w / 2} y1={seatY} y2={seatY} stroke="#f472b6" strokeWidth={3} />
          </g>
        )
      })}
      <g>
        <line x1={scene.lead.x * W - 40} x2={scene.lead.x * W - 40} y1={scene.lead.y * H} y2={scene.lead.y * H - tall} stroke="#a3e635" strokeWidth={5} />
        <text x={scene.lead.x * W - 52} y={scene.lead.y * H - tall / 2} fontSize={F} fill="#a3e635" textAnchor="end" strokeWidth={6} {...label}>
          standing {Math.round(tall)}px = {((tall / H) * 100).toFixed(1)}%
        </text>
      </g>
      <Dot s={scene.lead} text={scene.lead.kind === "desk" ? "lead (desk)" : "lead"} color="#f5c542" />
      <Dot s={scene.bench} text="bench" color="#94a3b8" />
      {scene.stations.map((st, i) => <Dot key={i} s={st} text={`station[${i}]${st.kind === "desk" ? " desk" : ""}`} color="#f97316" />)}
      <text x={20} y={H - 24} fontSize={28} fill="#fff" strokeWidth={7} {...label}>
        DEBUG {scene.id} ({scene.kind}) scale={s} stage={W}x{H} desk={ds.toFixed(2)}x  press D to hide
      </text>
    </svg>
  )
}
