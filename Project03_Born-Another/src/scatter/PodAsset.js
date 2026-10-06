import * as THREE from 'three'

/**
 * Procedural Pod for Scatter — localized surface swelling.
 * Local space: origin at surface attachment, +Y = surface normal.
 * Broad root on the host → low asymmetric dome. No stem, neck, or bulb-on-stalk.
 * Vertex `aAttach` (1→0): high at the rim so the edge blends into the surface.
 */
export function createPodGeometry({
  seed = 1,
  /** Peak swell height — kept lower than footprint width. */
  height = 0.052,
  /** Footprint radius (full diameter ≈ 2×). Wider than tall. */
  radius = 0.095,
  lengthSegments = 32,
  radialSegments = 28,
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
    height: height * (0.92 + rng() * 0.16),
    radius: radius * (0.9 + rng() * 0.22),
    // Elliptical footprint — not a round blister.
    aspect: 0.78 + rng() * 0.4,
    // Peak offset from center for soft asymmetry.
    peakX: (rng() - 0.5) * 0.28,
    peakZ: (rng() - 0.5) * 0.28,
    // Dome fullness / flatten.
    inflate: 0.85 + rng() * 0.3,
    flatten: 1.05 + rng() * 0.35,
    // Smooth shell deformation.
    deformA: (rng() - 0.5) * 0.12,
    deformB: (rng() - 0.5) * 0.1,
    phase: rng() * Math.PI * 2,
    yaw: (rng() - 0.5) * Math.PI * 2,
  }

  const epsU = 0.35 / lengthSegments
  const epsV = ((Math.PI * 2) / radialSegments) * 0.35

  for (let i = 0; i <= lengthSegments; i += 1) {
    // u: 0 at dome peak (center) → 1 at broad surface rim.
    const u = i / lengthSegments
    for (let j = 0; j <= radialSegments; j += 1) {
      const v = (j / radialSegments) * Math.PI * 2
      samplePod(p, u, v, params)
      positions.push(p.x, p.y, p.z)
      // Rim glued to the host; peak keeps a little free lift.
      attach.push(Math.pow(u, 1.15))

      samplePod(pu, Math.min(1, u + epsU), v, params)
      samplePod(pv, u, v + epsV, params)
      tU.subVectors(pu, p)
      tV.subVectors(pv, p)
      n.crossVectors(tU, tV)
      if (n.lengthSq() < 1e-12) n.set(0, 1, 0)
      else n.normalize()
      if (n.y < 0) n.negate()
      normals.push(n.x, n.y, n.z)
    }
  }

  const stride = radialSegments + 1
  for (let i = 0; i < lengthSegments; i += 1) {
    for (let j = 0; j < radialSegments; j += 1) {
      const a = i * stride + j
      const b = a + 1
      const c = a + stride
      const d = c + 1
      indices.push(a, b, c)
      indices.push(b, d, c)
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

/** Build a small pool of deterministic pod variants for instancing. */
export function createPodVariants(count = 7, baseSeed = 66307) {
  const n = Math.max(1, Math.floor(count))
  return Array.from({ length: n }, (_, i) =>
    createPodGeometry({ seed: (baseSeed + i * 7919) >>> 0 }),
  )
}

function samplePod(out, u, v, params) {
  const [x, y, z] = podPoint(u, v, params)
  out.set(x, y, z)
}

/**
 * Low asymmetric surface dome.
 * u: 0 peak → 1 broad rim on the host.
 * v: 0…2π around the footprint.
 */
function podPoint(
  u,
  v,
  {
    height,
    radius,
    aspect,
    peakX,
    peakZ,
    inflate,
    flatten,
    deformA,
    deformB,
    phase,
    yaw,
  },
) {
  // Smooth rim falloff — blister blends into the surface, no neck.
  const rim = u * u * (3 - 2 * u)
  const rise = Math.pow(1.0 - rim, flatten)

  // Soft radial deformation of the footprint.
  const deform =
    1.0 +
    deformA * Math.sin(v * 2.0 + phase) * rim +
    deformB * Math.sin(v * 3.0 - phase * 1.2) * rim * rim

  const rx = radius * rim * deform
  const rz = radius * aspect * rim * deform

  // Peak shifted off-center → irregular ellipsoid dome.
  const cx = peakX * radius * (1.0 - rim)
  const cz = peakZ * radius * (1.0 - rim)

  let x = Math.cos(v) * rx + cx
  let z = Math.sin(v) * rz + cz
  // Low swell — height stays well below footprint width.
  let y = height * inflate * rise

  // Sink the broad rim slightly into the host for a continuous blend.
  y -= height * 0.08 * Math.pow(rim, 1.6)

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

export const POD_DEFAULTS = {
  height: 0.052,
  radius: 0.095,
  lengthSegments: 32,
  radialSegments: 28,
  variantCount: 7,
  /** Pods are larger; keep count much lower than membrane/plume at same density. */
  densityScale: 0.2,
}
