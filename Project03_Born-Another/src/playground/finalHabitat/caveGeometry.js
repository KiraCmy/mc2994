/**
 * World Final — underworld meshes (three.js). Shapes come from caves.js and
 * habitatField.js so what you see and what you bump into agree.
 *   floor   — drifted sand under the dunes
 *   ceiling — the dunes' underside: soft, nacre-pale, sagging into pillars
 *   crystals — druses of the surface's two kinds (lilac quartz and ember),
 *              on the floor, the walls and hanging from the ceiling
 * Skin: the throat's dark oil-film sand (the ground shader, darker, with a
 * standing rainbow film). Light falls in through the hole only: baked as
 * vertex shade (bright near the opening, dim deeper in).
 */
import * as THREE from 'three'
import { HABITAT_SEED, habitatRng, holeDistance, holeShape } from './habitatField.js'
import { clearance, underworldCeiling, underworldFloor, UNDERWORLD } from './caves.js'
import { buildPolarGrid, createGroundMaterial } from './habitatTerrainBuild.js'
import { createBeadGeometry, createBeadMaterial, createPrismCrystalGeometry, orientAlong, PRISM_HEIGHT } from './crystalShapes.js'
import { createEmberColumnGeometry, createEmberMaterial, EMBER_HABITS, emberTintFor } from './emberCrystals.js'
import { applyOutcropTints, createOutcropCrystalMaterial, createOutcropPhantomMaterial } from './habitatGrowthBuild.js'
import { remainNiches } from './caves.js'

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
    /* A step darker than the surface: the cavern is lit by the hole alone. */
    const k = holeLight(x, z) * shade * 0.78
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

const vnorm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

/** Surface normal of a height field, facing into the cavern. */
function fieldNormal(fn, x, z, down) {
  const e = 0.3
  const dx = (fn(x + e, z) - fn(x - e, z)) / (2 * e)
  const dz = (fn(x, z + e) - fn(x, z - e)) / (2 * e)
  return down ? vnorm([dx, -1, dz]) : vnorm([-dx, 1, -dz])
}

/** Tilt `n` by `lean` toward azimuth `az` (around n). */
function tilt(n, lean, az) {
  const ref = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const t1 = vnorm([n[1] * ref[2] - n[2] * ref[1], n[2] * ref[0] - n[0] * ref[2], n[0] * ref[1] - n[1] * ref[0]])
  const t2 = [n[1] * t1[2] - n[2] * t1[1], n[2] * t1[0] - n[0] * t1[2], n[0] * t1[1] - n[1] * t1[0]]
  const c = Math.cos(az)
  const sn = Math.sin(az)
  const sl = Math.sin(lean)
  const cl = Math.cos(lean)
  return vnorm([n[0] * cl + (t1[0] * c + t2[0] * sn) * sl, n[1] * cl + (t1[1] * c + t2[1] * sn) * sl, n[2] * cl + (t1[2] * c + t2[2] * sn) * sl])
}

/**
 * The cavern's crystals: druses of the surface's two kinds — lilac quartz
 * and ember — on the floor, on the walls (where the ceiling sweeps down to
 * meet the floor) and hanging from the vault. Each druse is one dominant
 * crystal, a few tall companions and a splayed spray of small ones, all
 * growing out of the rock along its normal. Kept clear of the hole and of
 * the niches where kept remains rest. Returns { lilac, ember, beads }.
 */
export function underworldClusters(seed = HABITAT_SEED + 515) {
  const r = habitatRng(seed)
  const { centre, radius, hole } = UNDERWORLD
  const niches = remainNiches(40)
  const sites = []
  const lilac = []
  const ember = []
  const beads = []
  const free = (x, z, gap) =>
    holeDistance(x, z) > hole.r + 2.2 &&
    !niches.some(([nx, , nz]) => Math.hypot(nx - x, nz - z) < 2.6) &&
    !sites.some((s) => Math.hypot(s.x - x, s.z - z) < gap)

  const pick = (kind, want) => {
    let n = 0
    for (let tries = 0; tries < want * 80 && n < want; tries++) {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * radius * 0.97
      const x = centre.x + Math.cos(a) * d
      const z = centre.z + Math.sin(a) * d
      const room = clearance(x, z)
      if (kind === 'floor' && room < 2.2) continue
      if (kind === 'hang' && room < 3.2) continue
      if (kind === 'wall') {
        /* Where the vault sweeps down steeply: a wall. */
        if (room < 0.5 || room > 3) continue
        const nrm = fieldNormal(underworldCeiling, x, z, true)
        if (Math.abs(nrm[1]) > 0.75) continue
      }
      if (!free(x, z, kind === 'wall' ? 3.2 : 4.5)) continue
      sites.push({ x, z, kind, room })
      n++
    }
  }
  pick('floor', 11)
  pick('wall', 10)
  pick('hang', 5)

  for (const site of sites) {
    const style = r() < 0.5 ? 'lilac' : 'ember'
    const onCeiling = site.kind !== 'floor'
    const surf = onCeiling ? underworldCeiling : underworldFloor
    const n = fieldNormal(surf, site.x, site.z, onCeiling)
    const S =
      site.kind === 'floor'
        ? Math.min(site.room * 0.38, 0.55 + Math.pow(r(), 1.4) * 1.5)
        : site.kind === 'wall'
          ? 0.35 + r() * 0.7
          : Math.min(site.room * 0.28, 0.4 + r() * 0.8)
    const count = 5 + Math.floor(r() * (site.kind === 'floor' ? 9 : 6))
    const fan = r() * Math.PI * 2
    for (let i = 0; i < count; i++) {
      const main = i === 0
      const tall = i < 3
      const ang = r() * Math.PI * 2
      const rad = main ? 0 : Math.pow(r(), 0.7) * S * (site.kind === 'wall' ? 0.35 : 0.6)
      const x = site.x + Math.cos(ang) * rad
      const z = site.z + Math.sin(ang) * rad
      const h = S * (main ? 1 : tall ? 0.55 + r() * 0.35 : 0.16 + Math.pow(r(), 1.5) * 0.45)
      const lean = main ? 0.06 + r() * 0.08 : tall ? 0.15 + r() * 0.2 : 0.35 + r() * 0.7
      const axis = tilt(n, lean, main ? fan : ang + (r() - 0.5) * 0.9)
      const base = [x, surf(x, z), z]
      const sink = h * (main || tall ? 0.12 : 0.22)
      const p = [base[0] - axis[0] * sink, base[1] - axis[1] * sink, base[2] - axis[2] * sink]
      if (style === 'lilac') {
        lilac.push({ x: p[0], y: p[1], z: p[2], axis, spin: r() * Math.PI, height: h, width: h * (0.26 + r() * 0.12), phantom: h > S * 0.55 })
      } else {
        const t = r()
        const habit = tall ? (t < 0.55 ? 'long' : t < 0.85 ? 'stout' : 'tapered') : t < 0.3 ? 'long' : t < 0.55 ? 'stout' : t < 0.8 ? 'tapered' : 'broken'
        const ratio = { long: 0.17, stout: 0.3, tapered: 0.2, broken: 0.24 }[habit] * (0.8 + r() * 0.45)
        ember.push({ x: p[0], y: p[1], z: p[2], axis, spin: r() * Math.PI * 2, height: h, width: h * ratio, depth: 0.75 + r() * 0.35, tint: r(), habit })
      }
    }
    /* Frost beads where floor druses meet the sand. */
    if (site.kind === 'floor') {
      const k = 6 + Math.floor(r() * 8)
      for (let b = 0; b < k; b++) {
        const ang = r() * Math.PI * 2
        const rad = S * (0.3 + r() * 0.9)
        const x = site.x + Math.cos(ang) * rad
        const z = site.z + Math.sin(ang) * rad
        const size = 0.03 + r() * 0.05
        beads.push({ x, y: underworldFloor(x, z) + size * 0.3, z, size })
      }
    }
  }
  return { lilac, ember, beads, sites }
}

/** The cavern's skin: the throat's dark oil-film sand, a little darker. */
export function createCaveSkinMaterial({ side = THREE.FrontSide } = {}) {
  const mat = createGroundMaterial({ caustic: 0, grain: 0.14 })
  mat.color.set('#77708a')
  mat.side = side
  mat.roughness = 0.4
  mat.iridescence = 1
  mat.iridescenceThicknessRange = [140, 1050]
  mat.envMapIntensity = 0.65
  mat.userData.uniforms.uFilm.value = 0.62
  return mat
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _v = new THREE.Vector3()

export function createCaveResources() {
  const floorGeo = buildFloorGeometry()
  const floorMat = createCaveSkinMaterial()
  const ceilingGeo = buildCeilingGeometry()
  const ceilingMat = createCaveSkinMaterial({ side: THREE.DoubleSide })

  const layout = underworldClusters()
  const disposables = [floorGeo, floorMat, ceilingGeo, ceilingMat]
  const crystals = new THREE.Group()

  /* Lilac quartz, with milky phantoms in the bigger ones. */
  const prismGeo = createPrismCrystalGeometry({ taper: 0.1 })
  const lilacMat = createOutcropCrystalMaterial({ emissiveIntensity: 0.06 })
  const phantomMat = createOutcropPhantomMaterial()
  disposables.push(prismGeo, lilacMat, phantomMat)
  const lilac = new THREE.InstancedMesh(prismGeo, lilacMat, Math.max(1, layout.lilac.length))
  layout.lilac.forEach((c, i) => {
    orientAlong(_q, _v.set(...c.axis), c.spin)
    lilac.setMatrixAt(i, _m.compose(_p.set(c.x, c.y, c.z), _q, _s.set(c.width, c.height / PRISM_HEIGHT, c.width)))
  })
  lilac.count = layout.lilac.length
  applyOutcropTints(lilac, layout.lilac)
  const phList = layout.lilac.filter((c) => c.phantom)
  const phantoms = new THREE.InstancedMesh(prismGeo, phantomMat, Math.max(1, phList.length))
  phList.forEach((c, i) => {
    orientAlong(_q, _v.set(...c.axis), c.spin + 0.5)
    const k = c.height * 0.12
    phantoms.setMatrixAt(i, _m.compose(_p.set(c.x + c.axis[0] * k, c.y + c.axis[1] * k, c.z + c.axis[2] * k), _q, _s.set(c.width * 0.42, (c.height * 0.62) / PRISM_HEIGHT, c.width * 0.42)))
  })
  phantoms.count = phList.length
  crystals.add(lilac, phantoms)

  /* Ember columns, one mesh per habit. */
  const emberMat = createEmberMaterial()
  emberMat.userData.uniforms.uSand.value.set('#7a7189')
  disposables.push(emberMat)
  for (const [habit, params] of Object.entries(EMBER_HABITS)) {
    const list = layout.ember.filter((c) => c.habit === habit)
    if (!list.length) continue
    const geo = createEmberColumnGeometry(params)
    disposables.push(geo)
    const mesh = new THREE.InstancedMesh(geo, emberMat, list.length)
    list.forEach((c, i) => {
      orientAlong(_q, _v.set(...c.axis), c.spin)
      mesh.setMatrixAt(i, _m.compose(_p.set(c.x, c.y, c.z), _q, _s.set(c.width, c.height, c.width * c.depth)))
      mesh.setColorAt(i, emberTintFor(c.tint))
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    crystals.add(mesh)
  }

  const beadGeo = createBeadGeometry()
  const beadMat = createBeadMaterial({ emissiveIntensity: 0.05 })
  disposables.push(beadGeo, beadMat)
  const beads = new THREE.InstancedMesh(beadGeo, beadMat, Math.max(1, layout.beads.length))
  layout.beads.forEach((b, i) => beads.setMatrixAt(i, _m.compose(_p.set(b.x, b.y, b.z), _q.identity(), _s.set(b.size, b.size, b.size))))
  beads.count = layout.beads.length
  crystals.add(beads)
  for (const c of crystals.children) {
    c.instanceMatrix.needsUpdate = true
    c.computeBoundingSphere()
  }

  const objects = [new THREE.Mesh(floorGeo, floorMat), new THREE.Mesh(ceilingGeo, ceilingMat), crystals]
  return {
    objects,
    floorMat,
    ceilingMat,
    emberMat,
    lilacMat,
    dispose() {
      for (const d of disposables) d.dispose()
      for (const c of crystals.children) c.dispose?.()
    },
  }
}
