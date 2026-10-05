/**
 * Surface sampling utilities for Scatter mode.
 * Returns { position, normal } so later steps can add orientation / asset types.
 */

function mulberry32(seed) {
  let t = seed >>> 0
  return function next() {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Uniform-ish samples on a unit sphere surface (Fibonacci lattice + seed jitter).
 * Modular entry point — swap for mesh-triangle sampling later without changing callers.
 */
export function sampleSphereSurface({
  count,
  seed = 1,
  radius = 1,
  jitter = 0.35,
} = {}) {
  const n = Math.max(0, Math.floor(count))
  const rand = mulberry32(Math.floor(seed) || 1)
  const samples = new Array(n)
  const golden = Math.PI * (3 - Math.sqrt(5))

  for (let i = 0; i < n; i += 1) {
    const y = 1 - (i / Math.max(1, n - 1)) * 2
    const rAtY = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i + (rand() - 0.5) * jitter * 2

    let x = Math.cos(theta) * rAtY
    let z = Math.sin(theta) * rAtY
    let ny = y

    // Tiny radial noise keeps attachments on the sphere while reducing lattice look.
    const wobble = 1 + (rand() - 0.5) * jitter * 0.04
    const len = Math.hypot(x, ny, z) || 1
    x = (x / len) * wobble
    ny = (ny / len) * wobble
    z = (z / len) * wobble

    const inv = 1 / (Math.hypot(x, ny, z) || 1)
    const nx = x * inv
    const nn = ny * inv
    const nz = z * inv

    samples[i] = {
      position: [nx * radius, nn * radius, nz * radius],
      normal: [nx, nn, nz],
      // Reserved for later distribution / UV-driven assets.
      u: 0.5 + Math.atan2(nz, nx) / (Math.PI * 2),
      v: 0.5 - Math.asin(Math.min(1, Math.max(-1, nn))) / Math.PI,
    }
  }

  return samples
}
