import * as THREE from 'three'

/**
 * Procedural Plume for Scatter — feather / fin / translucent leaf.
 * Local space: origin at attachment, +Y = surface normal (initial outward).
 * One complete plume per instance: central spine + two asymmetric side vanes.
 * Spine starts along +Y and sweeps toward +X (flow bend). Not a flat sticker,
 * not a multi-lobe cluster, not a radial spike.
 * Vertex `aAttach` (1→0) drives GPU surface wrapping in the scatter shader.
 */
export function createPlumeGeometry({
  seed = 1,
  /** Outward reach ≈ 30% of unit body radius. */
  length = 0.32,
  /** Broad feather vane — roughly ~2.3:1 length:width. */
  width = 0.14,
  spineThickness = 0.009,
  vaneThin = 0.004,
  bend = 0.58,
  twist = 0.2,
  lengthSegments = 64,
  widthSegments = 32,
} = {}) {
  const rng = mulberry32(seed >>> 0 || 1)

  const positions = []
  const normals = []
  const attach = []
  const indices = []

  const p = new THREE.Vector3()
  const pu = new THREE.Vector3()
  const pv = new THREE.Vector3()
  const tU = new THREE.Vector3()
  const tV = new THREE.Vector3()
  const n = new THREE.Vector3()

  const params = {
    length: length * (0.9 + rng() * 0.2),
    width: width * (0.9 + rng() * 0.24),
    spineThickness: spineThickness * (0.88 + rng() * 0.28),
    vaneThin: vaneThin * (0.85 + rng() * 0.3),
    bend: bend * (0.78 + rng() * 0.4),
    twist: twist * (0.55 + rng() * 0.9) * (rng() < 0.5 ? -1 : 1),
    // Classic feather asymmetry: one vane fuller than the other.
    leftScale: 0.72 + rng() * 0.2,
    rightScale: 0.95 + rng() * 0.22,
    // Peak width mid-vane, like a contour feather.
    peakU: 0.38 + rng() * 0.14,
    ruffle: 0.04 + rng() * 0.035,
    vein: 0.55 + rng() * 0.35,
    yaw: (rng() - 0.5) * 0.28,
  }

  const epsU = 0.3 / lengthSegments
  const epsV = 0.3 / widthSegments

  for (let i = 0; i <= lengthSegments; i += 1) {
    const u = i / lengthSegments
    for (let j = 0; j <= widthSegments; j += 1) {
      const v = (j / widthSegments) * 2 - 1
      samplePlume(p, u, v, params)
      positions.push(p.x, p.y, p.z)
      // Compact root glued; free body keeps airborne sweep.
      attach.push(Math.pow(1.0 - u, 2.5))

      samplePlume(pu, Math.min(1, u + epsU), v, params)
      samplePlume(pv, u, THREE.MathUtils.clamp(v + epsV * 2, -1, 1), params)
      tU.subVectors(pu, p)
      tV.subVectors(pv, p)
      n.crossVectors(tU, tV)
      if (n.lengthSq() < 1e-12) n.set(0, 1, 0)
      else n.normalize()
      normals.push(n.x, n.y, n.z)
    }
  }

  const stride = widthSegments + 1
  for (let i = 0; i < lengthSegments; i += 1) {
    for (let j = 0; j < widthSegments; j += 1) {
      const a = i * stride + j
      const b = a + 1
      const c = a + stride
      const d = c + 1
      indices.push(a, c, b)
      indices.push(b, c, d)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('aAttach', new THREE.Float32BufferAttribute(attach, 1))
  geometry.setIndex(indices)
  return geometry
}

/** Build a small pool of deterministic plume variants for instancing. */
export function createPlumeVariants(count = 7, baseSeed = 55201) {
  const n = Math.max(1, Math.floor(count))
  return Array.from({ length: n }, (_, i) =>
    createPlumeGeometry({ seed: (baseSeed + i * 7919) >>> 0 }),
  )
}

function samplePlume(out, u, v, params) {
  const [x, y, z] = plumePoint(u, v, params)
  out.set(x, y, z)
}

/**
 * One feather-like plume.
 * u: 0 root → 1 tip along the spine.
 * v: -1…1 across left / right vane (0 = central spine).
 */
function plumePoint(
  u,
  v,
  {
    length,
    width,
    spineThickness,
    vaneThin,
    bend,
    twist,
    leftScale,
    rightScale,
    peakU,
    ruffle,
    vein,
    yaw,
  },
) {
  const ease = u * u * (3 - 2 * u)
  const rootPin = Math.pow(1.0 - u, 2.7)

  // Feather silhouette: narrow calamus → full asymmetric vane → soft tip.
  const sideScale = v < 0 ? leftScale : rightScale
  const rootOpen = Math.pow(Math.min(1, u / Math.max(0.1, peakU * 0.45)), 0.95)
  // Smooth belly of the vane — stays wide through the middle third.
  const belly = Math.sin(Math.PI * Math.pow(Math.min(1, u * 0.98), 0.7))
  const afterPeak = Math.max(0, (u - peakU) / Math.max(1e-3, 1 - peakU))
  // Soft tip — feather point, not a needle.
  const tipTaper = Math.pow(1.0 - afterPeak, 1.05) * (1.0 - afterPeak * 0.15)
  const widthProf =
    (0.2 + 0.8 * belly * Math.max(0.35, tipTaper)) *
    (0.18 + 0.82 * rootOpen) *
    sideScale
  const halfW = width * 0.5 * widthProf

  // Spine centerline: leave along +Y, sweep toward +X (flow).
  const sweep = Math.pow(u, 1.25)
  const cx = length * bend * sweep * sweep
  const cy = length * ease * (1.0 - 0.08 * sweep)

  // Analytic-ish tangent for a stable vane frame.
  let tX = 2.0 * length * bend * sweep * 1.25 * Math.pow(u + 1e-4, 0.25)
  let tY = length * 6.0 * u * (1.0 - u) * (1.0 - 0.08 * sweep)
  const tLen = Math.hypot(tX, tY) || 1
  tX /= tLen
  tY /= tLen
  const nX = tY
  const nY = -tX

  // Mild twist along the spine.
  const twistAmt = twist * ease * ease
  const cosW = Math.cos(twistAmt)
  const sinW = Math.sin(twistAmt)

  // Thick central spine ridge; thin membrane vanes toward the edges.
  const spineMask = Math.exp(-v * v * 9.5)
  const vaneMask = 1.0 - spineMask
  const thickness =
    spineThickness * (0.55 + 0.45 * spineMask) +
    vaneThin * vaneMask * (0.45 + 0.55 * (1.0 - Math.abs(v)))

  // Edge ruffle — soft silk/fin waviness, not chaotic curls.
  const edge = Math.pow(Math.abs(v), 1.65)
  const ruffleAmt =
    ruffle *
    edge *
    Math.sin(u * Math.PI * 4.2 + v * 2.1) *
    Math.sin(u * Math.PI * 2.1 + 0.8)

  // Fine veins from spine toward edges.
  const veinAmt =
    vein *
    vaneMask *
    0.014 *
    Math.sin(Math.abs(v) * 18.0 + u * 2.5) *
    Math.sin(u * Math.PI * 6.0)

  const across = v * halfW * (1.0 + ruffleAmt)
  const ox = across * (-sinW) * 0.14
  const oy = across * sinW * 0.07
  const oz = across * cosW

  const sheet = thickness * (0.25 + 0.75 * spineMask)
  let x = cx + nX * (sheet + veinAmt * length) + ox
  let y = cy + nY * (sheet + veinAmt * length) + oy
  let z = oz

  // Soft vane cup — readable volume when orbiting.
  const cup = vaneMask * (1.0 - Math.abs(v)) * 0.55 + vaneMask * edge * 0.35
  x += nX * vaneThin * 2.2 * cup
  y += nY * vaneThin * 2.2 * cup

  // Compact calamus on the host — keep mid-vane width free.
  x *= 1.0 - rootPin * 0.65
  z *= 1.0 - rootPin * 0.88
  y *= 1.0 - rootPin * 0.35
  y -= spineThickness * 0.4 * rootPin

  const cosY = Math.cos(yaw)
  const sinY = Math.sin(yaw)
  return [x * cosY - z * sinY, y, x * sinY + z * cosY]
}

function mulberry32(a) {
  return function rng() {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const PLUME_DEFAULTS = {
  length: 0.32,
  width: 0.14,
  spineThickness: 0.009,
  vaneThin: 0.004,
  bend: 0.58,
  twist: 0.2,
  lengthSegments: 64,
  widthSegments: 32,
  variantCount: 7,
}
