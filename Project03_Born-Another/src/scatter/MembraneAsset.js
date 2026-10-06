import * as THREE from 'three'

/**
 * Procedural abstract membrane growth for Scatter.
 * Local space: origin at surface attachment, +Y = surface normal.
 *
 * Macro fold + multi-octave micro ripples. Normals are finite-differenced
 * from the same procedural field so high-frequency detail shades smoothly.
 * Vertex `aAttach` (1→0) drives GPU surface wrapping in the scatter shader.
 */
export function createMembraneGeometry({
  length = 0.145,
  height = 0.032,
  width = 0.042,
  fold = 0.48,
  curl = 0.42,
  /** Micro-ripple amplitude relative to height (reference-style fine fold). */
  detail = 1,
  // High enough to carry micro-displacement without faceting under instancing.
  lengthSegments = 72,
  widthSegments = 36,
} = {}) {
  const positions = []
  const normals = []
  const attach = []
  const indices = []

  const params = { length, height, width, fold, curl, detail }
  const du = 1 / lengthSegments
  const dv = 2 / widthSegments
  const epsU = du * 0.45
  const epsV = dv * 0.45

  const p = new THREE.Vector3()
  const pu = new THREE.Vector3()
  const pv = new THREE.Vector3()
  const tangentU = new THREE.Vector3()
  const tangentV = new THREE.Vector3()
  const normal = new THREE.Vector3()

  for (let i = 0; i <= lengthSegments; i += 1) {
    // Mild root bias — tip/edge stay dense for a smooth silhouette.
    const t = i / lengthSegments
    const u = Math.pow(t, 1.06)
    for (let j = 0; j <= widthSegments; j += 1) {
      const v = (j / widthSegments) * 2 - 1
      sampleMembrane(p, u, v, params)
      positions.push(p.x, p.y, p.z)
      attach.push(Math.pow(1.0 - u, 1.15))

      // Analytic-ish smooth normals from the displaced surface (not flat faces).
      sampleMembrane(pu, Math.min(1, u + epsU), v, params)
      sampleMembrane(pv, u, Math.min(1, Math.max(-1, v + epsV)), params)
      tangentU.subVectors(pu, p)
      tangentV.subVectors(pv, p)
      normal.crossVectors(tangentU, tangentV)
      if (normal.lengthSq() < 1e-12) {
        normal.set(0, 1, 0)
      } else {
        normal.normalize()
      }
      normals.push(normal.x, normal.y, normal.z)
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

function sampleMembrane(out, u, v, params) {
  const [x, y, z] = membranePoint(u, v, params)
  out.set(x, y, z)
}

/**
 * u: 0 at the surface root → 1 at the soft open edge
 * v: -1…1 across the membrane width
 */
function membranePoint(u, v, { length, height, width, fold, curl, detail = 1 }) {
  const ease = u * u * (3 - 2 * u)
  // Stay near the surface longer, then lift — reads as growth, not a sticker.
  const liftGate = Math.pow(Math.max(0, (u - 0.06) / 0.94), 1.4)

  // Narrow root collar that settles onto the host surface.
  const apron = Math.pow(1.0 - u, 1.9)
  const rootFlare = 1.0 + 0.7 * apron

  const edgeWave =
    1.0 +
    0.08 * Math.sin(v * 3.6 + u * 2.2) +
    0.05 * Math.sin(v * 7.2 - u * 5.1)

  // Feather vane: slender after the collar, fullest around mid-length, tapered tip.
  const vane =
    Math.pow(Math.sin(Math.PI * Math.pow(Math.min(1, u * 1.02), 0.85)), 0.9) *
    (1.0 - 0.55 * Math.pow(u, 2.1))
  const widthProfile = (0.28 + 0.72 * vane) * rootFlare * edgeWave

  // Slight backskirt so the apron straddles the attachment.
  const skirt = length * 0.1 * apron * (0.55 + 0.45 * (1.0 - Math.abs(v)))
  let x = -skirt + length * (0.05 * u + 0.95 * ease)
  let z = v * width * 0.5 * widthProfile

  // Sink the apron slightly into the surface to blend under translucency.
  let y = -height * 0.05 * apron
  // Long shallow lift along the vane — feather-like, not a short flap.
  y += height * Math.sin(liftGate * Math.PI * 0.62) * (0.2 + 0.8 * ease)

  // Soft rachis crease along the centerline.
  const crease = Math.sin((v * 0.5 + 0.5) * Math.PI)
  const free = liftGate * liftGate
  y += height * fold * 0.28 * crease * free
  x += length * fold * 0.06 * (1.0 - Math.abs(v)) * free

  // Gentle vane curl; keep the rooted apron untwisted.
  const twist = curl * free * (0.4 + 0.45 * v)
  const cosT = Math.cos(twist)
  const sinT = Math.sin(twist)
  const y2 = y * cosT - z * sinT * 0.22
  const z2 = y * sinT * 0.16 + z * cosT
  y = y2
  z = z2

  y += height * 0.1 * curl * v * v * free
  x += length * 0.025 * v * free
  z += width * 0.03 * Math.sin(u * Math.PI * 1.2) * free

  // Multi-octave micro folds — this is what reads as “resolution,” not just more tris.
  // Gated by `free` so the surface apron stays clean.
  const d = detail * free
  if (d > 1e-5) {
    const n1 =
      Math.sin(u * 28.0 + v * 6.5) * Math.sin(v * 14.0 + u * 4.0)
    const n2 = Math.sin(u * 54.0 + v * 19.0 + 1.7) * Math.cos(v * 31.0 - u * 9.0)
    const n3 = Math.sin(u * 96.0 + v * 47.0 + 0.6) * Math.sin((u + v) * 38.0)
    // Longitudinal striations along the vane (feather / tissue grain).
    const grain = Math.sin(v * 52.0 + u * 3.5) * Math.sin(u * 18.0 + 2.1)
    const micro = n1 * 0.45 + n2 * 0.28 + n3 * 0.14 + grain * 0.22
    y += height * 0.055 * d * micro
    z += width * 0.028 * d * micro * (0.35 + 0.65 * Math.abs(v))
    x += length * 0.012 * d * n2
  }

  return [x, y, z]
}

export const MEMBRANE_DEFAULTS = {
  length: 0.145,
  height: 0.032,
  width: 0.042,
  fold: 0.48,
  curl: 0.42,
  detail: 1,
  lengthSegments: 72,
  widthSegments: 36,
}
