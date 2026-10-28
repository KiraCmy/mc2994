/**
 * Exp03 — polyhedral mineral crystal mesh generator.
 * Large planar facets (few height stations), irregular cross-sections,
 * asymmetrical terminations, optional fused intergrowth lobe.
 * Local Y: base 0 → tip 1. Deterministic from seed.
 */
import * as THREE from 'three'

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}

function hash01(seed, ...keys) {
  let h = Math.imul(seed ^ 0x9e3779b9, 2654435761) >>> 0
  for (const key of keys) {
    h ^= Math.imul(Math.floor(Number(key) || 0) + 1, 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
  }
  return (h >>> 0) / 4294967296
}

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

function irregularAngles(count, seed, jitter = 0.9) {
  const weights = Array.from({ length: count }, (_, i) => {
    const u = hash01(seed, i, 11)
    return 0.45 + u * jitter
  })
  const sum = weights.reduce((a, b) => a + b, 0)
  const angles = []
  let acc = hash01(seed, 99) * Math.PI * 2
  for (let i = 0; i < count; i += 1) {
    angles.push(acc)
    acc += (weights[i] / sum) * Math.PI * 2
  }
  return angles
}

/**
 * Sample an irregular polygon ring in local XZ at height y.
 */
function sampleRing(angles, edgeScale, rx, rz, y, twist, shearX, shearZ) {
  return angles.map((angle, i) => {
    const a = angle + twist
    const s = edgeScale[i]
    return [
      Math.cos(a) * rx * s + shearX,
      y,
      Math.sin(a) * rz * s + shearZ,
    ]
  })
}

function stitchRings(positions, normals, lower, upper) {
  const n = lower.length
  for (let i = 0; i < n; i += 1) {
    const next = (i + 1) % n
    /* One planar facet per side — do not subdivide into strips. */
    pushFacet(positions, normals, lower[i], upper[i], upper[next])
    pushFacet(positions, normals, lower[i], upper[next], lower[next])
  }
}

function capBottom(positions, normals, ring) {
  const center = [0, ring[0][1], 0]
  for (let i = 0; i < ring.length; i += 1) {
    const next = (i + 1) % ring.length
    pushFacet(positions, normals, center, ring[i], ring[next])
  }
}

function buildTermination(
  positions,
  normals,
  shoulder,
  angles,
  edgeScale,
  tipFace,
  asym,
  seed,
  tipStyle,
) {
  const n = shoulder.length
  const tipOffsetX = (hash01(seed, 5) - 0.5) * 0.32 * asym
  const tipOffsetZ = (hash01(seed, 7) - 0.5) * 0.32 * asym
  const tipPts = []
  for (let i = 0; i < n; i += 1) {
    const u = hash01(seed, i, 61)
    const v = hash01(seed, i, 67)
    const mul = tipFace * (0.55 + v * 0.4) + 0.14 + (u - 0.5) * 0.12 * asym
    const y = 0.9 + u * 0.1
    const a = angles[i]
    tipPts.push([
      Math.cos(a) * mul * edgeScale[i] + tipOffsetX,
      y,
      Math.sin(a) * mul * edgeScale[i] * (0.75 + hash01(seed, 3) * 0.2) +
        tipOffsetZ,
    ])
  }

  stitchRings(positions, normals, shoulder, tipPts)

  if (tipStyle === 'chisel') {
    const peak = [tipOffsetX * 1.35, 1.0, tipOffsetZ * 1.35]
    const split = Math.floor(hash01(seed, 73) * n) % n
    for (let i = 0; i < n; i += 1) {
      const next = (i + 1) % n
      if (i === split || next === split) {
        pushFacet(positions, normals, tipPts[i], peak, tipPts[next])
      } else {
        const mid = [
          tipOffsetX * 0.85,
          0.96,
          tipOffsetZ * 0.85,
        ]
        pushFacet(positions, normals, tipPts[i], mid, tipPts[next])
      }
    }
  } else if (tipStyle === 'wedge') {
    const left = tipPts[0]
    const right = tipPts[Math.floor(n / 2)]
    const ridge = [
      (left[0] + right[0]) * 0.5 + tipOffsetX * 0.3,
      1.0,
      (left[2] + right[2]) * 0.5 + tipOffsetZ * 0.3,
    ]
    for (let i = 0; i < n; i += 1) {
      const next = (i + 1) % n
      pushFacet(positions, normals, tipPts[i], ridge, tipPts[next])
    }
  } else {
    /* Truncated roof — offset flat with slight lean. */
    const tipCenter = [tipOffsetX, 0.98, tipOffsetZ]
    for (let i = 0; i < n; i += 1) {
      const next = (i + 1) % n
      pushFacet(positions, normals, tipCenter, tipPts[next], tipPts[i])
    }
  }
}

/**
 * Build one polyhedral crystal prism (optionally with fused intergrowth lobe).
 */
export function createMineralCrystalGeometry({
  sides = 6,
  bodyEnd = 0.78,
  tipScale = 0.4,
  aspect = 0.78,
  asymmetry = 0.5,
  twist = 0.1,
  intergrowth = 0,
  seed = 1,
} = {}) {
  const count = Math.max(5, Math.min(7, Math.round(sides)))
  const bodyTop = clamp(bodyEnd, 0.68, 0.86)
  const tipFace = clamp(tipScale, 0.28, 0.55)
  const aspectRatio = clamp(aspect, 0.55, 0.9)
  const asym = clamp(asymmetry, 0.25, 0.7)
  const positions = []
  const normals = []

  const angles = irregularAngles(count, seed, 0.95 + asym * 0.5)
  const edgeScale = Array.from({ length: count }, (_, i) => {
    const h = hash01(seed, i, 3)
    const k = hash01(seed, i, 17)
    return 0.52 + h * asym * 1.35 + k * 0.2
  })

  const shearAmt = 0.12 + hash01(seed, 13) * 0.2 * asym
  const shearDir = hash01(seed, 19) * Math.PI * 2
  const tipStyleRoll = hash01(seed, 71)
  const tipStyle =
    tipStyleRoll < 0.34 ? 'truncate' : tipStyleRoll < 0.67 ? 'chisel' : 'wedge'

  /* Few stations → large readable facets (not extruded rod strips). */
  const base = sampleRing(
    angles,
    edgeScale,
    1.0,
    aspectRatio,
    0,
    0,
    0,
    0,
  )
  const waistT = 0.32 + hash01(seed, 21) * 0.1
  const waistScale = 1.06 + hash01(seed, 23) * 0.1 * asym
  const waist = sampleRing(
    angles,
    edgeScale,
    waistScale,
    waistScale * aspectRatio * (0.9 + hash01(seed, 25) * 0.12),
    waistT * bodyTop,
    twist * 0.35,
    Math.cos(shearDir) * shearAmt * 0.35,
    Math.sin(shearDir) * shearAmt * 0.35,
  )
  const shoulderScale = 0.88 + hash01(seed, 27) * 0.08
  const shoulder = sampleRing(
    angles,
    edgeScale,
    shoulderScale,
    shoulderScale * aspectRatio,
    bodyTop,
    twist * 0.85,
    Math.cos(shearDir) * shearAmt,
    Math.sin(shearDir) * shearAmt,
  )

  capBottom(positions, normals, base)
  stitchRings(positions, normals, base, waist)
  stitchRings(positions, normals, waist, shoulder)
  buildTermination(
    positions,
    normals,
    shoulder,
    angles,
    edgeScale,
    tipFace,
    asym,
    seed,
    tipStyle,
  )

  /* Fused intergrowth lobe — shares the root, reads as one mineral mass. */
  if (intergrowth > 0.2) {
    const lobeSeed = seed + 917
    const lobeCount = Math.max(5, count - 1)
    const lobeAngles = irregularAngles(lobeCount, lobeSeed, 0.8)
    const lobeEdge = Array.from({ length: lobeCount }, (_, i) => {
      const h = hash01(lobeSeed, i, 3)
      return 0.55 + h * asym
    })
    const az = hash01(lobeSeed, 2) * Math.PI * 2
    const out = 0.35 + intergrowth * 0.45
    const ox = Math.cos(az) * out
    const oz = Math.sin(az) * out
    const lean = 0.18 + hash01(lobeSeed, 4) * 0.2
    const scale = 0.42 + intergrowth * 0.28
    const lobeAspect = aspectRatio * (0.85 + hash01(lobeSeed, 6) * 0.2)

    const mapLobe = (ring) =>
      ring.map((p) => [
        p[0] * scale + ox + lean * p[1] * Math.cos(az),
        p[1] * (0.55 + intergrowth * 0.25),
        p[2] * scale + oz + lean * p[1] * Math.sin(az),
      ])

    const lBase = mapLobe(
      sampleRing(lobeAngles, lobeEdge, 1, lobeAspect, 0, 0, 0, 0),
    )
    const lWaist = mapLobe(
      sampleRing(
        lobeAngles,
        lobeEdge,
        1.05,
        lobeAspect,
        0.38,
        twist * 0.2,
        0,
        0,
      ),
    )
    const lShoulder = mapLobe(
      sampleRing(
        lobeAngles,
        lobeEdge,
        0.85,
        lobeAspect,
        0.72,
        twist * 0.5,
        0,
        0,
      ),
    )

    /* Skip bottom cap — lobe fuses into shared root volume. */
    stitchRings(positions, normals, lBase, lWaist)
    stitchRings(positions, normals, lWaist, lShoulder)
    buildTermination(
      positions,
      normals,
      lShoulder,
      lobeAngles,
      lobeEdge,
      tipFace * 0.9,
      asym * 0.85,
      lobeSeed,
      tipStyleRoll > 0.5 ? 'truncate' : 'chisel',
    )
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.name = 'Exp03 mineral crystal'
  return geometry
}

/** Profile library for reusable deterministic variants. */
export const EXP03_MINERAL_PROFILES = [
  { sides: 5, bodyEnd: 0.8, tipScale: 0.44, aspect: 0.72, asymmetry: 0.55, twist: 0.12, intergrowth: 0.7 },
  { sides: 6, bodyEnd: 0.78, tipScale: 0.4, aspect: 0.8, asymmetry: 0.48, twist: 0.08, intergrowth: 0.35 },
  { sides: 7, bodyEnd: 0.82, tipScale: 0.48, aspect: 0.68, asymmetry: 0.6, twist: 0.15, intergrowth: 0.55 },
  { sides: 5, bodyEnd: 0.76, tipScale: 0.36, aspect: 0.75, asymmetry: 0.52, twist: 0.1, intergrowth: 0 },
  { sides: 6, bodyEnd: 0.84, tipScale: 0.5, aspect: 0.7, asymmetry: 0.58, twist: 0.18, intergrowth: 0.8 },
  { sides: 5, bodyEnd: 0.79, tipScale: 0.42, aspect: 0.62, asymmetry: 0.65, twist: 0.14, intergrowth: 0.25 },
  { sides: 7, bodyEnd: 0.81, tipScale: 0.38, aspect: 0.78, asymmetry: 0.45, twist: 0.06, intergrowth: 0.45 },
  { sides: 6, bodyEnd: 0.77, tipScale: 0.46, aspect: 0.74, asymmetry: 0.5, twist: 0.11, intergrowth: 0.15 },
]

export function createMineralCrystalGeometrySet(seed = 41) {
  return EXP03_MINERAL_PROFILES.map((profile, index) =>
    createMineralCrystalGeometry({
      ...profile,
      seed: seed + index * 19,
    }),
  )
}
