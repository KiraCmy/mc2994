import { sampleNoise } from './noiseTypes.js'
import { shapeValue } from './shaping.js'

const EPS = 0.001

/**
 * Build a resolution×resolution curl-noise field.
 * Each cell: { u, v, mag, nx, ny } where nx/ny are UV in [0,1].
 */
export function generateCurlNoiseMap({
  resolution,
  scale,
  octaves,
  lac = 2,
  gain = 0.5,
  time = 0,
  strength = 1,
  shapeOp = 'none',
  shapeAmount = 1,
  noiseType = 'simplex',
}) {
  const res = Math.max(4, Math.floor(resolution))
  const cells = res * res
  const vx = new Float32Array(cells)
  const vy = new Float32Array(cells)
  const mag = new Float32Array(cells)
  const potential = new Float32Array(cells)

  const potentialAt = (x, y) => {
    const n = sampleNoise(
      noiseType,
      x * scale + time * 0.15,
      y * scale - time * 0.11,
      octaves,
      lac,
      gain,
    )
    return shapeValue(n, shapeOp, shapeAmount)
  }

  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const idx = j * res + i
      const x = i / (res - 1)
      const y = j / (res - 1)

      const p = potentialAt(x, y)
      potential[idx] = p

      // 2D curl of scalar potential ψ: (∂ψ/∂y, -∂ψ/∂x)
      const dPdy = (potentialAt(x, y + EPS) - potentialAt(x, y - EPS)) / (2 * EPS)
      const dPdx = (potentialAt(x + EPS, y) - potentialAt(x - EPS, y)) / (2 * EPS)
      const cx = dPdy * strength
      const cy = -dPdx * strength
      const m = Math.hypot(cx, cy)

      vx[idx] = cx
      vy[idx] = cy
      mag[idx] = m
    }
  }

  // Normalize magnitude for display / vector strength
  let maxMag = 1e-6
  for (let k = 0; k < cells; k++) maxMag = Math.max(maxMag, mag[k])
  const normMag = new Float32Array(cells)
  for (let k = 0; k < cells; k++) normMag[k] = mag[k] / maxMag

  // Shared unit height field — source of truth for 2D height map + 3D terrain.
  // Blend curl magnitude with remapped potential; displace is applied at render time.
  const height = new Float32Array(cells)
  for (let k = 0; k < cells; k++) {
    height[k] = normMag[k] * 0.65 + ((potential[k] + 1) * 0.5) * 0.35
  }

  return { resolution: res, vx, vy, mag: normMag, potential, height, maxMag }
}

/**
 * Sample the shared unit height field (× displace for mesh elevation).
 * Same values drive the 2D HEIGHT MAP grayscale and 3D Terrain Y.
 */
export function sampleHeight(noiseMap, u, v, displace = 1) {
  if (!noiseMap?.height) return 0
  return sampleField(noiseMap.height, noiseMap.resolution, u, v) * displace
}

/** Bilinear sample of a scalar field (u,v in [0,1]). */
export function sampleField(data, resolution, u, v) {
  const res = resolution
  const x = Math.min(1, Math.max(0, u)) * (res - 1)
  const y = Math.min(1, Math.max(0, v)) * (res - 1)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(res - 1, x0 + 1)
  const y1 = Math.min(res - 1, y0 + 1)
  const tx = x - x0
  const ty = y - y0

  const a = data[y0 * res + x0]
  const b = data[y0 * res + x1]
  const c = data[y1 * res + x0]
  const d = data[y1 * res + x1]

  const ab = a + (b - a) * tx
  const cd = c + (d - c) * tx
  return ab + (cd - ab) * ty
}
