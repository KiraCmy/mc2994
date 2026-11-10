/**
 * World Final — underworld meshes (three.js). Shapes come from caves.js and
 * habitatField.js so what you see and what you bump into agree.
 *   floor   — drifted sand under the dunes
 *   ceiling — the dunes' underside: soft, nacre-pale, sagging into pillars
 *   crystals — a few, on the floor and hanging from the ceiling
 * Light falls in through the hole only: baked as vertex shade (bright near
 * the opening, dim deeper in). No transmission materials (they cost a pass).
 */
import * as THREE from 'three'
import { HABITAT_SEED, habitatRng, holeDistance, holeShape } from './habitatField.js'
import { clearance, underworldCeiling, underworldFloor, UNDERWORLD } from './caves.js'
import { buildPolarGrid } from './habitatTerrainBuild.js'
import { createPrismCrystalGeometry, orientAlong, PRISM_HEIGHT } from './crystalShapes.js'

/** Light from the opening: 1 under the hole, falling off into the dark. */
export function holeLight(x, z) {
  const d = Math.max(0, holeDistance(x, z) - UNDERWORLD.hole.r)
  return 0.16 + 0.84 * Math.exp(-d / 10)
}

function layer(heightAt, { shade = 1, skip = null } = {}) {
  const geo = buildPolarGrid(UNDERWORLD.radius + 1, 64, 200, 1.05)
  const pos = geo.attributes.position.array
  const col = new Float32Array(pos.length)
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i] + UNDERWORLD.centre.x
    const z = pos[i + 2] + UNDERWORLD.centre.z
    pos[i] = x
    pos[i + 2] = z
    pos[i + 1] = heightAt(x, z)
    const k = holeLight(x, z) * shade
    col[i] = k
    col[i + 1] = k
    col[i + 2] = k
  }
  if (skip) {
    const index = geo.index.array
    const kept = []
    for (let t = 0; t < index.length; t += 3) {
      const a = index[t] * 3
      const b = index[t + 1] * 3
      const c = index[t + 2] * 3
      if (skip([pos[a], pos[a + 1], pos[a + 2]], [pos[b], pos[b + 1], pos[b + 2]], [pos[c], pos[c + 1], pos[c + 2]])) continue
      kept.push(index[t], index[t + 1], index[t + 2])
    }
    geo.setIndex(kept)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

export function buildFloorGeometry() {
  return layer((x, z) => underworldFloor(x, z))
}

export function buildCeilingGeometry() {
  const closed = (p) => clearance(p[0], p[2]) < 0.05
  return layer((x, z) => underworldCeiling(x, z), {
    shade: 0.85,
    skip: (a, b, c) => {
      /* Open where the throat comes through: the edge stays behind the
         throat wall and above its collar, so no ragged triangles show. */
      const { hole } = UNDERWORLD
      for (const v of [a, b, c]) {
        if (holeDistance(v[0], v[2]) < holeShape(Math.atan2(v[2] - hole.z, v[0] - hole.x)).inner + 0.5) return true
      }
      /* Where the ceiling has met the floor (walls, pillar cores), drop it. */
      return closed(a) && closed(b) && closed(c)
    },
  })
}

/** A few crystals: standing on the floor, hanging from the ceiling. */
export function underworldCrystalList(seed = HABITAT_SEED + 515) {
  const r = habitatRng(seed)
  const list = []
  const { centre, radius, hole } = UNDERWORLD
  const place = (want, hanging) => {
    let n = 0
    for (let tries = 0; tries < want * 40 && n < want; tries++) {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * radius * 0.92
      const x = centre.x + Math.cos(a) * d
      const z = centre.z + Math.sin(a) * d
      if (holeDistance(x, z) < hole.r + 1.5) continue
      const room = clearance(x, z)
      if (room < (hanging ? 2.6 : 1.4)) continue
      /* Clusters of 1–3. */
      const cnt = 1 + Math.floor(r() * 3)
      for (let k = 0; k < cnt; k++) {
        const cx = x + (r() - 0.5) * 0.9
        const cz = z + (r() - 0.5) * 0.9
        const h = Math.min(room * 0.45, 0.35 + Math.pow(r(), 1.8) * 1.4)
        const tilt = 0.45
        const axis = new THREE.Vector3((r() - 0.5) * tilt, hanging ? -1 : 1, (r() - 0.5) * tilt).normalize()
        const y = hanging ? underworldCeiling(cx, cz) + 0.1 : underworldFloor(cx, cz) - 0.08
        list.push({ x: cx, y, z: cz, h, w: h * (0.2 + r() * 0.1), axis, spin: r() * Math.PI })
      }
      n += 1
    }
  }
  place(14, false)
  place(10, true)
  return list
}

export function createCaveResources() {
  const floorGeo = buildFloorGeometry()
  const floorMat = new THREE.MeshStandardMaterial({ color: '#b9aec6', roughness: 0.95, metalness: 0, vertexColors: true })
  const ceilingGeo = buildCeilingGeometry()
  const ceilingMat = new THREE.MeshPhysicalMaterial({
    color: '#d6cade',
    roughness: 0.5,
    metalness: 0,
    iridescence: 0.55,
    iridescenceIOR: 1.35,
    iridescenceThicknessRange: [200, 650],
    emissive: new THREE.Color('#201a29'),
    emissiveIntensity: 0.3,
    vertexColors: true,
    side: THREE.DoubleSide,
  })

  const crystalList = underworldCrystalList()
  const crystalGeo = createPrismCrystalGeometry({ taper: 0.12 })
  const crystalMat = new THREE.MeshStandardMaterial({
    color: '#e4d9ff',
    roughness: 0.14,
    metalness: 0.06,
    emissive: new THREE.Color('#7d68b6'),
    emissiveIntensity: 0.35,
    flatShading: true,
  })
  const crystals = new THREE.InstancedMesh(crystalGeo, crystalMat, Math.max(1, crystalList.length))
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const s = new THREE.Vector3()
  crystalList.forEach((c, i) => {
    orientAlong(q, c.axis, c.spin)
    p.set(c.x, c.y, c.z)
    s.set(c.w, c.h / PRISM_HEIGHT, c.w)
    crystals.setMatrixAt(i, m.compose(p, q, s))
  })
  crystals.count = crystalList.length
  crystals.instanceMatrix.needsUpdate = true

  const objects = [new THREE.Mesh(floorGeo, floorMat), new THREE.Mesh(ceilingGeo, ceilingMat), crystals]
  return {
    objects,
    crystalMat,
    ceilingMat,
    dispose() {
      for (const d of [floorGeo, floorMat, ceilingGeo, ceilingMat, crystalGeo, crystalMat]) d.dispose()
      crystals.dispose?.()
    },
  }
}
