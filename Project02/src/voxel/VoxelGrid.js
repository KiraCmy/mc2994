/**
 * Flat 3D scalar grid for the Voxel tab.
 *
 * Axis order (right-handed, Y-up — matches Three.js):
 *   i → X (right)
 *   j → Y (up)
 *   k → Z (toward camera when looking down −Z in a typical Three view)
 *
 * Linear index (X varies fastest):
 *   index(i, j, k) = i + j * size + k * size * size
 *
 * World position of cell center (i, j, k):
 *   p = origin + (i + 0.5, j + 0.5, k + 0.5) * voxelSize
 */

/**
 * @param {{ size?: number, voxelSize?: number, origin?: [number, number, number] }} options
 * @returns {{
 *   size: number,
 *   voxelSize: number,
 *   origin: [number, number, number],
 *   values: Float32Array,
 *   index: (i: number, j: number, k: number) => number,
 *   cellCount: number,
 * }}
 */
export function createVoxelGrid({ size = 16, voxelSize = 0.2, origin } = {}) {
  const n = Math.max(1, Math.floor(size))
  const cellCount = n * n * n
  const half = (n * voxelSize) * 0.5
  const originVec = origin ?? [-half, -half, -half]

  return {
    size: n,
    voxelSize,
    origin: /** @type {[number, number, number]} */ ([originVec[0], originVec[1], originVec[2]]),
    values: new Float32Array(cellCount),
    cellCount,
    index: (i, j, k) => index3(n, i, j, k),
  }
}

/** Linear index: X varies fastest, then Y, then Z. */
export function index3(size, i, j, k) {
  return i + j * size + k * size * size
}

/** World-space center of cell (i, j, k). */
export function cellCenter(grid, i, j, k) {
  const { origin, voxelSize } = grid
  return {
    x: origin[0] + (i + 0.5) * voxelSize,
    y: origin[1] + (j + 0.5) * voxelSize,
    z: origin[2] + (k + 0.5) * voxelSize,
  }
}

/**
 * Sample a density function at every cell center.
 * Stores continuous floats (not 0/1) so later stages can isosurface the same buffer.
 * Convention: d > 0 solid, d < 0 air, d = 0 surface.
 *
 * @param {ReturnType<typeof createVoxelGrid>} grid
 * @param {(p: { x: number, y: number, z: number }) => number} densityFn
 */
export function fillFromDensity(grid, densityFn) {
  const { size, values } = grid
  for (let k = 0; k < size; k++) {
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const p = cellCenter(grid, i, j, k)
        values[index3(size, i, j, k)] = densityFn(p)
      }
    }
  }
  return grid
}

/**
 * Hardcoded sphere: d = r - length(p - center).
 * Positive inside (solid), negative outside (air).
 */
export function fillSphere(grid, { center = [0, 0, 0], radius } = {}) {
  const extent = grid.size * grid.voxelSize
  const r = radius ?? extent * 0.35
  const [cx, cy, cz] = center

  return fillFromDensity(grid, (p) => {
    const dx = p.x - cx
    const dy = p.y - cy
    const dz = p.z - cz
    return r - Math.hypot(dx, dy, dz)
  })
}
