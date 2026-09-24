/*
  Compact 3D simplex noise (Ashima / Stefan Gustavson style).
  Returns roughly [-1, 1].

  Separate from simplex2d.js so generateCurlNoiseMap stays untouched.
*/

const F3 = 1 / 3
const G3 = 1 / 6

const PERM = new Uint8Array(512)
const GRAD = [
  [1, 1, 0],
  [-1, 1, 0],
  [1, -1, 0],
  [-1, -1, 0],
  [1, 0, 1],
  [-1, 0, 1],
  [1, 0, -1],
  [-1, 0, -1],
  [0, 1, 1],
  [0, -1, 1],
  [0, 1, -1],
  [0, -1, -1],
]

;(function seedPerm(seed = 0) {
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  let s = (seed * 16807 + 1) >>> 0
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) >>> 0
    const j = s % (i + 1)
    const t = p[i]
    p[i] = p[j]
    p[j] = t
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]
})(2468)

function dot3(g, x, y, z) {
  return g[0] * x + g[1] * y + g[2] * z
}

/** 3D simplex noise, roughly [-1, 1]. */
export function simplex3(xin, yin, zin) {
  const s = (xin + yin + zin) * F3
  const i = Math.floor(xin + s)
  const j = Math.floor(yin + s)
  const k = Math.floor(zin + s)
  const t = (i + j + k) * G3
  const x0 = xin - (i - t)
  const y0 = yin - (j - t)
  const z0 = zin - (k - t)

  let i1
  let j1
  let k1
  let i2
  let j2
  let k2

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

  let n0 = 0
  let n1 = 0
  let n2 = 0
  let n3 = 0

  let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0
  if (t0 >= 0) {
    t0 *= t0
    const g = GRAD[PERM[ii + PERM[jj + PERM[kk]]] % 12]
    n0 = t0 * t0 * dot3(g, x0, y0, z0)
  }

  let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1
  if (t1 >= 0) {
    t1 *= t1
    const g = GRAD[PERM[ii + i1 + PERM[jj + j1 + PERM[kk + k1]]] % 12]
    n1 = t1 * t1 * dot3(g, x1, y1, z1)
  }

  let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2
  if (t2 >= 0) {
    t2 *= t2
    const g = GRAD[PERM[ii + i2 + PERM[jj + j2 + PERM[kk + k2]]] % 12]
    n2 = t2 * t2 * dot3(g, x2, y2, z2)
  }

  let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3
  if (t3 >= 0) {
    t3 *= t3
    const g = GRAD[PERM[ii + 1 + PERM[jj + 1 + PERM[kk + 1]]] % 12]
    n3 = t3 * t3 * dot3(g, x3, y3, z3)
  }

  return 32 * (n0 + n1 + n2 + n3)
}

/**
 * Layered 3D simplex (fBm), roughly [-1, 1].
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} octaves
 * @param {number} [lac=2]
 * @param {number} [gain=0.5]
 */
export function fbm3(x, y, z, octaves, lac = 2, gain = 0.5) {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  const o = Math.max(1, Math.floor(octaves))
  for (let i = 0; i < o; i++) {
    sum += amp * simplex3(x * freq, y * freq, z * freq)
    norm += amp
    amp *= gain
    freq *= lac
  }
  return sum / (norm || 1)
}
