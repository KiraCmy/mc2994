/**
 * Exp07 Final Habitat — crystal outcrops and abstract residue (three.js only).
 *
 * Outcrops: druse clusters of chamfered quartz with a milky phantom inside
 * each large crystal (reads as volume through the glass), small chips at the
 * foot, and frost-flower beads where they meet the sand.
 * Residue: sparse traces in the organism's own materials (pearl blobs, bead
 * clusters, iridescent membrane flakes), low contrast so the body stays the
 * focus. No grass, no leaves.
 */
import * as THREE from 'three'
import {
  HABITAT_SEED,
  habitatHeight,
  habitatNormal,
  habitatRng,
  OUTCROPS,
  SPORES,
} from './habitatField.js'
import {
  createBeadGeometry,
  createBeadMaterial,
  createCrystalMaterial,
  createPrismCrystalGeometry,
  orientAlong,
  PRISM_HEIGHT,
} from './crystalShapes.js'

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _a = new THREE.Vector3()

function instanced(geometry, material, list, write) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, list.length))
  mesh.count = list.length
  list.forEach((item, i) => {
    write(item)
    mesh.setMatrixAt(i, _m.compose(_p, _q, _s))
  })
  mesh.instanceMatrix.needsUpdate = true
  return mesh
}

export function buildOutcrops() {
  const r = habitatRng(HABITAT_SEED + 202)
  const crystals = []
  const beads = []
  for (const o of OUTCROPS) {
    const n = habitatNormal(o.x, o.z)
    const count = Math.round(o.count * 1.4)
    for (let i = 0; i < count; i++) {
      const main = i === 0
      const ang = r() * Math.PI * 2
      const rad = main ? 0 : Math.pow(r(), 0.7) * o.spread
      const x = o.x + Math.cos(ang) * rad
      const z = o.z + Math.sin(ang) * rad
      const big = main ? 1 : Math.pow(r(), 1.3)
      const height = o.scale * (0.28 + big * 0.85)
      const lean = main ? 0.12 : 0.3 + (rad / Math.max(o.spread, 1e-3)) * 0.7
      crystals.push({
        x, z,
        y: habitatHeight(x, z) - height * 0.14,
        axis: new THREE.Vector3(n[0] + Math.cos(ang) * lean, n[1], n[2] + Math.sin(ang) * lean).normalize(),
        spin: r() * Math.PI,
        height,
        width: height * (0.26 + r() * 0.12),
        phantom: height > o.scale * 0.55,
      })
      /* chips at the foot of the bigger crystals */
      if (big > 0.45) {
        const chips = 2 + Math.floor(r() * 3)
        for (let c = 0; c < chips; c++) {
          const ca = ang + (r() - 0.5) * 2.4
          const cr = height * (0.18 + r() * 0.2)
          const cx = x + Math.cos(ca) * cr
          const cz = z + Math.sin(ca) * cr
          const ch = height * (0.12 + r() * 0.16)
          crystals.push({
            x: cx, z: cz,
            y: habitatHeight(cx, cz) - ch * 0.15,
            axis: new THREE.Vector3(n[0] + Math.cos(ca) * 0.9, n[1], n[2] + Math.sin(ca) * 0.9).normalize(),
            spin: r() * Math.PI,
            height: ch,
            width: ch * (0.32 + r() * 0.12),
            phantom: false,
          })
        }
      }
    }
    /* frost-flower beads where the cluster meets the sand */
    const rosettes = Math.round(o.count * 2.6)
    for (let k = 0; k < rosettes; k++) {
      const ang = r() * Math.PI * 2
      const rad = Math.pow(r(), 0.6) * o.spread * 1.35
      const cx = o.x + Math.cos(ang) * rad
      const cz = o.z + Math.sin(ang) * rad
      const radius = (0.06 + r() * 0.08) * Math.max(0.7, o.scale * 0.55)
      const cnt = 5 + Math.floor(r() * 7)
      for (let b = 0; b < cnt; b++) {
        const ring = b === 0 ? 0 : Math.sqrt(r())
        const ba = r() * Math.PI * 2
        const bx = cx + Math.cos(ba) * ring * radius
        const bz = cz + Math.sin(ba) * ring * radius
        const size = radius * (b === 0 ? 0.5 : 0.22 + (1 - ring) * 0.25 + r() * 0.12)
        beads.push({ x: bx, z: bz, y: habitatHeight(bx, bz) + size * 0.35, size })
      }
    }
  }
  return { crystals, beads }
}

export function createOutcropResources() {
  const layout = buildOutcrops()
  const crystalGeo = createPrismCrystalGeometry({ taper: 0.1 })
  const crystalMat = createCrystalMaterial({
    color: '#fff9fc',
    roughness: 0.02,
    thickness: 1.6,
    attenuationColor: new THREE.Color('#f6dfee'),
    attenuationDistance: 2.6,
    dispersion: 0.6,
    iridescence: 1,
    iridescenceThicknessRange: [120, 900],
    emissive: new THREE.Color('#fff0f6'),
    emissiveIntensity: 0.06,
    envMapIntensity: 3.2,
  })
  const crystals = instanced(crystalGeo, crystalMat, layout.crystals, (c) => {
    orientAlong(_q, c.axis, c.spin)
    _p.set(c.x, c.y, c.z)
    _s.set(c.width, c.height / PRISM_HEIGHT, c.width)
  })
  const tints = ['#ffffff', '#f3e6ff', '#ffecf5', '#eceeff'].map((h) => new THREE.Color(h))
  layout.crystals.forEach((c, i) => crystals.setColorAt(i, tints[Math.floor(Math.abs(Math.sin(c.x * 12.9 + c.z * 78.2)) * tints.length) % tints.length]))
  crystals.instanceColor.needsUpdate = true

  /* Milky phantom inside each large crystal: seen refracted, gives depth. */
  const phantomMat = new THREE.MeshStandardMaterial({
    color: '#f2e6f4',
    roughness: 0.55,
    metalness: 0,
    emissive: new THREE.Color('#fff0f6'),
    emissiveIntensity: 0.14,
    flatShading: true,
  })
  const phantomList = layout.crystals.filter((c) => c.phantom)
  const phantoms = instanced(crystalGeo, phantomMat, phantomList, (c) => {
    orientAlong(_q, c.axis, c.spin + 0.5)
    _a.copy(c.axis).multiplyScalar(c.height * 0.12)
    _p.set(c.x + _a.x, c.y + _a.y, c.z + _a.z)
    _s.set(c.width * 0.42, (c.height * 0.62) / PRISM_HEIGHT, c.width * 0.42)
  })

  const beadGeo = createBeadGeometry()
  const beadMat = createBeadMaterial({ emissiveIntensity: 0.06 })
  const beads = instanced(beadGeo, beadMat, layout.beads, (b) => {
    _q.identity()
    _p.set(b.x, b.y, b.z)
    _s.set(b.size, b.size, b.size)
  })

  return {
    crystals, phantoms, beads, crystalMat, beadMat,
    dispose() {
      for (const o of [crystals, phantoms, beads, crystalGeo, crystalMat, phantomMat, beadGeo, beadMat]) o.dispose?.()
    },
  }
}

/** Abstract residue in the organism's materials — quiet, sparse, low. */
export function createResidueResources() {
  const r = habitatRng(HABITAT_SEED + 404)
  const near = (rMin, rMax) => {
    const ang = r() * Math.PI * 2
    const rad = rMin + Math.pow(r(), 1.3) * (rMax - rMin)
    return [Math.cos(ang) * rad, Math.sin(ang) * rad, rad]
  }

  /* Pearl blobs: flattened, half-sunk drops of the body's membrane. */
  const blobGeo = new THREE.SphereGeometry(1, 32, 20)
  const blobMat = new THREE.MeshPhysicalMaterial({
    color: '#f3ecf8',
    metalness: 0,
    roughness: 0.1,
    transmission: 0.9,
    thickness: 0.4,
    ior: 1.3,
    iridescence: 1,
    iridescenceIOR: 1.35,
    iridescenceThicknessRange: [250, 650],
    attenuationColor: new THREE.Color('#f0cfe0'),
    attenuationDistance: 0.6,
    envMapIntensity: 1.2,
  })
  const blobList = SPORES.map((s) => ({ x: s.x, z: s.z, size: s.r, squash: 0.7 }))
  for (let i = 0; i < 80; i++) {
    const [x, z, rad] = near(2.2, 40)
    blobList.push({ x, z, size: (0.02 + Math.pow(r(), 2) * 0.09) * (1 + rad * 0.03), squash: 0.4 + r() * 0.2 })
  }
  const blobs = instanced(blobGeo, blobMat, blobList, (b) => {
    _q.identity()
    _p.set(b.x, habitatHeight(b.x, b.z) + b.size * b.squash * 0.35, b.z)
    _s.set(b.size, b.size * b.squash, b.size)
  })

  /* Bead clusters: little frost-flowers scattered thinly over the dunes. */
  const beadList = []
  for (let k = 0; k < 70; k++) {
    const [cx, cz, rad] = near(2, 30)
    const radius = (0.02 + r() * 0.03) * (1 + rad * 0.04)
    const cnt = 4 + Math.floor(r() * 6)
    for (let b = 0; b < cnt; b++) {
      const ring = b === 0 ? 0 : Math.sqrt(r())
      const ba = r() * Math.PI * 2
      const x = cx + Math.cos(ba) * ring * radius
      const z = cz + Math.sin(ba) * ring * radius
      const size = radius * (b === 0 ? 0.45 : 0.2 + r() * 0.2)
      beadList.push({ x, z, size })
    }
  }
  const beadGeo = createBeadGeometry()
  const beadMat = createBeadMaterial({ color: '#efe3ee', emissiveIntensity: 0.02, envMapIntensity: 1.1 })
  const beads = instanced(beadGeo, beadMat, beadList, (b) => {
    _q.identity()
    _p.set(b.x, habitatHeight(b.x, b.z) + b.size * 0.3, b.z)
    _s.set(b.size, b.size, b.size)
  })

  /* Membrane flakes: thin cupped iridescent fragments lying on the sand. */
  const flakeGeo = new THREE.CircleGeometry(1, 24)
  flakeGeo.rotateX(-Math.PI / 2)
  {
    const p = flakeGeo.attributes.position.array
    for (let i = 0; i < p.length; i += 3) {
      const d = Math.hypot(p[i], p[i + 2])
      p[i + 1] = d * d * 0.22 + Math.sin(p[i] * 3.1) * 0.03
      p[i] *= 1 + 0.18 * Math.sin(Math.atan2(p[i + 2], p[i]) * 3)
    }
    flakeGeo.computeVertexNormals()
  }
  const flakeMat = new THREE.MeshPhysicalMaterial({
    color: '#f2ebfb',
    metalness: 0,
    roughness: 0.12,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    side: THREE.DoubleSide,
    iridescence: 1,
    iridescenceIOR: 1.35,
    iridescenceThicknessRange: [250, 820],
    clearcoat: 1,
    envMapIntensity: 1.5,
  })
  const flakeList = []
  for (let i = 0; i < 140; i++) {
    const [x, z, rad] = near(1.8, 36)
    flakeList.push({ x, z, size: (0.05 + Math.pow(r(), 2) * 0.2) * (1 + rad * 0.03), yaw: r() * Math.PI * 2, tilt: (r() - 0.5) * 0.5 })
  }
  const euler = new THREE.Euler()
  const flakes = instanced(flakeGeo, flakeMat, flakeList, (f) => {
    const n = habitatNormal(f.x, f.z)
    _a.set(n[0], n[1], n[2])
    orientAlong(_q, _a, f.yaw)
    _q.multiply(new THREE.Quaternion().setFromEuler(euler.set(f.tilt, 0, 0)))
    _p.set(f.x, habitatHeight(f.x, f.z) + 0.006, f.z)
    _s.set(f.size, f.size, f.size * 0.7)
  })
  flakes.renderOrder = 3

  return {
    blobs, beads, flakes, beadMat,
    dispose() {
      for (const o of [blobs, beads, flakes, blobGeo, blobMat, beadGeo, beadMat, flakeGeo, flakeMat]) o.dispose?.()
    },
  }
}
