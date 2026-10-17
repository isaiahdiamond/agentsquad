import type { Scene, Spot } from "@agentsquad/shared"

const W = 1600
const H = 900

function Dot({ s, label, color }: { s: Spot; label: string; color: string }) {
  return (
    <g>
      <circle cx={s.x * W} cy={s.y * H} r={8} fill={color} stroke="#000" strokeWidth={3} />
      <text x={s.x * W + 12} y={s.y * H - 10} fontSize={14} fontFamily="monospace" fill="#fff" stroke="#000" strokeWidth={4} paintOrder="stroke">
        {label} ({s.x.toFixed(2)}, {s.y.toFixed(2)}, {s.scale})
      </text>
    </g>
  )
}

// Press D: every spot in the scene, labeled, so coordinates can be tuned against the art.
export default function Debug({ scene }: { scene: Scene }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 z-[500] h-full w-full">
      <rect width={W} height={H} fill="none" stroke="#f0f" strokeWidth={4} />
      {(scene.paths ?? []).map((p, i) => (
        <g key={i}>
          <polyline points={p.map((s) => `${s.x * W},${s.y * H}`).join(" ")} fill="none" stroke="#38bdf8" strokeWidth={3} />
          {p.map((s, j) => <circle key={j} cx={s.x * W} cy={s.y * H} r={5} fill="#38bdf8" />)}
          <text x={p[1]?.x * W} y={p[1]?.y * H + 22} fontSize={13} fontFamily="monospace" fill="#38bdf8" stroke="#000" strokeWidth={3} paintOrder="stroke">
            path[{i}] → {scene.buildings?.[i]?.id ?? "?"}
          </text>
        </g>
      ))}
      {(scene.buildings ?? []).map((b) => (
        <g key={b.id}>
          <rect x={b.area.x * W} y={b.area.y * H} width={b.area.w * W} height={b.area.h * H} fill="#f0f" fillOpacity={0.08} stroke="#f0f" strokeWidth={3} strokeDasharray="10 6" />
          <text x={b.area.x * W + 8} y={b.area.y * H + 20} fontSize={14} fontFamily="monospace" fill="#f0f" stroke="#000" strokeWidth={4} paintOrder="stroke">
            {b.id} → {b.interior} [{b.roles.join(", ")}]
          </text>
          <Dot s={b.door} label={`${b.id}.door`} color="#22c55e" />
          <Dot s={b.badge} label={`${b.id}.badge`} color="#eab308" />
        </g>
      ))}
      <Dot s={scene.lead} label="lead" color="#f5c542" />
      <Dot s={scene.bench} label="bench" color="#94a3b8" />
      {scene.stations.map((s, i) => <Dot key={i} s={s} label={`station[${i}]`} color="#f97316" />)}
      <text x={12} y={H - 14} fontSize={16} fontFamily="monospace" fill="#fff" stroke="#000" strokeWidth={4} paintOrder="stroke">
        DEBUG {scene.id} ({scene.kind}) bg={scene.background}  press D to hide
      </text>
    </svg>
  )
}
