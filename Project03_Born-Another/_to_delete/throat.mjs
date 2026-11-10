import { buildThroatGeometry, buildGroundGeometry } from '../src/playground/finalHabitat/habitatTerrainBuild.js'
import { holeShape, UNDERWORLD, habitatSurfaceHeight, THROAT } from '../src/playground/finalHabitat/habitatField.js'
import { underworldCeiling } from '../src/playground/finalHabitat/caves.js'
import { remainNiches, underworldSpan } from '../src/playground/finalHabitat/caves.js'
const g=buildThroatGeometry(); const p=g.attributes.position.array, n=g.attributes.normal.array
let nan=0; for(const v of p) if(!Number.isFinite(v)) nan++
const {hole}=UNDERWORLD
// wall normals should point toward axis
let inward=0, out=0; const rows=61
for(let j=0;j<240;j+=10){ const v=j*rows+30; const dx=hole.x-p[v*3], dz=hole.z-p[v*3+2]; (n[v*3]*dx+n[v*3+2]*dz>0)?inward++:out++ }
console.log('nan',nan,'wall normals inward',inward,'outward',out)
let ys=[]; for(let i=0;i<rows;i+=6) ys.push(p[i*3+1].toFixed(2)+'@'+Math.hypot(p[i*3]-hole.x,p[i*3+2]-hole.z).toFixed(2)); console.log('profile j=0', ys.join(' '))
const a=0; const s=holeShape(0); console.log('shape0',s, 'ceil at inner', underworldCeiling(hole.x+s.inner,hole.z).toFixed(2), 'surface at lip', habitatSurfaceHeight(hole.x+s.lip,hole.z).toFixed(2))
let bad=0; for (const [x,y,z] of remainNiches(40)) { const sp=underworldSpan(x,y,z); if(!sp||y<sp.floor||y>sp.ceiling) bad++ } console.log('bad niches',bad)
