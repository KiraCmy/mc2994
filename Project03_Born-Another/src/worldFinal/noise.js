/**
 * World Final — deterministic value noise / fBm (no Three dependency).
 */

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function hash2(seed, ix, iy, channel = 0) {
  let h =
    (Math.imul(ix | 0, 374761393) ^
      Math.imul(iy | 0, 668265263) ^
      Math.imul((seed | 0) + 1, 1274126177) ^
      Math.imul((channel | 0) + 1, 2246822519)) >>>
    0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0
  return (h >>> 0) / 4294967296
}

/** Value noise in R2 → roughly [-1, 1]. */
export function valueNoise2(seed, x, y, channel = 0) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = fade(x - x0)
  const fy = fade(y - y0)
  const n00 = hash2(seed, x0, y0, channel) * 2 - 1
  const n10 = hash2(seed, x0 + 1, y0, channel) * 2 - 1
  const n01 = hash2(seed, x0, y0 + 1, channel) * 2 - 1
  const n11 = hash2(seed, x0 + 1, y0 + 1, channel) * 2 - 1
  return lerp(lerp(n00, n10, fx), lerp(n01, n11, fx), fy)
}

/** Fractal Brownian motion → roughly [-1, 1]. */
export function fbm2(seed, x, y, { octaves = 3, lacunarity = 2, gain = 0.5, channel = 0 } = {}) {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i += 1) {
    sum += amp * valueNoise2(seed, x * freq, y * freq, channel + i * 17)
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return norm > 0 ? sum / norm : 0
}
