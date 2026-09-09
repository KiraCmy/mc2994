/*
  Compact 2D simplex noise (Ashima / Stefan Gustavson style).
  Returns roughly [-1, 1].
*/

const F2 = 0.5 * (Math.sqrt(3) - 1)
const G2 = (3 - Math.sqrt(3)) / 6

const PERM = new Uint8Array(512)
const GRAD = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
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
})(1337)

function dot2(g, x, y) {
  return g[0] * x + g[1] * y
}

export function simplex2(xin, yin) {
  const s = (xin + yin) * F2
  const i = Math.floor(xin + s)
  const j = Math.floor(yin + s)
  const t = (i + j) * G2
  const x0 = xin - (i - t)
  const y0 = yin - (j - t)

  const i1 = x0 > y0 ? 1 : 0
  const j1 = x0 > y0 ? 0 : 1

  const x1 = x0 - i1 + G2
  const y1 = y0 - j1 + G2
  const x2 = x0 - 1 + 2 * G2
  const y2 = y0 - 1 + 2 * G2

  const ii = i & 255
  const jj = j & 255

  let n0 = 0
  let n1 = 0
  let n2 = 0

  let t0 = 0.5 - x0 * x0 - y0 * y0
  if (t0 >= 0) {
    t0 *= t0
    const g = GRAD[PERM[ii + PERM[jj]] % 8]
    n0 = t0 * t0 * dot2(g, x0, y0)
  }

  let t1 = 0.5 - x1 * x1 - y1 * y1
  if (t1 >= 0) {
    t1 *= t1
    const g = GRAD[PERM[ii + i1 + PERM[jj + j1]] % 8]
    n1 = t1 * t1 * dot2(g, x1, y1)
  }

  let t2 = 0.5 - x2 * x2 - y2 * y2
  if (t2 >= 0) {
    t2 *= t2
    const g = GRAD[PERM[ii + 1 + PERM[jj + 1]] % 8]
    n2 = t2 * t2 * dot2(g, x2, y2)
  }

  return 70 * (n0 + n1 + n2)
}

export function fbm2(x, y, octaves, lac = 2, gain = 0.5) {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  const o = Math.max(1, Math.floor(octaves))
  for (let i = 0; i < o; i++) {
    sum += amp * simplex2(x * freq, y * freq)
    norm += amp
    amp *= gain
    freq *= lac
  }
  return sum / (norm || 1)
}
