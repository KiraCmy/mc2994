/**
 * Exp03 Study 01 — biomineralized growth geometry (visual only).
 * Crystal meshes: convex planar polyhedra (crystalPolyhedronGeometry.js).
 * Soft tissue / transition helpers remain for optional layers (hidden in Study 01).
 * Later bindable to Growth Site Agents; no simulation side-effects here.
 */
import * as THREE from 'three'
import {
  createCrystalPolyhedronGeometry,
  createCrystalPolyhedronGeometrySet,
  EXP03_POLYHEDRON_PROFILES,
} from './crystalPolyhedronGeometry.js'
import { normalizeExp03MorphologyParams } from './crystalMorphologyParams.js'

/**
 * Unit crystal profiles — convex planar-faced polyhedra.
 * Local Y: base ~0 → tip ~1.
 */
export const EXP03_CRYSTAL_PROFILES = EXP03_POLYHEDRON_PROFILES.map((p) => ({
  ...p,
}))

/** Soft membrane-integration tissue sheets (unit). */
export const EXP03_TISSUE_PROFILES = [
  { lobes: 1, reach: 1, rise: 0.22, curl: 0.18 },
  { lobes: 1, reach: 1, rise: 0.28, curl: 0.24 },
  { lobes: 1, reach: 1, rise: 0.2, curl: 0.14 },
]

/** Transitional blades: organic sheet → faceted mid-body. */
export const EXP03_TRANSITION_PROFILES = [
  { widthSegs: 8, lengthSegs: 10, flare: 1.35, thicken: 0.55 },
  { widthSegs: 7, lengthSegs: 9, flare: 1.2, thicken: 0.48 },
  { widthSegs: 9, lengthSegs: 11, flare: 1.45, thicken: 0.62 },
]

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function pushFace(positions, a, b, c) {
  positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2])
}

/**
 * Emit a triangle with a single planar face normal (no smooth averaging).
 * Critical for readable crystal facets under flatShading.
 */
function pushFacet(positions, normals, a, b, c) {
  const ax = b[0] - a[0]
  const ay = b[1] - a[1]
  const az = b[2] - a[2]
  const bx = c[0] - a[0]
  const by = c[1] - a[1]
  const bz = c[2] - a[2]
  let nx = ay * bz - az * by
  let ny = az * bx - ax * bz
  let nz = ax * by - ay * bx
  const len = Math.hypot(nx, ny, nz) || 1
  nx /= len
  ny /= len
  nz /= len
  positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2])
  normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz)
}

/**
 * Polyhedral mineral crystal (large planar facets).
 * Delegates to createCrystalPolyhedronGeometry — ConvexGeometry hull.
 * Local Y: base 0 → tip 1.
 */
export function createClusterShardGeometry(options = {}) {
  return createCrystalPolyhedronGeometry(options)
}

/**
 * Shared mineral mound — continuous emergence from the membrane.
 * Soft radial lobes that rise into a common center (not a flat sticker).
 */
export function createCrystalApronGeometry({ lobes = 7, seed = 1 } = {}) {
  const lobeCount = Math.max(5, Math.min(9, Math.round(lobes)))
  const positions = []
  const rng = (n) => (Math.imul(seed ^ (n + 1), 2654435761) >>> 0) / 4294967296

  for (let layer = 0; layer < 3; layer += 1) {
    const lift = 0.01 + layer * 0.038
    const scale = 1 - layer * 0.18
    const center = [0, lift + 0.035 * (1 - layer * 0.25), 0]
    for (let lobe = 0; lobe < lobeCount; lobe += 1) {
      const baseAngle =
        (lobe / lobeCount) * Math.PI * 2 + layer * 0.28 + rng(lobe + layer * 11) * 0.25
      const spread = 0.85 + rng(lobe * 3 + layer) * 0.4
      const reach = (1.05 + rng(lobe * 3 + 1 + layer) * 0.55) * scale
      const segs = 8
      for (let s = 0; s < segs; s += 1) {
        const t0 = s / segs
        const t1 = (s + 1) / segs
        const a0 = baseAngle + (t0 - 0.5) * spread
        const a1 = baseAngle + (t1 - 0.5) * spread
        const profile = (t) => 0.35 + Math.sin(t * Math.PI) * 0.65
        const r0 = reach * profile(t0)
        const r1 = reach * profile(t1)
        /* Outer rim hugs membrane; center rises into the growth mound. */
        const y0 =
          lift * (0.35 + (1 - t0) * 0.9) + Math.pow(1 - t0, 1.6) * 0.06
        const y1 =
          lift * (0.35 + (1 - t1) * 0.9) + Math.pow(1 - t1, 1.6) * 0.06
        pushFace(
          positions,
          center,
          [Math.cos(a0) * r0, y0, Math.sin(a0) * r0],
          [Math.cos(a1) * r1, y1, Math.sin(a1) * r1],
        )
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.name = 'Exp03 biomineral mound'
  return geometry
}

/**
 * Thin organic tissue sheet — membrane integration layer.
 * Local: origin at root, +Y outward, thin Z thickness, broad X/Y silhouette.
 */
export function createMembraneTissueGeometry({
  reach = 1,
  rise = 0.24,
  curl = 0.2,
  seed = 1,
} = {}) {
  const positions = []
  const lengthSegs = 10
  const widthSegs = 8
  const rng = (n) => (Math.imul(seed ^ (n + 3), 2246822507) >>> 0) / 4294967296
  const halfThick = 0.035

  const sample = (u, v) => {
    const y = u * reach
    const x = v * (0.55 + u * 0.75) * (0.85 + rng(Math.floor(u * 20)) * 0.2)
    const lift =
      Math.sin(u * Math.PI) * rise * (0.55 + (1 - Math.abs(v)) * 0.45) +
      u * rise * 0.35
    const sideCurl = v * curl * u * u
    return {
      x: x + sideCurl,
      y: lift,
      z: y,
    }
  }

  for (let i = 0; i < lengthSegs; i += 1) {
    for (let j = 0; j < widthSegs; j += 1) {
      const u0 = i / lengthSegs
      const u1 = (i + 1) / lengthSegs
      const v0 = j / widthSegs * 2 - 1
      const v1 = (j + 1) / widthSegs * 2 - 1
      const p00 = sample(u0, v0)
      const p10 = sample(u1, v0)
      const p01 = sample(u0, v1)
      const p11 = sample(u1, v1)
      /* Thin shell: offset slightly along local "up" (Y) for volume. */
      const top = (p) => [p.x, p.y + halfThick * (1 - p.z * 0.4), p.z]
      const bot = (p) => [p.x, p.y - halfThick * 0.35, p.z]
      const a = top(p00)
      const b = top(p10)
      const c = top(p11)
      const d = top(p01)
      pushFace(positions, a, b, c)
      pushFace(positions, a, c, d)
      const a2 = bot(p00)
      const b2 = bot(p10)
      const c2 = bot(p11)
      const d2 = bot(p01)
      pushFace(positions, a2, c2, b2)
      pushFace(positions, a2, d2, c2)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.name = 'Exp03 membrane tissue'
  return geometry
}

/**
 * Transitional blade — sheet near root, thickening / faceting toward tip.
 * Bridges soft tissue and rigid crystal.
 */
export function createTransitionBladeGeometry({
  widthSegs = 8,
  lengthSegs = 10,
  flare = 1.3,
  thicken = 0.55,
  seed = 1,
} = {}) {
  const positions = []
  const wSegs = Math.max(5, Math.min(12, Math.round(widthSegs)))
  const lSegs = Math.max(6, Math.min(14, Math.round(lengthSegs)))
  const rng = (n) => (Math.imul(seed ^ (n + 5), 3266489909) >>> 0) / 4294967296

  const sampleEdge = (u, v) => {
    /* u along growth, v across blade [-1,1] */
    const width = (0.55 + (1 - u) * 0.75 * flare) * (0.9 + rng(Math.floor(u * 12)) * 0.15)
    const x = v * width * 0.5
    const y = u
    const curve = Math.sin(u * Math.PI) * 0.12 * (0.6 + rng(3) * 0.4)
    const z = curve * (1 - Math.abs(v) * 0.35)
    /* Thickness grows from paper-thin root to faceted mid/tip. */
    const thick =
      0.04 +
      Math.pow(u, 1.15) * thicken * (0.55 + (1 - Math.abs(v)) * 0.45)
    return { x, y, z, thick }
  }

  for (let i = 0; i < lSegs; i += 1) {
    for (let j = 0; j < wSegs; j += 1) {
      const u0 = i / lSegs
      const u1 = (i + 1) / lSegs
      const v0 = (j / wSegs) * 2 - 1
      const v1 = ((j + 1) / wSegs) * 2 - 1
      const s00 = sampleEdge(u0, v0)
      const s10 = sampleEdge(u1, v0)
      const s01 = sampleEdge(u0, v1)
      const s11 = sampleEdge(u1, v1)

      const face = (s, sign) => [
        s.x,
        s.y,
        s.z + sign * s.thick * 0.5,
      ]
      /* Front */
      pushFace(positions, face(s00, 1), face(s10, 1), face(s11, 1))
      pushFace(positions, face(s00, 1), face(s11, 1), face(s01, 1))
      /* Back */
      pushFace(positions, face(s00, -1), face(s11, -1), face(s10, -1))
      pushFace(positions, face(s00, -1), face(s01, -1), face(s11, -1))
    }
  }

  /* Tip cap — begins to read as a facet */
  const tipL = sampleEdge(1, -0.55)
  const tipR = sampleEdge(1, 0.55)
  const tipC = sampleEdge(1, 0)
  const apex = [0, 1.02, tipC.z]
  pushFace(
    positions,
    [tipL.x, tipL.y, tipL.z + tipL.thick * 0.5],
    apex,
    [tipR.x, tipR.y, tipR.z + tipR.thick * 0.5],
  )
  pushFace(
    positions,
    [tipR.x, tipR.y, tipR.z - tipR.thick * 0.5],
    apex,
    [tipL.x, tipL.y, tipL.z - tipL.thick * 0.5],
  )

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.name = 'Exp03 transition blade'
  return geometry
}

export function createClusterShardGeometrySet(seed = 41) {
  return createCrystalPolyhedronGeometrySet(seed)
}

export function createMembraneTissueGeometrySet() {
  return EXP03_TISSUE_PROFILES.map((profile, index) =>
    createMembraneTissueGeometry({ ...profile, seed: 11 + index * 17 }),
  )
}

export function createTransitionBladeGeometrySet() {
  return EXP03_TRANSITION_PROFILES.map((profile, index) =>
    createTransitionBladeGeometry({ ...profile, seed: 23 + index * 13 }),
  )
}

/** Deterministic [0,1) from integer keys. */
export function exp03Hash01(...keys) {
  let h = 2166136261 >>> 0
  for (const key of keys) {
    h ^= Math.imul(Math.floor(Number(key) || 0), 16777619)
    h = Math.imul(h ^ (h >>> 13), 2246822507)
    h = Math.imul(h ^ (h >>> 16), 3266489909)
  }
  return (h >>> 0) / 4294967296
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function orthonormalBasis(axis) {
  const up = new THREE.Vector3().fromArray(axis).normalize()
  const helper =
    Math.abs(up.y) < 0.9
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0)
  const right = new THREE.Vector3().crossVectors(helper, up).normalize()
  const forward = new THREE.Vector3().crossVectors(up, right).normalize()
  return { up, right, forward }
}

/**
 * Biomineralized growth plan — hierarchical branching morphology.
 * Roles: tissue → transition → primary → secondary → tertiary crystal.
 */
export function planCrystalCluster(
  site,
  {
    seed = 0,
    clusterDensity = 0.85,
    branching = 0.75,
    lengthVariation = 0.55,
    dissolve = 0,
    /** Study 01 geometry focus: crystals only (no tissue / transition). */
    crystalOnly = false,
    morphology = null,
  } = {},
) {
  const crystal = site?.crystal
  if (!crystal) return []

  const maturity = clamp(
    Number(crystal.length) / Math.max(1e-4, Number(crystal.maxLength) || 0.4),
    0,
    1.15,
  )
  const density = clamp(clusterDensity, 0, 1)
  const branchAmt = clamp(branching, 0, 1)
  const variation = clamp(lengthVariation, 0, 1)
  const live = 1 - clamp(dissolve, 0, 1)
  const appear = smoothstep(0.08, 0.55, maturity) * live
  if (appear < 0.02) return []

  const outward = site.direction ?? crystal.growthDirection ?? [0, 1, 0]
  const { up, right, forward } = orthonormalBasis(outward)
  const siteId = site.id | 0
  const baseLength = Math.max(0.04, Number(crystal.length) || 0.35)
  const pieces = []
  const roll0 = site.roll || 0

  if (!crystalOnly) {
    /* —— 1. Membrane tissue: overlapping sheets from shared root —— */
    const tissueCount = 5 + Math.round(density * 3)
    for (let i = 0; i < tissueCount; i += 1) {
      const u = exp03Hash01(seed, siteId, i, 3)
      const v = exp03Hash01(seed, siteId, i, 11)
      const azimuth =
        (i / tissueCount) * Math.PI * 2 + roll0 * 0.2 + (u - 0.5) * 0.35
      const lean = 1.05 + v * 0.55
      const axis = up
        .clone()
        .addScaledVector(right, Math.cos(azimuth) * lean)
        .addScaledVector(forward, Math.sin(azimuth) * lean)
        .normalize()
      const length = baseLength * (0.22 + u * 0.18) * appear
      const width = length * (0.85 + v * 0.45)
      const depth = length * (0.12 + u * 0.08)
      pieces.push({
        id: `t-${siteId}-${i}`,
        role: 'tissue',
        kind: 'tissue',
        axis: axis.toArray(),
        length,
        width,
        depth,
        roll: azimuth + u * 0.6,
        profileIndex: i % EXP03_TISSUE_PROFILES.length,
        nest: 0.004 + u * 0.008,
        radial: 0.008 + v * 0.022,
        radialAngle: azimuth,
        tint: 0.1 + u * 0.25,
      })
    }

    /* —— 2. Transitional blades —— */
    const transitionCount = 3 + Math.round(branchAmt * 2)
    for (let i = 0; i < transitionCount; i += 1) {
      const u = exp03Hash01(seed, siteId, i + 30, 5)
      const v = exp03Hash01(seed, siteId, i + 30, 17)
      const w = exp03Hash01(seed, siteId, i + 30, 29)
      const azimuth =
        ((i + 0.5) / transitionCount) * Math.PI * 2 +
        roll0 * 0.15 +
        (u - 0.5) * 0.55
      const lean = 0.4 + v * 0.4
      const axis = up
        .clone()
        .addScaledVector(right, Math.cos(azimuth) * lean)
        .addScaledVector(forward, Math.sin(azimuth) * lean)
        .normalize()
      const length = baseLength * (0.22 + w * 0.18) * appear
      const width = length * (0.55 + u * 0.25)
      const depth = length * (0.28 + v * 0.16)
      pieces.push({
        id: `x-${siteId}-${i}`,
        role: 'transition',
        kind: 'transition',
        axis: axis.toArray(),
        length,
        width,
        depth,
        roll: azimuth * 0.5 + v,
        profileIndex: i % EXP03_TRANSITION_PROFILES.length,
        nest: 0.01 + u * 0.012,
        radial: 0.014 + v * 0.022,
        radialAngle: azimuth,
        tint: 0.25 + u * 0.35,
      })
    }
  }

  /*
   * Reference-matching mineral formation (static).
   * Dense root carpet + 2 dominant primaries + side-emerging secondaries/tertiaries.
   * Face-aware seating is applied downstream; here we encode hierarchy + attach params.
   */
  const morph = normalizeExp03MorphologyParams({
    cohesion: 0.88,
    membraneEmbed: 0.05,
    secondaryPerPrimary: 2.2,
    tertiaryChance: 0.72,
    tertiaryBudget: 8,
    primarySlenderness: 2.15,
    branchSlenderness: 2.25,
    branchLean: 0.68,
    attachMean: 0.28,
    intergrowthChance: 0,
    formationScale: 1.05,
    ...(morphology || {}),
  })

  const primaryCount = 2 + (exp03Hash01(seed, siteId, 2) > 0.72 ? 1 : 0)
  const primaries = []
  const formationLen = baseLength * morph.formationScale * appear

  for (let i = 0; i < primaryCount; i += 1) {
    const u = exp03Hash01(seed, siteId, i + 60, 7)
    const v = exp03Hash01(seed, siteId, i + 60, 19)
    const w = exp03Hash01(seed, siteId, i + 60, 37)
    /* Two dominant leans like the reference — not a radial bouquet. */
    const azimuth =
      i === 0
        ? roll0 * 0.1 - 0.55 + (u - 0.5) * 0.35
        : i === 1
          ? roll0 * 0.1 + 0.35 + (v - 0.5) * 0.4
          : roll0 * 0.1 + 1.4 + (w - 0.5) * 0.5
    const lean = i === 0 ? 0.28 + u * 0.18 : i === 1 ? 0.08 + v * 0.12 : 0.18 + w * 0.15
    const axis = up
      .clone()
      .addScaledVector(right, Math.cos(azimuth) * lean)
      .addScaledVector(forward, Math.sin(azimuth) * lean)
      .normalize()
    const lengthScale = i === 0 ? 1.18 : i === 1 ? 0.92 : 0.7
    const length = formationLen * (0.7 + w * 0.12) * lengthScale
    const width = length / (morph.primarySlenderness + u * 0.25)
    const depth = width * (0.78 + v * 0.22)
    const piece = {
      id: `p-${siteId}-${i}`,
      role: 'primary',
      kind: 'crystal',
      parentId: null,
      axis: axis.toArray(),
      length,
      width,
      depth,
      roll: azimuth * 0.15 + u * 0.8,
      profileIndex:
        Math.abs((siteId + i * 3) | 0) % EXP03_CRYSTAL_PROFILES.length,
      meshSeed: seed * 131 + siteId * 17 + i * 97 + 11,
      nest: morph.membraneEmbed,
      radial: (0.008 + u * 0.012) * (1.1 - morph.cohesion),
      radialAngle: azimuth,
      tint: 0.15 + u * 0.55,
    }
    primaries.push(piece)
    pieces.push(piece)
  }

  /* Dense micro carpet at the shared root — membrane transition. */
  const microCount = 18 + Math.round(density * 10)
  for (let i = 0; i < microCount; i += 1) {
    const u = exp03Hash01(seed, siteId, i + 300, 5)
    const v = exp03Hash01(seed, siteId, i + 300, 13)
    const w = exp03Hash01(seed, siteId, i + 300, 21)
    const azimuth = (i / microCount) * Math.PI * 2 + (u - 0.5) * 0.8 + roll0 * 0.2
    const lean = 0.35 + v * 0.55
    const axis = up
      .clone()
      .addScaledVector(right, Math.cos(azimuth) * lean)
      .addScaledVector(forward, Math.sin(azimuth) * lean)
      .normalize()
    const length = formationLen * (0.08 + w * 0.1)
    const width = length / (1.7 + u * 0.5)
    const depth = width * (0.7 + v * 0.3)
    pieces.push({
      id: `micro-${siteId}-${i}`,
      role: 'micro',
      kind: 'crystal',
      parentId: null,
      axis: axis.toArray(),
      length,
      width,
      depth,
      roll: azimuth + u * 2,
      profileIndex:
        Math.abs((siteId + i * 11 + 5) | 0) % EXP03_CRYSTAL_PROFILES.length,
      meshSeed: seed * 251 + siteId * 31 + i * 47 + 3,
      nest: morph.membraneEmbed * (0.7 + u * 0.4),
      radial: formationLen * (0.04 + v * 0.14),
      radialAngle: azimuth,
      tint: 0.35 + u * 0.5,
    })
  }

  const secondaryBudget = clamp(
    Math.round(primaryCount * morph.secondaryPerPrimary),
    4,
    7,
  )
  const secondaries = []
  let secondaryIndex = 0
  for (let p = 0; p < primaryCount; p += 1) {
    const want = p === 0 ? 3 : 2
    const count = Math.min(want, secondaryBudget - secondaryIndex)
    const parent = primaries[p]
    const parentAxis = new THREE.Vector3().fromArray(parent.axis)
    const { right: pRight, forward: pForward } = orthonormalBasis(parent.axis)

    for (let k = 0; k < count; k += 1) {
      const i = secondaryIndex
      const u = exp03Hash01(seed, siteId, i + 90, 9)
      const v = exp03Hash01(seed, siteId, i + 90, 23)
      const w = exp03Hash01(seed, siteId, i + 90, 41)
      const sideAz =
        (k + 0.3) * (2.1 + u * 0.8) + p * 1.15 + (v - 0.5) * 1.1
      const branchLean = morph.branchLean * (0.7 + w * 0.35)
      const side = pRight
        .clone()
        .multiplyScalar(Math.cos(sideAz))
        .addScaledVector(pForward, Math.sin(sideAz))
        .normalize()
      const axis = parentAxis
        .clone()
        .multiplyScalar(1 - branchLean)
        .addScaledVector(side, branchLean)
        .normalize()
      const length = parent.length * (0.38 + u * 0.32)
      const width = length / (morph.branchSlenderness + v * 0.35)
      const depth = width * (0.72 + w * 0.26)
      const piece = {
        id: `s-${siteId}-${i}`,
        role: 'secondary',
        kind: 'crystal',
        parentId: parent.id,
        parentRole: 'primary',
        axis: axis.toArray(),
        length,
        width,
        depth,
        roll: sideAz * 0.35 + u,
        profileIndex:
          Math.abs((siteId + i * 5 + 2) | 0) % EXP03_CRYSTAL_PROFILES.length,
        meshSeed: seed * 191 + siteId * 23 + i * 113 + 41,
        nest: 0.01,
        attachAlong: 0.12 + v * 0.35,
        sideOffset: 0.92,
        sideAngle: sideAz,
        tint: 0.28 + u * 0.5,
      }
      secondaries.push(piece)
      pieces.push(piece)
      secondaryIndex += 1
      if (secondaryIndex >= secondaryBudget) break
    }
    if (secondaryIndex >= secondaryBudget) break
  }

  let tertiaryIndex = 0
  for (let s = 0; s < secondaries.length; s += 1) {
    if (tertiaryIndex >= morph.tertiaryBudget) break
    if (exp03Hash01(seed, siteId, s + 200, 3) > morph.tertiaryChance) continue
    const childCount = exp03Hash01(seed, siteId, s + 210, 7) > 0.55 ? 2 : 1
    const parent = secondaries[s]
    const parentAxis = new THREE.Vector3().fromArray(parent.axis)
    const { right: sRight, forward: sForward } = orthonormalBasis(parent.axis)

    for (let k = 0; k < childCount; k += 1) {
      if (tertiaryIndex >= morph.tertiaryBudget) break
      const i = tertiaryIndex
      const u = exp03Hash01(seed, siteId, i + 140, 5)
      const v = exp03Hash01(seed, siteId, i + 140, 17)
      const w = exp03Hash01(seed, siteId, i + 140, 31)
      const sideAz = k * 2.3 + u * Math.PI * 1.3 + s * 0.55 + (v - 0.5) * 1.2
      const branchLean = Math.min(0.9, morph.branchLean + 0.1 + w * 0.2)
      const side = sRight
        .clone()
        .multiplyScalar(Math.cos(sideAz))
        .addScaledVector(sForward, Math.sin(sideAz))
        .normalize()
      const axis = parentAxis
        .clone()
        .multiplyScalar(1 - branchLean)
        .addScaledVector(side, branchLean)
        .normalize()
      const length = parent.length * (0.36 + u * 0.28)
      const width = length / (morph.branchSlenderness + v * 0.3)
      const depth = width * (0.7 + w * 0.28)
      pieces.push({
        id: `ter-${siteId}-${i}`,
        role: 'tertiary',
        kind: 'crystal',
        parentId: parent.id,
        parentRole: 'secondary',
        axis: axis.toArray(),
        length,
        width,
        depth,
        roll: sideAz * 0.4 + u * 1.2,
        profileIndex:
          Math.abs((siteId + i * 7 + 4) | 0) % EXP03_CRYSTAL_PROFILES.length,
        meshSeed: seed * 223 + siteId * 29 + i * 131 + 73,
        nest: 0.008,
        attachAlong: 0.2 + v * 0.4,
        sideOffset: 0.9,
        sideAngle: sideAz,
        tint: 0.4 + u * 0.45,
      })
      tertiaryIndex += 1
    }
  }

  return pieces
}
