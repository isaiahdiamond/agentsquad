import type { Spot } from "@agentsquad/shared"

const W = 2688, H = 1520, STEP = 24
export const PARTY_SPOTS = {
  drink: { x: .665, y: .37, scale: 1.6 },
  chat: { x: .235, y: .335, scale: 1.6 },
  dance: { x: .465, y: .385, scale: 1.6 },
} satisfies Record<string, Spot>
export type PartyAction = keyof typeof PARTY_SPOTS
export type Guest = { x: number; y: number; mode: "sit" | "dance" | "bar" | "swim" | "float" | "dj" | "lounge"; female?: boolean; swimwear?: boolean }
export const GUESTS: Guest[] = [
  { x: .143, y: .35, mode: "sit", female: true },
  { x: .25, y: .275, mode: "sit" },
  { x: .355, y: .232, mode: "sit", female: true },
  { x: .225, y: .64, mode: "sit", female: true },
  { x: .39, y: .78, mode: "sit" },
  { x: .43, y: .355, mode: "dance", female: true },
  { x: .51, y: .38, mode: "dance" },
  { x: .57, y: .405, mode: "dance", female: true },
  { x: .50, y: .31, mode: "dj" },
  { x: .76, y: .46, mode: "bar" },
  { x: .85, y: .485, mode: "bar", female: true },
  { x: .34, y: .50, mode: "swim" },
  { x: .47, y: .66, mode: "swim", female: true },
  { x: .68, y: .58, mode: "swim" },
  { x: .275, y: .505, mode: "float", female: true },
  { x: .52, y: .62, mode: "float" },
  { x: .40, y: .57, mode: "swim", female: true },
  { x: .60, y: .64, mode: "swim", female: true },
  { x: .72, y: .55, mode: "swim" },
  { x: .36, y: .46, mode: "swim", female: true },
  { x: .56, y: .53, mode: "swim" },
  { x: .73, y: .49, mode: "sit", female: true, swimwear: true },
  { x: .79, y: .52, mode: "sit", swimwear: true },
  { x: .84, y: .545, mode: "sit", female: true, swimwear: true },
  { x: .81, y: .69, mode: "lounge", female: true, swimwear: true },
  { x: .90, y: .645, mode: "lounge", swimwear: true },
  { x: .73, y: .77, mode: "lounge", female: true, swimwear: true },
  { x: .665, y: .825, mode: "lounge", swimwear: true },
  { x: .365, y: .38, mode: "dance", female: true, swimwear: true },
  { x: .40, y: .385, mode: "dance", swimwear: true },
  { x: .54, y: .425, mode: "dance", female: true, swimwear: true },
  { x: .60, y: .395, mode: "dance", swimwear: true },
  { x: .32, y: .59, mode: "swim", female: true },
  { x: .405, y: .66, mode: "swim" },
  { x: .54, y: .715, mode: "swim", female: true },
  { x: .65, y: .67, mode: "swim" },
  { x: .61, y: .535, mode: "swim", female: true },
  { x: .755, y: .575, mode: "swim" },
]
export type Obstacle = { x: number; y: number; radius: number }
export const GUEST_OBSTACLES: Obstacle[] = GUESTS.filter(g => g.mode !== "swim" && g.mode !== "float").map(g => ({
  x: g.x,
  // The DJ's hidden legs extend behind the console; reserve the console
  // footprint rather than the visible image's lower crop anchor.
  y: g.mode === "dj" ? .267 : g.y,
  radius: 42,
}))
const deck = [[.52,.905],[.40,.86],[.345,.805],[.27,.75],[.175,.625],[.10,.59],[.045,.53],[.035,.455],[.065,.39],[.14,.395],[.18,.365],[.285,.31],[.39,.265],[.46,.30],[.56,.335],[.61,.33],[.645,.33],[.665,.37]]
const branches = [[[.18,.365],[.235,.335],[.285,.31]], [[.46,.30],[.465,.385]], [[.52,.905],[.65,.83],[.78,.75],[.90,.66],[.95,.57]]]
const segments = [deck, ...branches].flatMap(line => line.slice(1).map((p,i) => [line[i],p]))
function segmentDistance(x: number, y: number, a: number[], b: number[]) {
  const dx=(b[0]-a[0])*W, dy=(b[1]-a[1])*H
  const t=Math.max(0,Math.min(1,((x-a[0]*W)*dx+(y-a[1]*H)*dy)/(dx*dx+dy*dy)))
  return Math.hypot(x-a[0]*W-t*dx,y-a[1]*H-t*dy)
}
export function onDeck(p: Spot) {
  return segments.some(([a,b]) => segmentDistance(p.x*W,p.y*H,a,b) <= 94)
}
export function clearAt(p: Spot, obstacles: Obstacle[]) {
  return onDeck(p) && obstacles.every(o => Math.hypot((p.x-o.x)*W,(p.y-o.y)*H) >= o.radius+32)
}
export function clearSegment(a: Spot, b: Spot, obstacles: Obstacle[]) {
  const n=Math.max(1,Math.ceil(Math.hypot((b.x-a.x)*W,(b.y-a.y)*H)/8))
  const distance=(p: Spot,o: Obstacle)=>Math.hypot((p.x-o.x)*W,(p.y-o.y)*H)
  const previous=obstacles.map(o=>distance(a,o))
  for(let i=1;i<=n;i++) {
    const p={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n,scale:1.6}
    if(!onDeck(p)) return false
    for(let j=0;j<obstacles.length;j++) {
      const d=distance(p,obstacles[j]), limit=obstacles[j].radius+32
      // Shared spawn points can separate, but never move deeper into an overlap.
      if(d<limit && (previous[j]>=limit || d<previous[j]-.001)) return false
      previous[j]=d
    }
  }
  return true
}
const cols=Math.ceil(W/STEP), rows=Math.ceil(H/STEP)
const point=(key:number):Spot=>({x:(key%cols)*STEP/W,y:Math.floor(key/cols)*STEP/H,scale:1.6})
// A* stays inside the dry-deck corridors. An obstructed destination waits rather
// than falling back to a straight line through a guest or across the pool.
export function partyRoute(start: Spot, goal: Spot, obstacles: Obstacle[]): Spot[] | null {
  if(!clearAt(goal,obstacles)) return null
  if(clearSegment(start,goal,obstacles)) {
    const n=Math.max(1,Math.ceil(Math.hypot((goal.x-start.x)*W,(goal.y-start.y)*H)/STEP))
    return Array.from({length:n},(_,i)=>i===n-1 ? goal : ({x:start.x+(goal.x-start.x)*(i+1)/n,y:start.y+(goal.y-start.y)*(i+1)/n,scale:1.6}))
  }
  const valid=new Map<number,boolean>()
  const ok=(key:number)=> {
    if(!valid.has(key)) valid.set(key,clearAt(point(key),obstacles))
    return valid.get(key)!
  }
  const nearest=(p:Spot)=> {
    let best=-1, distance=Infinity
    for(let k=0;k<cols*rows;k++) {
      const q=point(k), d=Math.hypot((q.x-p.x)*W,(q.y-p.y)*H)
      if(d<distance && d<110 && ok(k) && clearSegment(p,q,obstacles)) {best=k;distance=d}
    }
    return best
  }
  const first=nearest(start), last=nearest(goal)
  if(first<0 || last<0) return null
  const open=new Set([first]), cost=new Map([[first,0]]), prev=new Map<number,number>()
  const heuristic=(k:number)=>Math.hypot(k%cols-last%cols,Math.floor(k/cols)-Math.floor(last/cols))
  while(open.size) {
    let cur=-1, score=Infinity
    for(const k of open) { const f=cost.get(k)!+heuristic(k); if(f<score){cur=k;score=f} }
    if(cur===last) {
      const keys=[cur];while(prev.has(cur)){cur=prev.get(cur)!;keys.push(cur)}
      return keys.reverse().map(point).concat(goal)
    }
    open.delete(cur)
    const cx=cur%cols,cy=Math.floor(cur/cols)
    for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++) {
      if(!dx&&!dy || cx+dx<0||cx+dx>=cols||cy+dy<0||cy+dy>=rows) continue
      const next=cur+dx+dy*cols
      if(!ok(next) || !clearSegment(point(cur),point(next),obstacles)) continue
      const g=cost.get(cur)!+Math.hypot(dx,dy)
      if(g<(cost.get(next)??Infinity)){cost.set(next,g);prev.set(next,cur);open.add(next)}
    }
  }
  return null
}
export class ClubTraffic {
  actors=new Map<string,()=>Spot>()
  reservations=new Map<string,Spot>()
  obstacles(id:string):Obstacle[] {
    return [...GUEST_OBSTACLES,...[...this.actors].filter(([key])=>key!==id).map(([,get])=>({...get(),radius:34})),...[...this.reservations].filter(([key])=>key!==id).map(([,p])=>({...p,radius:34}))]
  }
}
