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
import { fbm2 } from '../../worldFinal/noise.js'
import { LIGHT_DIR } from './habitatShaders.js'
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

/**
 * Floor light, after a real cavern: dark overall (as dark as the walls),
 * with the light that falls through the hole landing as a pool on the sand —
 * the opening's shape thrown a little along the light, its edge broken by
 * the rim's shadow — plus a few stray patches and a faint fill near it.
 */
export function floorLight(x, z) {
  const { hole } = UNDERWORLD
  const L = LIGHT_DIR
  const throw_ = 3.2
  const px = hole.x - (L.x / L.y) * throw_
  const pz = hole.z - (L.z / L.y) * throw_
  const ang = Math.atan2(z - pz, x - px)
  const rim = holeShape(ang).inner
  const d = Math.hypot(x - px, z - pz)
  const edge = 0.95 + 0.3 * (0.5 + 0.5 * fbm2(HABITAT_SEED + 611, x * 0.45, z * 0.45, { octaves: 3 }))
  const pool = 1 - smoothstep(rim * 0.7, rim * edge, d)
  /* the rim's own lumps cast shadow fingers into the pool */
  const fingers = smoothstep(0.1, 0.45, 0.5 + 0.5 * fbm2(HABITAT_SEED + 619, Math.cos(ang) * 3 + d * 0.15, Math.sin(ang) * 3, { octaves: 2 }))
  const dh = Math.max(0, holeDistance(x, z) - hole.r)
  const stray = smoothstep(0.62, 0.8, 0.5 + 0.5 * fbm2(HABITAT_SEED + 627, x * 0.35, z * 0.35, { octaves: 2 })) * Math.exp(-dh / 7)
  return 0.035 + 0.07 * Math.exp(-dh / 5) + 0.62 * pool * (0.4 + 0.6 * fingers) + 0.16 * stray
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function layer(heightAt, { shade = 1, skip = null, light = null } = {}) {
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
    const k = light ? light(x, z) : holeLight(x, z) * shade * 0.6
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
  return layer((x, z) => underworldFloor(x, z), { light: floorLight })
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
 * meet the floor) and hanging from the vault. They grow in colonies: a few
 * mineral patches, each with a heart druse and smaller druses packed around
 * it, and bare rock between. Each druse is one dominant crystal and a dense
 * fan of companions that splay outward and shorten toward the rim. Kept
 * clear of the hole and of the niches where kept remains rest.
 * Returns { lilac, ember, beads, sites, patches }.
 */
export function underworldClusters(seed = HABITAT_SEED + 515) {
  const r = habitatRng(seed)
  const { centre, radius, hole } = UNDERWORLD
  const niches = remainNiches(40)
  const sites = []
  const patches = []
  const lilac = []
  const ember = []
  const beads = []
  const clearOfHoleAndRemains = (x, z) =>
    holeDistance(x, z) > hole.r + 2.2 && !niches.some(([nx, , nz]) => Math.hypot(nx - x, nz - z) < 2.6)

  /* Whether (x, z) can hold a druse of this kind (room, wall slope). */
  const fits = (kind, x, z) => {
    const room = clearance(x, z)
    if (kind === 'floor') return room >= 2.2 ? room : 0
    if (kind === 'hang') return room >= 3.2 ? room : 0
    /* Where the vault sweeps down steeply: a wall. */
    if (room < 0.5 || room > 3) return 0
    const nrm = fieldNormal(underworldCeiling, x, z, true)
    return Math.abs(nrm[1]) > 0.75 ? 0 : room
  }

  /* 1 · Patches: where the rock was mineral enough to grow anything. Crystals
     come in colonies, not evenly spread: a few rich patches, bare rock
     between them. Each patch mostly keeps to one kind of crystal. */
  const seedPatches = (kind, want, gap) => {
    for (let tries = 0, n = 0; tries < want * 120 && n < want; tries++) {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * radius * 0.95
      const x = centre.x + Math.cos(a) * d
      const z = centre.z + Math.sin(a) * d
      if (!fits(kind, x, z) || !clearOfHoleAndRemains(x, z)) continue
      if (patches.some((p) => Math.hypot(p.x - x, p.z - z) < gap)) continue
      const t = r()
      patches.push({ x, z, kind, style: t < 0.46 ? 'lilac' : t < 0.92 ? 'ember' : 'mixed', spread: kind === 'floor' ? 1.4 + r() * 1.6 : 1 + r() * 1.1 })
      n++
    }
  }
  seedPatches('floor', 13, 4.6)
  seedPatches('wall', 9, 4)
  seedPatches('hang', 5, 4.5)

  /* 2 · Druses inside each patch: a heart druse and smaller ones packed
     around it (denser toward the middle). */
  for (const patch of patches) {
    const want = patch.kind === 'floor' ? 3 + Math.floor(r() * 4) : patch.kind === 'wall' ? 2 + Math.floor(r() * 3) : 2 + Math.floor(r() * 2)
    let heart = null
    for (let tries = 0, n = 0; tries < want * 30 && n < want; tries++) {
      const first = n === 0
      const a = r() * Math.PI * 2
      const d = first ? 0 : (0.35 + Math.pow(r(), 0.8)) * patch.spread
      const x = patch.x + Math.cos(a) * d
      const z = patch.z + Math.sin(a) * d
      const room = fits(patch.kind, x, z)
      if (!room || !clearOfHoleAndRemains(x, z)) continue
      if (sites.some((s) => Math.hypot(s.x - x, s.z - z) < (first ? 1.6 : 0.85))) continue
      const site = { x, z, kind: patch.kind, room, heart: first, style: patch.style === 'mixed' ? (r() < 0.5 ? 'lilac' : 'ember') : r() < 0.88 ? patch.style : patch.style === 'lilac' ? 'ember' : 'lilac' }
      if (first) heart = site
      sites.push(site)
      n++
    }
    patch.heart = heart
  }

  /* 3 · Each druse: one dominant crystal and many companions growing from a
     shared base. They splay outward the further they stand from the middle,
     and shorten toward the rim, so the druse reads as one fan. */
  for (const site of sites) {
    const style = site.style
    const onCeiling = site.kind !== 'floor'
    const surf = onCeiling ? underworldCeiling : underworldFloor
    const n = fieldNormal(surf, site.x, site.z, onCeiling)
    const base =
      site.kind === 'floor'
        ? Math.min(site.room * 0.38, 0.55 + Math.pow(r(), 1.3) * 1.4)
        : site.kind === 'wall'
          ? 0.4 + r() * 0.65
          : Math.min(site.room * 0.28, 0.45 + r() * 0.75)
    const S = base * (site.heart ? 1.15 : 0.55 + r() * 0.35)
    const count = site.kind === 'floor' ? 9 + Math.floor(r() * 9) : site.kind === 'wall' ? 7 + Math.floor(r() * 5) : 6 + Math.floor(r() * 5)
    const reach = S * (site.kind === 'wall' ? 0.42 : 0.55)
    const fan = r() * Math.PI * 2
    for (let i = 0; i < count; i++) {
      const main = i === 0
      const tall = i < 4
      const ang = r() * Math.PI * 2
      const u = main ? 0 : Math.pow(r(), tall ? 1.4 : 0.75)
      const rad = u * reach
      const x = site.x + Math.cos(ang) * rad
      const z = site.z + Math.sin(ang) * rad
      const rim = 1 - 0.5 * u
      const h = S * rim * (main ? 1 : tall ? 0.55 + r() * 0.35 : 0.14 + Math.pow(r(), 1.4) * 0.45)
      const lean = main ? 0.05 + r() * 0.08 : 0.1 + u * (tall ? 0.45 : 0.85) + r() * 0.15
      const axis = tilt(n, lean, main ? fan : ang + (r() - 0.5) * 0.5)
      const ground = [x, surf(x, z), z]
      const sink = h * (main || tall ? 0.12 : 0.22)
      const p = [ground[0] - axis[0] * sink, ground[1] - axis[1] * sink, ground[2] - axis[2] * sink]
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
      const k = 5 + Math.floor(r() * 7)
      for (let b = 0; b < k; b++) {
        const ang = r() * Math.PI * 2
        const rad = S * (0.35 + r() * 0.8)
        const x = site.x + Math.cos(ang) * rad
        const z = site.z + Math.sin(ang) * rad
        const size = 0.03 + r() * 0.05
        beads.push({ x, y: underworldFloor(x, z) + size * 0.3, z, size })
      }
    }
  }

  /* 4 · Strays: single crystals and broken pieces shed around the floor
     patches (thinning out with distance), and a few far from any. */
  const floorPatches = patches.filter((p) => p.kind === 'floor')
  for (let i = 0, tries = 0; i < 70 && tries < 2400; tries++) {
    let x
    let z
    let style
    if (floorPatches.length && i < 58) {
      const p = floorPatches[Math.floor(r() * floorPatches.length)]
      const a = r() * Math.PI * 2
      const d = p.spread * (1.1 + Math.pow(r(), 1.8) * 2.4)
      x = p.x + Math.cos(a) * d
      z = p.z + Math.sin(a) * d
      style = p.style === 'mixed' ? (r() < 0.5 ? 'lilac' : 'ember') : p.style
    } else {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * radius * 0.95
      x = centre.x + Math.cos(a) * d
      z = centre.z + Math.sin(a) * d
      style = r() < 0.5 ? 'lilac' : 'ember'
    }
    const room = clearance(x, z)
    if (room < 1.4 || holeDistance(x, z) < hole.r + 1.8) continue
    if (niches.some(([nx, , nz]) => Math.hypot(nx - x, nz - z) < 2.2)) continue
    const n = fieldNormal(underworldFloor, x, z, false)
    const h = Math.min(room * 0.3, 0.14 + Math.pow(r(), 1.8) * 0.45)
    const lying = r() < 0.35
    const axis = tilt(n, lying ? 1.25 + r() * 0.25 : 0.2 + r() * 0.6, r() * Math.PI * 2)
    const sink = h * (lying ? 0.05 : 0.2)
    const y = underworldFloor(x, z)
    const p = [x - axis[0] * sink, y - axis[1] * sink, z - axis[2] * sink]
    if (style === 'lilac') lilac.push({ x: p[0], y: p[1], z: p[2], axis, spin: r() * Math.PI, height: h, width: h * (0.28 + r() * 0.1), phantom: false })
    else {
      const habit = r() < 0.5 ? 'long' : r() < 0.5 ? 'stout' : 'broken'
      ember.push({ x: p[0], y: p[1], z: p[2], axis, spin: r() * Math.PI * 2, height: h, width: h * 0.24, depth: 0.8 + r() * 0.3, tint: r(), habit })
    }
    i++
  }
  return { lilac, ember, beads, sites, patches }
}

/** The cavern's skin: the throat's dark oil-film sand, a little darker. */
export function createCaveSkinMaterial({ side = THREE.FrontSide } = {}) {
  const mat = createGroundMaterial({ caustic: 0, grain: 0.14 })
  mat.color.set('#5d576e')
  mat.side = side
  mat.roughness = 0.4
  mat.iridescence = 1
  mat.iridescenceThicknessRange = [140, 1050]
  mat.envMapIntensity = 0.45
  mat.userData.uniforms.uFilm.value = 0.42
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
  /* The floor reads by its light pool: a quiet film and few reflections. */
  floorMat.userData.uniforms.uFilm.value = 0.08
  floorMat.envMapIntensity = 0.1
  floorMat.color.set('#4a4257')
  /* No sheen or strong film on the cavern sand: those light it regardless
     of where the light falls. */
  floorMat.sheen = 0
  floorMat.iridescence = 0.35
  floorMat.roughness = 0.62
  const ceilingGeo = buildCeilingGeometry()
  const ceilingMat = createCaveSkinMaterial({ side: THREE.DoubleSide })

  const layout = underworldClusters()
  const disposables = [floorGeo, floorMat, ceilingGeo, ceilingMat]
  const crystals = new THREE.Group()

  /* Lilac quartz, with milky phantoms in the bigger ones. */
  const prismGeo = createPrismCrystalGeometry({ taper: 0.1 })
  /* Brighter than on the surface: they light the dark cavern a little. */
  const lilacMat = createOutcropCrystalMaterial({ emissiveIntensity: 0.16 })
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
