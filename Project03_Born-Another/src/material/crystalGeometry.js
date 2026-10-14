import * as THREE from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

/** Specimen Nº 07. Geometry is the standalone demo's seed-7 shape. */
export const CRYSTAL_DEMO_SEED = 7

const STRETCH = new THREE.Vector3(1.0, 1.42, 0.92)

function mulberry32(a) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeNoise(seed) {
  const rnd = mulberry32(seed)
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[p[i], p[j]] = [p[j], p[i]]
  }
  const perm = new Uint8Array(512)
  const pm12 = new Uint8Array(512)
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255]
    pm12[i] = perm[i] % 12
  }
  const gr = [
    1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0,
    -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
  ]
  const F3 = 1 / 3
  const G3 = 1 / 6
  return (x, y, z) => {
    const s = (x + y + z) * F3
    const i = Math.floor(x + s)
    const j = Math.floor(y + s)
    const k = Math.floor(z + s)
    const t = (i + j + k) * G3
    const x0 = x - i + t
    const y0 = y - j + t
    const z0 = z - k + t
    let i1, j1, k1, i2, j2, k2
    if (x0 >= y0) {
      if (y0 >= z0) {
        i1 = 1
        j1 = 0
        k1 = 0
        i2 = 1
        j2 = 1
        k2 = 0
      } else if (x0 >= z0) {
        i1 = 1
        j1 = 0
        k1 = 0
        i2 = 1
        j2 = 0
        k2 = 1
      } else {
        i1 = 0
        j1 = 0
        k1 = 1
        i2 = 1
        j2 = 0
        k2 = 1
      }
    } else if (y0 < z0) {
      i1 = 0
      j1 = 0
      k1 = 1
      i2 = 0
      j2 = 1
      k2 = 1
    } else if (x0 < z0) {
      i1 = 0
      j1 = 1
      k1 = 0
      i2 = 0
      j2 = 1
      k2 = 1
    } else {
      i1 = 0
      j1 = 1
      k1 = 0
      i2 = 1
      j2 = 1
      k2 = 0
    }
    const x1 = x0 - i1 + G3
    const y1 = y0 - j1 + G3
    const z1 = z0 - k1 + G3
    const x2 = x0 - i2 + 2 * G3
    const y2 = y0 - j2 + 2 * G3
    const z2 = z0 - k2 + 2 * G3
    const x3 = x0 - 1 + 3 * G3
    const y3 = y0 - 1 + 3 * G3
    const z3 = z0 - 1 + 3 * G3
    const ii = i & 255
    const jj = j & 255
    const kk = k & 255
    let n = 0
    let tt
    let gi
    tt = 0.6 - x0 * x0 - y0 * y0 - z0 * z0
    if (tt > 0) {
      gi = pm12[ii + perm[jj + perm[kk]]] * 3
      tt *= tt
      n += tt * tt * (gr[gi] * x0 + gr[gi + 1] * y0 + gr[gi + 2] * z0)
    }
    tt = 0.6 - x1 * x1 - y1 * y1 - z1 * z1
    if (tt > 0) {
      gi = pm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3
      tt *= tt
      n += tt * tt * (gr[gi] * x1 + gr[gi + 1] * y1 + gr[gi + 2] * z1)
    }
    tt = 0.6 - x2 * x2 - y2 * y2 - z2 * z2
    if (tt > 0) {
      gi = pm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3
      tt *= tt
      n += tt * tt * (gr[gi] * x2 + gr[gi + 1] * y2 + gr[gi + 2] * z2)
    }
    tt = 0.6 - x3 * x3 - y3 * y3 - z3 * z3
    if (tt > 0) {
      gi = pm12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3
      tt *= tt
      n += tt * tt * (gr[gi] * x3 + gr[gi + 1] * y3 + gr[gi + 2] * z3)
    }
    return 32 * n
  }
}

function makeShape(seed) {
  const n = makeNoise(seed)
  const fbm = (x, y, z, oct) => {
    let a = 0.5
    let f = 1
    let s = 0
    for (let o = 0; o < oct; o++) {
      s += a * n(x * f, y * f, z * f)
      a *= 0.5
      f *= 2.03
    }
    return s
  }
  const ridge = (x, y, z) => 1 - Math.abs(n(x, y, z))
  const base = (x, y, z) => 1 + 0.42 * fbm(x * 1.1 + 3.1, y * 1.1, z * 1.1, 3)
  return { n, fbm, ridge, base }
}

function sphereGeo(detail) {
  const g = new THREE.IcosahedronGeometry(1, detail)
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  return mergeVertices(g)
}

function buildCrystal(S) {
  const g = sphereGeo(56)
  const pos = g.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    const b = S.base(v.x, v.y, v.z)
    const r =
      b * (1 + 0.06 * S.fbm(v.x * 3, v.y * 3, v.z * 3, 3)) +
      0.035 * S.ridge(v.x * 2.4, v.y * 2.4, v.z * 2.4)
    v.multiplyScalar(r).multiply(STRETCH)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

function buildCrust(S) {
  const g = sphereGeo(92)
  const pos = g.attributes.position
  const v = new THREE.Vector3()
  const col = new Float32Array(pos.count * 3)
  const dark = new THREE.Color(0x14170c)
  const mid = new THREE.Color(0x6b6430)
  const gold = new THREE.Color(0xe8d38a)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    const b = S.base(v.x, v.y, v.z)
    const m = S.fbm(v.x * 1.5 + 9.7, v.y * 1.5 - 4.2, v.z * 1.5 + 1.3, 3)
    const mask = THREE.MathUtils.smoothstep(m, -0.12, 0.32)
    const detail =
      0.07 * S.ridge(v.x * 6, v.y * 6, v.z * 6) +
      0.025 * S.n(v.x * 22, v.y * 22, v.z * 22) +
      0.01 * S.n(v.x * 55, v.y * 55, v.z * 55)
    const rel = 0.8 + 0.24 * mask + detail
    v.multiplyScalar(b * rel).multiply(STRETCH)
    pos.setXYZ(i, v.x, v.y, v.z)
    const t = THREE.MathUtils.clamp((rel - 0.86) / 0.24, 0, 1)
    c.copy(dark).lerp(mid, Math.min(1, t * 1.6))
    if (t > 0.6) c.lerp(gold, (t - 0.6) / 0.4)
    col[i * 3] = c.r
    col[i * 3 + 1] = c.g
    col[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

function buildSparkles(S, seed) {
  const rnd = mulberry32(seed * 7 + 1)
  const count = 140
  const arr = new Float32Array(count * 3)
  const v = new THREE.Vector3()
  for (let i = 0; i < count; i++) {
    v.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize()
    const r = S.base(v.x, v.y, v.z) * (0.55 + 0.42 * Math.cbrt(rnd()))
    v.multiplyScalar(r).multiply(STRETCH)
    arr.set([v.x, v.y, v.z], i * 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
  return g
}

export function createCrystalGeometries(seed = CRYSTAL_DEMO_SEED) {
  const shape = makeShape(seed)
  return {
    crystal: buildCrystal(shape),
    crust: buildCrust(shape),
    sparkles: buildSparkles(shape, seed),
  }
}
