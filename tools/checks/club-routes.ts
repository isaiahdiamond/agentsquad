// Run with: node --import tsx tools/checks/club-routes.ts
import assert from 'node:assert/strict'
import {partyRoute,PARTY_SPOTS,GUEST_OBSTACLES,clearSegment,ClubTraffic} from '../../web/src/arena/club-navigation.ts'
import fs from 'node:fs'
const scene=JSON.parse(fs.readFileSync(new URL('../../web/public/art/scenes/scenes.json', import.meta.url),'utf8')).find((s:any)=>s.id==='club')
let checks=0
for(const home of [scene.lead,...scene.stations,scene.bench]) for(const [action,dest] of Object.entries(PARTY_SPOTS)) {
 for(const [start,end] of [[home,dest],[dest,home]]) {
  const route=partyRoute(start,end,GUEST_OBSTACLES)
  assert(route, `Missing ${action} route`)
  let prev=start
  for(const point of route){assert(clearSegment(prev,point,GUEST_OBSTACLES));prev=point}
  assert.deepEqual(route.at(-1),end);checks++
 }
}
assert.equal(checks,36)
const blocked=[...GUEST_OBSTACLES,{...PARTY_SPOTS.drink,radius:34}]
assert.equal(partyRoute(scene.lead,PARTY_SPOTS.drink,blocked),null)
const traffic=new ClubTraffic();traffic.actors.set('other',()=>PARTY_SPOTS.drink)
assert.equal(partyRoute(scene.lead,PARTY_SPOTS.drink,traffic.obstacles('lead')),null)
traffic.actors.clear();traffic.reservations.set('other',PARTY_SPOTS.drink)
assert.equal(partyRoute(scene.lead,PARTY_SPOTS.drink,traffic.obstacles('lead')),null)
console.log('Passed',checks,'round-trip legs, corridor/guest clearance, blocked destination, live occupants and reservations')
for(const home of [scene.lead,...scene.stations]){
 const obstacles=[...GUEST_OBSTACLES,...[scene.lead,...scene.stations].filter(p=>p!==home).map(p=>({...p,radius:34}))]
 for(const dest of Object.values(PARTY_SPOTS)) assert(partyRoute(home,dest,obstacles),'Path around seated agents')
}
const sameSpawn=[...GUEST_OBSTACLES,{...scene.bench,radius:34}]
assert(partyRoute(scene.bench,PARTY_SPOTS.drink,sameSpawn),'Overlapping spawn can separate')
console.log('Passed occupied-chair detours and shared-spawn escape')
