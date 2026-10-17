import type { Scene } from "@agentsquad/shared"
import { useImage } from "./Sprite"

const W = 1600
const H = 900

// The scene image at native size: it is the stage.
// Without the image it draws the scene in code so the arena never looks broken.
export default function Backdrop({ scene }: { scene: Scene }) {
  const ok = useImage(scene.background)
  if (ok) return <img src={scene.background} alt={scene.name} draggable={false} className="pixelated absolute inset-0 h-full w-full select-none" />
  if (ok === undefined) return <div className="absolute inset-0 bg-bg" />
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" shapeRendering="crispEdges">
      {scene.kind === "map" ? <MapArt scene={scene} /> : <RoomArt scene={scene} />}
    </svg>
  )
}

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
}

function MapArt({ scene }: { scene: Scene }) {
  const buildings = scene.buildings ?? []
  const r = rng(7)
  const trees: { x: number; y: number; s: number }[] = []
  for (let i = 0; trees.length < 34 && i < 400; i++) {
    const x = r(), y = r(), s = 0.7 + r() * 0.6
    const inBuilding = buildings.some((b) => x > b.area.x - 0.03 && x < b.area.x + b.area.w + 0.03 && y > b.area.y - 0.05 && y < b.area.y + b.area.h + 0.08)
    const nearLead = Math.hypot(x - scene.lead.x, (y - scene.lead.y) * 0.56) < 0.08
    const inPond = Math.hypot((x - 0.08) / 0.2, (y - 0.95) / 0.22) < 1
    const nearPath = (scene.paths ?? []).some((p) => p.some((s2, j) => {
      const n = p[j + 1]
      if (!n) return false
      for (let t = 0; t <= 1; t += 0.1) if (Math.hypot(x - (s2.x + (n.x - s2.x) * t), (y - (s2.y + (n.y - s2.y) * t)) * 0.56) < 0.035) return true
      return false
    }))
    if (!inBuilding && !nearLead && !inPond && !nearPath) trees.push({ x, y, s })
  }
  trees.sort((a, b) => a.y - b.y)
  return (
    <g>
      <defs>
        <pattern id="grass" width="32" height="32" patternUnits="userSpaceOnUse">
          <rect width="32" height="32" fill="#1d4a2a" />
          <rect x="4" y="6" width="4" height="4" fill="#235a33" />
          <rect x="20" y="18" width="4" height="4" fill="#235a33" />
          <rect x="14" y="2" width="2" height="2" fill="#17391f" />
          <rect x="26" y="28" width="2" height="2" fill="#17391f" />
        </pattern>
        <radialGradient id="vignette" cx="50%" cy="50%" r="75%">
          <stop offset="60%" stopColor="#070d1f" stopOpacity="0" />
          <stop offset="100%" stopColor="#070d1f" stopOpacity="0.7" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#grass)" />
      <ellipse cx={0.08 * W} cy={0.97 * H} rx={0.21 * W} ry={0.24 * H} fill="#16324f" stroke="#0b1a2e" strokeWidth={8} />
      <ellipse cx={0.06 * W} cy={0.97 * H} rx={0.15 * W} ry={0.15 * H} fill="#1e4570" />
      {(scene.paths ?? []).map((p, i) => (
        <g key={i}>
          <polyline points={p.map((s) => `${s.x * W},${s.y * H}`).join(" ")} fill="none" stroke="#c9a46a" strokeOpacity={0.14} strokeWidth={26} strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={p.map((s) => `${s.x * W},${s.y * H}`).join(" ")} fill="none" stroke="#e8c98f" strokeOpacity={0.45} strokeWidth={5} strokeDasharray="4 14" strokeLinecap="round" />
        </g>
      ))}
      <rect x={scene.lead.x * W - 60} y={scene.lead.y * H - 26} width={120} height={52} rx={26} fill="#c9a46a" fillOpacity={0.18} stroke="#e8c98f" strokeOpacity={0.3} strokeWidth={3} />
      {buildings.map((b) => {
        const x = b.area.x * W, y = b.area.y * H, w = b.area.w * W, h = b.area.h * H
        const roof = Math.min(h * 0.32, 90)
        const cols = Math.max(2, Math.floor(w / 46))
        const rows = Math.max(1, Math.floor((h - roof - 50) / 52))
        return (
          <g key={b.id}>
            <rect x={x + 10} y={y + 12} width={w} height={h} fill="#000" fillOpacity={0.35} />
            <rect x={x} y={y + roof} width={w} height={h - roof} fill="#8a3b2e" stroke="#1a0f0a" strokeWidth={5} />
            <rect x={x} y={y + roof} width={w} height={8} fill="#e8dcc0" />
            <path d={`M${x - 10} ${y + roof} L${x + w * 0.18} ${y} L${x + w * 0.82} ${y} L${x + w + 10} ${y + roof} Z`} fill="#b4553a" stroke="#1a0f0a" strokeWidth={5} />
            <path d={`M${x + w * 0.18} ${y + 6} L${x + w * 0.82} ${y + 6}`} stroke="#d77a55" strokeWidth={6} />
            {Array.from({ length: rows }).flatMap((_, ry) => Array.from({ length: cols }).map((_, cx) => (
              <rect key={`${ry}-${cx}`} x={x + (w / cols) * cx + (w / cols) / 2 - 9} y={y + roof + 24 + ry * 52} width={18} height={28} fill="#f3d58a" fillOpacity={0.85} stroke="#3b1d14" strokeWidth={3} />
            )))}
            <rect x={b.door.x * W - 18} y={b.door.y * H - 40} width={36} height={40} fill="#2a1710" stroke="#e8dcc0" strokeWidth={4} />
            <rect x={b.door.x * W - 30} y={b.door.y * H - 2} width={60} height={10} fill="#e8dcc0" stroke="#1a0f0a" strokeWidth={3} />
            <g transform={`translate(${x + w / 2} ${y + roof + (h - roof) / 2 + 10})`}>
              <rect x={-(b.name.length * 9 + 22)} y={-20} width={b.name.length * 18 + 44} height={40} fill="#14161d" stroke="#ffffff" strokeOpacity={0.16} strokeWidth={2} rx={14} />
              <text textAnchor="middle" y={7} fontFamily="Inter, sans-serif" fontWeight={700} fontSize={18} fill="#e8e9ee">{b.name}</text>
            </g>
          </g>
        )
      })}
      {trees.map((t, i) => (
        <g key={i} transform={`translate(${t.x * W} ${t.y * H}) scale(${t.s})`}>
          <ellipse cx={4} cy={6} rx={30} ry={10} fill="#000" fillOpacity={0.3} />
          <rect x={-5} y={-20} width={10} height={26} fill="#4a2c1a" stroke="#1a0f0a" strokeWidth={3} />
          <circle cy={-42} r={30} fill="#1f5f30" stroke="#0c2614" strokeWidth={5} />
          <circle cx={-10} cy={-50} r={12} fill="#2e7a40" />
          <path d="M-18 -20 L-18 -4 M14 -22 L14 -2" stroke="#9aa58a" strokeOpacity={0.6} strokeWidth={3} />
        </g>
      ))}
      <rect width={W} height={H} fill="url(#vignette)" />
    </g>
  )
}

const ROOMS: Record<string, { wall: string; trim: string; floor: string; floor2: string; rug: string }> = {
  library: { wall: "#5a2a22", trim: "#d9c9a3", floor: "#8a6a48", floor2: "#7a5c3e", rug: "#1f5f3a" },
  lab: { wall: "#26384f", trim: "#8fb3d1", floor: "#5b6b7d", floor2: "#4f5e6f", rug: "#1d3060" },
  bar: { wall: "#4a2614", trim: "#f2a541", floor: "#5a3a22", floor2: "#4c311c", rug: "#7c2d12" },
  beach: { wall: "#3aa0d8", trim: "#ffffff", floor: "#e8cf8f", floor2: "#dcc07c", rug: "#e2572f" },
}

function RoomArt({ scene }: { scene: Scene }) {
  const kind = Object.keys(ROOMS).find((k) => scene.id.includes(k)) ?? "lab"
  const c = ROOMS[kind]
  const wallH = 0.42 * H
  return (
    <g>
      <defs>
        <pattern id={`floor-${kind}`} width="80" height="40" patternUnits="userSpaceOnUse">
          <rect width="80" height="40" fill={c.floor} />
          <rect width="40" height="20" fill={c.floor2} />
          <rect x="40" y="20" width="40" height="20" fill={c.floor2} />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#floor-${kind})`} />
      {kind === "beach" ? (
        <g>
          <rect width={W} height={wallH * 0.7} fill="#7cc6f0" />
          <circle cx={1300} cy={110} r={60} fill="#fde68a" stroke="#f59e0b" strokeWidth={6} />
          <rect y={wallH * 0.7} width={W} height={wallH * 0.3} fill="#1f7fbf" />
          {Array.from({ length: 16 }).map((_, i) => <rect key={i} x={i * 110 + 20} y={wallH * 0.82} width={50} height={6} fill="#bfe6ff" />)}
          <rect y={wallH} width={W} height={10} fill="#f5e3b0" />
        </g>
      ) : (
        <g>
          <rect width={W} height={wallH} fill={c.wall} />
          <rect y={wallH - 14} width={W} height={14} fill={c.trim} />
          <rect y={wallH} width={W} height={10} fill="#000" fillOpacity={0.35} />
          {kind === "library" && <LibraryWall wallH={wallH} />}
          {kind === "lab" && <LabWall wallH={wallH} />}
          {kind === "bar" && <BarWall wallH={wallH} />}
        </g>
      )}
      <rect x={W * 0.14} y={H * 0.56} width={W * 0.72} height={H * 0.3} fill={c.rug} stroke="#000" strokeOpacity={0.4} strokeWidth={6} />
      <rect x={W * 0.15} y={H * 0.575} width={W * 0.7} height={H * 0.27} fill="none" stroke="#f5c542" strokeOpacity={0.35} strokeWidth={4} />
      {scene.stations.map((s, i) => (
        <g key={i} transform={`translate(${s.x * W} ${s.y * H})`}>
          {kind === "beach" ? (
            <g>
              <rect x={-4} y={-150} width={8} height={110} fill="#f5f5f4" stroke="#1a0f0a" strokeWidth={2} />
              <path d="M-80 -140 Q0 -200 80 -140 Z" fill={i % 2 ? "#ef4444" : "#3b82f6"} stroke="#1a0f0a" strokeWidth={4} />
              <rect x={-60} y={-40} width={120} height={22} fill="#fff" stroke="#1a0f0a" strokeWidth={3} />
            </g>
          ) : (
            <g>
              <rect x={-100} y={-100} width={200} height={40} fill="#5a3a22" stroke="#1a0f0a" strokeWidth={5} />
              <rect x={-92} y={-60} width={12} height={34} fill="#3b2416" />
              <rect x={80} y={-60} width={12} height={34} fill="#3b2416" />
              <rect x={-36} y={-150} width={72} height={46} fill="#1e293b" stroke="#0b0f1a" strokeWidth={5} />
              <rect x={-28} y={-143} width={56} height={32} fill={kind === "library" ? "#a7f3d0" : "#7dd3fc"} fillOpacity={0.8} />
              <rect x={-6} y={-104} width={12} height={6} fill="#0b0f1a" />
              <rect x={50} y={-112} width={34} height={12} fill={["#ef4444", "#3b82f6", "#22c55e", "#eab308"][i % 4]} stroke="#1a0f0a" strokeWidth={2} />
            </g>
          )}
        </g>
      ))}
      <rect width={W} height={H} fill="#070d1f" fillOpacity={0.12} />
    </g>
  )
}

function LibraryWall({ wallH }: { wallH: number }) {
  const books = ["#7c2d12", "#1e3a8a", "#166534", "#a16207", "#6b21a8", "#9f1239"]
  return (
    <g>
      {[0.06, 0.66].map((sx) => (
        <g key={sx} transform={`translate(${sx * W} 40)`}>
          <rect width={W * 0.28} height={wallH - 50} fill="#3b2416" stroke="#1a0f0a" strokeWidth={5} />
          {[0, 1, 2, 3].map((row) => (
            <g key={row}>
              {Array.from({ length: 22 }).map((_, i) => (
                <rect key={i} x={10 + i * 19.5} y={14 + row * 72} width={15} height={56 - (i % 3) * 6} transform={`translate(0 ${(i % 3) * 6})`} fill={books[(i + row * 2) % books.length]} stroke="#1a0f0a" strokeWidth={2} />
              ))}
              <rect y={70 + row * 72} width={W * 0.28} height={8} fill="#5a3a22" />
            </g>
          ))}
        </g>
      ))}
      {[0.4, 0.53].map((sx) => (
        <g key={sx} transform={`translate(${sx * W} 50)`}>
          <path d={`M0 ${wallH - 90} L0 70 Q50 0 100 70 L100 ${wallH - 90} Z`} fill="#fde68a" fillOpacity={0.75} stroke="#d9c9a3" strokeWidth={8} />
          <path d={`M50 20 L50 ${wallH - 90} M0 160 L100 160`} stroke="#d9c9a3" strokeWidth={5} />
        </g>
      ))}
    </g>
  )
}

function LabWall({ wallH }: { wallH: number }) {
  return (
    <g>
      <rect x={W * 0.06} y={60} width={W * 0.3} height={wallH - 120} fill="#f1f5f9" stroke="#0b0f1a" strokeWidth={6} />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={W * 0.08} y={90 + i * 40} width={180 + (i % 2) * 120} height={10} fill={["#3b82f6", "#22c55e", "#ef4444", "#a855f7"][i]} />)}
      <rect x={W * 0.62} y={50} width={W * 0.32} height={wallH - 90} fill="#0f172a" stroke="#0b0f1a" strokeWidth={6} />
      {Array.from({ length: 4 }).map((_, i) => (
        <g key={i} transform={`translate(${W * 0.64 + i * 125} 70)`}>
          <rect width={100} height={wallH - 140} fill="#1e293b" stroke="#334155" strokeWidth={4} />
          {Array.from({ length: 5 }).map((_, j) => <rect key={j} x={14} y={20 + j * 36} width={72} height={8} fill={(i + j) % 3 ? "#22c55e" : "#f59e0b"} fillOpacity={0.8} />)}
        </g>
      ))}
    </g>
  )
}

function BarWall({ wallH }: { wallH: number }) {
  return (
    <g>
      {Array.from({ length: 9 }).map((_, i) => (
        <g key={i} transform={`translate(${200 + i * 140} 0)`}>
          <rect x={-2} y={0} width={4} height={60} fill="#1a0f0a" />
          <circle cy={70} r={16} fill="#fbbf24" stroke="#1a0f0a" strokeWidth={4} />
        </g>
      ))}
      <rect x={W * 0.2} y={130} width={W * 0.6} height={110} fill="#2a1710" stroke="#1a0f0a" strokeWidth={6} />
      {Array.from({ length: 24 }).map((_, i) => <rect key={i} x={W * 0.21 + i * 38} y={150 + (i % 2) * 50} width={14} height={36} fill={["#16a34a", "#b45309", "#7c2d12", "#ca8a04"][i % 4]} stroke="#1a0f0a" strokeWidth={2} />)}
      <rect x={W * 0.1} y={wallH - 70} width={W * 0.8} height={60} fill="#7c4a26" stroke="#1a0f0a" strokeWidth={6} />
      <rect x={W * 0.1} y={wallH - 70} width={W * 0.8} height={12} fill="#f2a541" />
    </g>
  )
}
