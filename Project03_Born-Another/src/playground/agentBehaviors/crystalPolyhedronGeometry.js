/**
 * Exp03 — planar-faced crystal polyhedra via convex hull.
 * Points define a crystallographic volume; ConvexGeometry yields true planar facets.
 * Local Y: base ~0 → tip ~1. Deterministic from seed.
 */
import * as THREE from 'three'
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js'

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}

function hash01(seed, ...keys) {
  let h = Math.imul(seed ^ 0x27d4eb2d, 2654435761) >>> 0
  for (const key of keys) {
    h ^= Math.imul(Math.floor(Number(key) || 0) + 1, 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
  }
  return (h >>> 0) / 4294967296
}

/**
 * Build irregular angular spacing for a polygonal cross-section.
 */
function ringAngles(count, seed, jitter = 0.55) {
  const weights = Array.from({ length: count }, (_, i) => {
    return 0.55 + hash01(seed, i, 3) * jitter
  })
  const sum = weights.reduce((a, b) => a + b, 0)
  const angles = []
  let acc = hash01(seed, 1) * Math.PI * 2
  for (let i = 0; i < count; i += 1) {
    angles.push(acc)
    acc += (weights[i] / sum) * Math.PI * 2
  }
  return angles
}

function ringPoints(angles, radii, y, aspect, shearX, shearZ) {
  return angles.map((a, i) => {
    const r = radii[i]
    return new THREE.Vector3(
      Math.cos(a) * r + shearX,
      y,
      Math.sin(a) * r * aspect + shearZ,
    )
  })
}

/**
 * Sample points for one convex mineral crystal.
 * Produces large planar faces (prism body + faceted termination).
 */
export function sampleCrystalHullPoints({
  sides = 6,
  aspect = 0.78,
  asymmetry = 0.45,
  tipStyle = 'pyramid',
  seed = 1,
} = {}) {
  const count = Math.max(5, Math.min(8, Math.round(sides)))
  const asym = clamp(asymmetry, 0.15, 0.7)
  const aspectRatio = clamp(aspect, 0.55, 0.95)
  const angles = ringAngles(count, seed, 0.7 + asym * 0.5)

  const baseRadii = Array.from({ length: count }, (_, i) => {
    const u = hash01(seed, i, 11)
    return 0.72 + u * asym * 0.85
  })
  const midRadii = baseRadii.map((r, i) => {
    const u = hash01(seed, i, 19)
    return r * (1.05 + u * 0.12 * asym)
  })
  const shoulderRadii = baseRadii.map((r, i) => {
    const u = hash01(seed, i, 29)
    return r * (0.78 + u * 0.12)
  })

  const shearX = (hash01(seed, 41) - 0.5) * 0.18 * asym
  const shearZ = (hash01(seed, 43) - 0.5) * 0.18 * asym
  const tipOx = (hash01(seed, 47) - 0.5) * 0.28 * asym
  const tipOz = (hash01(seed, 53) - 0.5) * 0.28 * asym

  const points = []
  /* Slightly below 0 so the root embeds into the membrane. */
  points.push(
    ...ringPoints(angles, baseRadii, -0.04, aspectRatio, 0, 0),
  )
  points.push(
    ...ringPoints(
      angles,
      midRadii,
      0.38 + hash01(seed, 59) * 0.08,
      aspectRatio,
      shearX * 0.4,
      shearZ * 0.4,
    ),
  )
  points.push(
    ...ringPoints(
      angles,
      shoulderRadii,
      0.72 + hash01(seed, 61) * 0.06,
      aspectRatio,
      shearX,
      shearZ,
    ),
  )

  const style =
    tipStyle === 'auto'
      ? hash01(seed, 71) < 0.34
        ? 'truncate'
        : hash01(seed, 71) < 0.67
          ? 'chisel'
          : 'pyramid'
      : tipStyle

  if (style === 'truncate') {
    const tipRadii = shoulderRadii.map((r, i) => {
      const u = hash01(seed, i, 73)
      return r * (0.28 + u * 0.22)
    })
    points.push(
      ...ringPoints(
        angles,
        tipRadii,
        0.94 + hash01(seed, 79) * 0.05,
        aspectRatio * 0.9,
        tipOx,
        tipOz,
      ),
    )
  } else if (style === 'chisel') {
    /* Slanted roof — two high corners, lower opposite edge. */
    const high = 1.0
    const low = 0.82 + hash01(seed, 83) * 0.08
    for (let i = 0; i < count; i += 1) {
      const t = i / count
      const y = t < 0.45 || t > 0.9 ? high : low
      const r = shoulderRadii[i] * (0.15 + hash01(seed, i, 89) * 0.2)
      points.push(
        new THREE.Vector3(
          Math.cos(angles[i]) * r + tipOx,
          y,
          Math.sin(angles[i]) * r * aspectRatio + tipOz,
        ),
      )
    }
    points.push(new THREE.Vector3(tipOx * 1.2, high, tipOz * 1.2))
  } else {
    /* Pyramid / multi-facet tip */
    points.push(new THREE.Vector3(tipOx, 1.0, tipOz))
    for (let i = 0; i < count; i += 1) {
      if (hash01(seed, i, 97) > 0.55) continue
      const r = shoulderRadii[i] * (0.12 + hash01(seed, i, 101) * 0.18)
      points.push(
        new THREE.Vector3(
          Math.cos(angles[i]) * r + tipOx * 0.5,
          0.88 + hash01(seed, i, 103) * 0.08,
          Math.sin(angles[i]) * r * aspectRatio + tipOz * 0.5,
        ),
      )
    }
  }

  return points
}

/**
 * Create a convex crystal mesh with planar facet normals.
 */
export function createCrystalPolyhedronGeometry(options = {}) {
  const points = sampleCrystalHullPoints(options)
  const geometry = new ConvexGeometry(points)
  /* Ensure hard planar facets — ConvexGeometry already uses face normals. */
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.name = 'Exp03 crystal polyhedron'
  return geometry
}

/** Reusable profile library for deterministic variety. */
export const EXP03_POLYHEDRON_PROFILES = [
  { sides: 6, aspect: 0.82, asymmetry: 0.38, tipStyle: 'pyramid' },
  { sides: 5, aspect: 0.72, asymmetry: 0.52, tipStyle: 'chisel' },
  { sides: 7, aspect: 0.78, asymmetry: 0.45, tipStyle: 'truncate' },
  { sides: 6, aspect: 0.68, asymmetry: 0.55, tipStyle: 'pyramid' },
  { sides: 5, aspect: 0.85, asymmetry: 0.4, tipStyle: 'chisel' },
  { sides: 8, aspect: 0.75, asymmetry: 0.48, tipStyle: 'truncate' },
  { sides: 6, aspect: 0.7, asymmetry: 0.6, tipStyle: 'pyramid' },
  { sides: 5, aspect: 0.8, asymmetry: 0.42, tipStyle: 'chisel' },
]

export function createCrystalPolyhedronGeometrySet(seed = 41) {
  return EXP03_POLYHEDRON_PROFILES.map((profile, index) =>
    createCrystalPolyhedronGeometry({
      ...profile,
      seed: seed + index * 23,
    }),
  )
}

/**
 * Approximate crystal shaft radius at normalized height t ∈ [0,1]
 * for face-aware child seating (unit crystal before mesh scale).
 */
export function estimateCrystalRadiusAt(t, width, depth) {
  const u = clamp(t, 0, 1)
  const base = Math.max(width, depth) * 0.5
  /* Mild mid swell then taper — matches hull point layout. */
  const swell = 1 + Math.sin(u * Math.PI) * 0.08
  const taper = 1 - u * u * 0.35
  return base * swell * taper
}
