import * as THREE from 'three'

/**
 * Procedural GrowthCluster for Scatter.
 * Local space: origin at shared root, +Y = surface normal (outward).
 * 2–3 broad, smooth membrane lobes — calm secondary growth, not spikes or petals.
 * Vertex `aAttach` (1→0) blends shading toward the host surface normal.
 */
export const GROWTH_CLUSTER_DEFAULTS = {
  height: 0.078,
  // Wider apron so face-on samples cover the disc, not only the silhouette.
  spread: 0.11,
  lengthSegments: 36,
  widthSegments: 20,
  variantCount: 7,
}

export function createGrowthClusterGeometry({
  seed = 1,
  height = GROWTH_CLUSTER_DEFAULTS.height,
  spread = GROWTH_CLUSTER_DEFAULTS.spread,
  lengthSegments = 36,
  widthSegments = 20,
} = {}) {
  const rng = mulberry32(seed >>> 0 || 1)
  const lobeCount = 2 + Math.floor(rng() * 2) // 2–3

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

  const clusterTwist = (rng() - 0.5) * 0.45
  const clusterLean = (rng() - 0.5) * 0.1

  for (let lobe = 0; lobe < lobeCount; lobe += 1) {
    const baseIndex = positions.length / 3
    // Even unfold with light asymmetry — readable volumes, not fragments.
    const yaw =
      clusterTwist +
      (lobe / lobeCount) * Math.PI * 2 +
      (rng() - 0.5) * 0.28
    const params = {
      height: height * (0.9 + rng() * 0.18),
      length: spread * (0.95 + rng() * 0.22),
      width: spread * (1.15 + rng() * 0.35),
      curl: 0.12 + rng() * 0.18,
      flare: 0.22 + rng() * 0.18,
      lean: clusterLean + (rng() - 0.5) * 0.12,
      yaw,
      rise: 0.7 + rng() * 0.2,
    }

    const epsU = 0.4 / lengthSegments
    const epsV = 0.4 / widthSegments

    for (let i = 0; i <= lengthSegments; i += 1) {
      const u = i / lengthSegments
      for (let j = 0; j <= widthSegments; j += 1) {
        const v = (j / widthSegments) * 2 - 1
        sampleLobe(p, u, v, params)
        positions.push(p.x, p.y, p.z)
        attach.push(Math.pow(1.0 - u, 1.15))

        sampleLobe(pu, Math.min(1, u + epsU), v, params)
        sampleLobe(pv, u, THREE.MathUtils.clamp(v + epsV * 2, -1, 1), params)
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
        const a = baseIndex + i * stride + j
        const b = a + 1
        const c = a + stride
        const d = c + 1
        indices.push(a, c, b)
        indices.push(b, c, d)
      }
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

/** Build a small pool of deterministic cluster variants for instancing. */
export function createGrowthClusterVariants(
  count = 7,
  baseSeed = 44017,
  defaults = GROWTH_CLUSTER_DEFAULTS,
) {
  const n = Math.max(1, Math.floor(count))
  return Array.from({ length: n }, (_, i) =>
    createGrowthClusterGeometry({
      seed: (baseSeed + i * 7919) >>> 0,
      height: defaults.height,
      spread: defaults.spread,
    }),
  )
}

function sampleLobe(out, u, v, params) {
  const [x, y, z] = lobePoint(u, v, params)
  out.set(x, y, z)
}

/**
 * One broad continuous lobe.
 * Compact root → smooth rise → rounded open tip. Gentle fold only.
 */
function lobePoint(u, v, { height, length, width, curl, flare, lean, yaw, rise }) {
  const ease = u * u * (3 - 2 * u)
  const lift = Math.pow(u, 0.92)

  // Broad mid-body with a soft rounded tip — no pointed silhouette.
  const open = Math.sin(Math.PI * Math.min(1, u * 0.98))
  const tipRound = 1.0 - Math.pow(Math.max(0, (u - 0.72) / 0.28), 1.8) * 0.35
  // Mild side bias for organic asymmetry (not jagged edge noise).
  const bias = 1.0 + 0.08 * v * (0.4 + 0.6 * u)
  const widthProfile = (0.22 + 0.78 * Math.pow(open, 0.65) * tipRound) * bias

  // Local frame: +Y along surface normal, +X outward unfold, +Z across.
  let x = length * ease * (0.55 + 0.45 * rise)
  let y = height * lift * (0.4 + 0.6 * ease)
  let z = v * width * 0.5 * widthProfile

  // Gentle cup / unfold away from the host.
  y += height * flare * 0.18 * (1.0 - v * v * 0.35) * ease
  x += length * flare * 0.12 * ease * ease
  y += height * lean * ease * 0.25

  // Soft continuous curl — volumetric fold, not a twist spike.
  const twist = curl * ease * ease * (0.7 + 0.15 * v)
  const cosT = Math.cos(twist)
  const sinT = Math.sin(twist)
  const y2 = y * cosT - z * sinT * 0.18
  const z2 = y * sinT * 0.12 + z * cosT
  y = y2
  z = z2

  // Shared compact root at the origin.
  const rootPin = Math.pow(1.0 - u, 2.6)
  x *= 1.0 - rootPin * 0.94
  z *= 1.0 - rootPin * 0.94
  y *= 1.0 - rootPin * 0.8
  y -= height * 0.018 * rootPin

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

