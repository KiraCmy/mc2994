import { cavePose, underworldSpan, remainNiches } from './src/playground/finalHabitat/caves.js'
import { habitatSurfaceHeight, underworldFloor, UNDERWORLD, habitatHeight } from './src/playground/finalHabitat/habitatField.js'
import { buildGroundGeometry } from './src/playground/finalHabitat/habitatTerrainBuild.js'
import { createCaveResources } from './src/playground/finalHabitat/caveGeometry.js'
for (const id of ['hole','inside']) console.log(id, JSON.stringify(cavePose(id)))
const h=UNDERWORLD.hole
console.log('surface at hole', habitatSurfaceHeight(h.x,h.z).toFixed(2), 'floor', underworldFloor(h.x,h.z).toFixed(2), 'habitatHeight', habitatHeight(h.x,h.z).toFixed(2))
const c=UNDERWORLD.centre
const fl=underworldFloor(c.x,c.z); console.log('centre span', JSON.stringify(underworldSpan(c.x,fl+1.5,c.z)))
const g=buildGroundGeometry(); const p=g.attributes.position, idx=g.index
let inHole=0; for(let i=0;i<idx.count;i+=3){let x=0,z=0;for(let k=0;k<3;k++){const v=idx.getX(i+k);x+=p.getX(v)/3;z+=p.getZ(v)/3} if(Math.hypot(x-h.x,z-h.z)<h.r) inHole++}
console.log('ground tris', idx.count/3, 'inside hole', inHole)
const r=createCaveResources(); for (const o of r.objects) console.log(o.type, o.geometry?.index?.count ?? o.geometry?.attributes?.position?.count, o.count ?? '')
console.log('niches', JSON.stringify(remainNiches(3)))
