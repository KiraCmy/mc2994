import { fbm2, simplex2 } from './simplex2d.js'

export const NOISE_TYPES = [
  {
    id: 'simplex',
    label: '#simplex',
    tag: '#simplex',
    blurb: 'Smooth, organic variation · natural terrain',
  },
  {
    id: 'perlin',
    label: '#perlin',
    tag: '#perlin',
    blurb: 'Soft, continuous variation · rolling terrain',
  },
  {
    id: 'worley',
    label: '#worley',
    tag: '#worley',
    blurb: 'Cell-based patterns · cracks and rocky forms',
  },
  {
    id: 'value',
    label: '#value',
    tag: '#value',
    blurb: 'Interpolated random values · simple variation',
  },
  {
    id: 'fbm',
    label: '#fbm',
    tag: '#fbm',
    blurb: 'Layered multi-scale noise · detailed terrain',
  },
]

export function getNoiseType(id) {
  if (id === 'ridged') return NOISE_TYPES.find((t) => t.id === 'fbm')
  return NOISE_TYPES.find((t) => t.id === id) ?? NOISE_TYPES.find((t) => t.id === 'simplex')
}

const PERM = new Uint8Array(512)
;(function seedPerm(seed = 2468) {
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
})()

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(a, b, t) {
  return a + t * (b - a)
}

function grad(hash, x, y) {
  const h = hash & 3
  const u = h < 2 ? x : y
  const v = h < 2 ? y : x
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
}

/** Classic 2D Perlin noise, roughly [-1, 1]. */
export function perlin2(x, y) {
  const X = Math.floor(x) & 255
  const Y = Math.floor(y) & 255
  const xf = x - Math.floor(x)
  const yf = y - Math.floor(y)
  const u = fade(xf)
  const v = fade(yf)
  const aa = PERM[PERM[X] + Y]
  const ab = PERM[PERM[X] + Y + 1]
  const ba = PERM[PERM[X + 1] + Y]
  const bb = PERM[PERM[X + 1] + Y + 1]
  const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u)
  const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u)
  return lerp(x1, x2, v)
}

function hash01(ix, iy) {
  let n = Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263)
  n = (n ^ (n >>> 13)) | 0
  n = Math.imul(n, 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

/** Value noise, roughly [-1, 1]. */
export function value2(x, y) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const xf = fade(x - x0)
  const yf = fade(y - y0)
  const v00 = hash01(x0, y0) * 2 - 1
  const v10 = hash01(x0 + 1, y0) * 2 - 1
  const v01 = hash01(x0, y0 + 1) * 2 - 1
  const v11 = hash01(x0 + 1, y0 + 1) * 2 - 1
  return lerp(lerp(v00, v10, xf), lerp(v01, v11, xf), yf)
}

/** Worley F1 distance mapped to roughly [-1, 1]. */
export function worley2(x, y) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  let minD = 8
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = xi + ox
      const cy = yi + oy
      const fx = hash01(cx, cy)
      const fy = hash01(cx + 19, cy + 91)
      const dx = cx + fx - x
      const dy = cy + fy - y
      minD = Math.min(minD, dx * dx + dy * dy)
    }
  }
  return 1 - 2 * Math.min(1, Math.sqrt(minD))
}

function fbmFrom(fn, x, y, octaves, lac, gain) {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  const o = Math.max(1, Math.floor(octaves))
  for (let i = 0; i < o; i++) {
    sum += amp * fn(x * freq, y * freq)
    norm += amp
    amp *= gain
    freq *= lac
  }
  return sum / (norm || 1)
}

/** Scalar sample in roughly [-1, 1] for the selected noise type. */
export function sampleNoise(type, x, y, octaves, lac = 2, gain = 0.5) {
  switch (type) {
    case 'perlin':
      return fbmFrom(perlin2, x, y, octaves, lac, gain)
    case 'worley':
      return fbmFrom(worley2, x, y, octaves, lac, gain)
    case 'value':
      return fbmFrom(value2, x, y, octaves, lac, gain)
    case 'fbm':
      return fbm2(x, y, octaves, lac, gain)
    case 'ridged':
      return fbm2(x, y, octaves, lac, gain)
    case 'simplex':
    default:
      return fbmFrom(simplex2, x, y, octaves, lac, gain)
  }
}
