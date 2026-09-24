import { cellCenter, index3 } from '../VoxelGrid.js'

/**
 * Culled-faces mesher (Stage 7).
 * Binary / thresholded volume → quads only where solid meets air.
 * Blocky look, lowest-cost face emission (Minecraft-style).
 *
 * Face order: -X, +X, -Y, +Y, -Z, +Z
 * Each quad is two triangles in a non-indexed soup (same as MC output shape).
 *
 * @param {{ size: number, voxelSize: number, origin: [number,number,number], values: Float32Array }} grid
 * @param {number} [iso=0] — solid if values[i] > iso
 * @returns {{ positions: Float32Array, normals: Float32Array, triangleCount: number, quadCount: number }}
 */

const FACES = [
  {
    // -X
    dir: [-1, 0, 0],
    corners: [
      [0, 0, 1],
      [0, 0, 0],
      [0, 1, 0],
      [0, 1, 1],
    ],
    normal: [-1, 0, 0],
  },
  {
    // +X
    dir: [1, 0, 0],
    corners: [
      [1, 0, 0],
      [1, 0, 1],
      [1, 1, 1],
      [1, 1, 0],
    ],
    normal: [1, 0, 0],
  },
  {
    // -Y
    dir: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    normal: [0, -1, 0],
  },
  {
    // +Y
    dir: [0, 1, 0],
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    normal: [0, 1, 0],
  },
  {
    // -Z
    dir: [0, 0, -1],
    corners: [
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ],
    normal: [0, 0, -1],
  },
  {
    // +Z
    dir: [0, 0, 1],
    corners: [
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
      [0, 0, 1],
    ],
    normal: [0, 0, 1],
  },
]

function isSolid(grid, i, j, k, iso) {
  const { size, values } = grid
  if (i < 0 || j < 0 || k < 0 || i >= size || j >= size || k >= size) return false
  return values[index3(size, i, j, k)] > iso
}

/** World-space corner of cell (i,j,k) with local corner offsets in {0,1}. */
function cornerWorld(grid, i, j, k, ci, cj, ck) {
  const { origin, voxelSize } = grid
  return {
    x: origin[0] + (i + ci) * voxelSize,
    y: origin[1] + (j + cj) * voxelSize,
    z: origin[2] + (k + ck) * voxelSize,
  }
}

/**
 * Emit culled quads for a scalar grid.
 * Cell centers still define solid/air; faces sit on the cell AABB (axis-aligned).
 */
export function meshCulledFaces(grid, iso = 0) {
  if (!grid || grid.size < 1) {
    return {
      positions: new Float32Array(0),
      normals: new Float32Array(0),
      triangleCount: 0,
      quadCount: 0,
    }
  }

  const { size } = grid
  const positions = []
  const normals = []
  let quadCount = 0

  const pushQuad = (c0, c1, c2, c3, nx, ny, nz) => {
    // Two triangles: 0-1-2 and 0-2-3
    positions.push(c0.x, c0.y, c0.z, c1.x, c1.y, c1.z, c2.x, c2.y, c2.z)
    positions.push(c0.x, c0.y, c0.z, c2.x, c2.y, c2.z, c3.x, c3.y, c3.z)
    for (let n = 0; n < 6; n++) normals.push(nx, ny, nz)
    quadCount += 1
  }

  for (let k = 0; k < size; k++) {
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        if (!isSolid(grid, i, j, k, iso)) continue

        for (const face of FACES) {
          const [di, dj, dk] = face.dir
          if (isSolid(grid, i + di, j + dj, k + dk, iso)) continue

          const [nx, ny, nz] = face.normal
          const corners = face.corners.map(([ci, cj, ck]) =>
            cornerWorld(grid, i, j, k, ci, cj, ck),
          )
          pushQuad(corners[0], corners[1], corners[2], corners[3], nx, ny, nz)
        }
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    triangleCount: quadCount * 2,
    quadCount,
  }
}

/** Registry id for Stage 7 mesher dropdown. */
export const CULLED_FACES_MESHER = {
  id: 'culled',
  label: 'CULLED FACES',
  input: 'binary',
  mesh: meshCulledFaces,
}

/** Kept for docs — cell-center helper if a caller needs it. */
export { cellCenter }
