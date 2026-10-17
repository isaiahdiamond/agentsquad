import type { Scene, Spot } from "@agentsquad/shared"

const W = 1600
const H = 900

function Dot({ s, label, color }: { s: Spot; label: string; color: string }) {
  return (
    <g>
      <circle cx={s.x * W} cy={s.y * H} r={7} fill={color} stroke="#0b0d12" strokeWidth={3} />
      <text x={s.x * W + 12} y={s.y * H - 10} fontSize={14} fontFamily="Inter, sans-serif" fontWeight={600} fill="#fff" stroke="#0b0d12" strokeWidth={4} strokeLinejoin="round" paintOrder="stroke">
        {label} ({s.x.toFixed(2)}, {s.y.toFixed(2)}, {s.scale})
      </text>
    </g>
  )
}

// Press D: every spot in the scene, labeled, so coordinates can be tuned against the art.
export default function Debug({ scene }: { scene: Scene }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 z-[500] h-full w-full">
      <rect width={W} height={H} fill="none" stroke="#5a8fe6" strokeWidth={4} />
      {(scene.paths ?? []).map((p, i) => (
        <g key={i}>
          <polyline points={p.map((s) => `${s.x * W},${s.y * H}`).join(" ")} fill="none" stroke="#38bdf8" strokeWidth={3} />
          {p.map((s, j) => (
            <g key={j}>
              <circle cx={s.x * W} cy={s.y * H} r={5} fill="#38bdf8" />
              <text x={s.x * W + 7} y={s.y * H + 4} fontSize={11} fontFamily="Inter, sans-serif" fontWeight={600} fill="#bae6fd" stroke="#0b0d12" strokeWidth={3} paintOrder="stroke">{j}</text>
            </g>
          ))}
          <text x={p[1]?.x * W} y={p[1]?.y * H + 22} fontSize={13} fontFamily="Inter, sans-serif" fontWeight={600} fill="#38bdf8" stroke="#0b0d12" strokeWidth={4} strokeLinejoin="round" paintOrder="stroke">
            path[{i}] → {scene.buildings?.[i]?.id ?? "?"}
          </text>
        </g>
      ))}
      {(scene.buildings ?? []).map((b) => (
        <g key={b.id}>
          <rect x={b.area.x * W} y={b.area.y * H} width={b.area.w * W} height={b.area.h * H} fill="#5a8fe6" fillOpacity={0.08} stroke="#5a8fe6" strokeWidth={2} strokeDasharray="10 6" rx={16} />
          <text x={b.area.x * W + 8} y={b.area.y * H + 20} fontSize={14} fontFamily="Inter, sans-serif" fontWeight={600} fill="#5a8fe6" stroke="#0b0d12" strokeWidth={4} strokeLinejoin="round" paintOrder="stroke">
            {b.id} → {b.interior} [{b.roles.join(", ")}]
          </text>
          <Dot s={b.door} label={`${b.id}.door`} color="#22c55e" />
          <Dot s={b.badge} label={`${b.id}.badge`} color="#eab308" />
        </g>
      ))}
      <Dot s={scene.lead} label="lead" color="#f5c542" />
      <Dot s={scene.bench} label="bench" color="#94a3b8" />
      {scene.stations.map((s, i) => <Dot key={i} s={s} label={`station[${i}]`} color="#f97316" />)}
      <text x={12} y={H - 14} fontSize={16} fontFamily="Inter, sans-serif" fontWeight={600} fill="#fff" stroke="#0b0d12" strokeWidth={4} strokeLinejoin="round" paintOrder="stroke">
        DEBUG {scene.id} ({scene.kind}) bg={scene.background}  press D to hide
      </text>
    </svg>
  )
}
