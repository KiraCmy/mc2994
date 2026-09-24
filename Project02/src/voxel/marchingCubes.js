import { EDGE_TABLE, TRI_TABLE } from './mcTables.js'

/**
 * Marching Cubes on a voxel scalar grid (Stage 5 / Stage 8 opt).
 * Tables: Paul Bourke / Cory Bloyd (public reference).
 *
 * Corner order (x,y,z) with our i→X, j→Y, k→Z lattice:
 *   0:(i,j,k) 1:(i+1,j,k) 2:(i+1,j,k+1) 3:(i,j,k+1)
 *   4:(i,j+1,k) 5:(i+1,j+1,k) 6:(i+1,j+1,k+1) 7:(i,j+1,k+1)
 *
 * Density convention: values[i] > iso → solid (same as VoxelBlocks).
 *
 * Hot path avoids per-cell object allocation — Stage 6 showed mesh ≫ fill.
 *
 * @param {{ size: number, voxelSize: number, origin: [number,number,number], values: Float32Array }} grid
 * @param {number} [iso=0]
 * @returns {{ positions: Float32Array, normals: Float32Array, triangleCount: number }}
 */

// Corner offsets (shared, never reallocated).
const CX = [0, 1, 1, 0, 0, 1, 1, 0]
const CY = [0, 0, 0, 0, 1, 1, 1, 1]
const CZ = [0, 0, 1, 1, 0, 0, 1, 1]

// Edge endpoints (Bourke edge index → corner pair)
const EDGE_A = [0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3]
const EDGE_B = [1, 2, 3, 0, 5, 6, 7, 4, 4, 5, 6, 7]

export function meshFromScalarField(grid, iso = 0) {
  const { size, values, origin, voxelSize } = grid
  if (!grid || size < 2) {
    return {
      positions: new Float32Array(0),
      normals: new Float32Array(0),
      triangleCount: 0,
    }
  }

  const ox = origin[0]
  const oy = origin[1]
  const oz = origin[2]
  const vs = voxelSize
  const size2 = size * size

  // Growable typed buffers (avoid JS Array push + final copy of huge lists).
  let cap = 1 << 12 // floats
  let positions = new Float32Array(cap)
  let normals = new Float32Array(cap)
  let cursor = 0

  const ensure = (need) => {
    if (cursor + need <= cap) return
    let next = cap
    while (cursor + need > next) next *= 2
    const np = new Float32Array(next)
    const nn = new Float32Array(next)
    np.set(positions.subarray(0, cursor))
    nn.set(normals.subarray(0, cursor))
    positions = np
    normals = nn
    cap = next
  }

  const cornerV = new Float32Array(8)
  const cornerX = new Float32Array(8)
  const cornerY = new Float32Array(8)
  const cornerZ = new Float32Array(8)
  const vertX = new Float32Array(12)
  const vertY = new Float32Array(12)
  const vertZ = new Float32Array(12)

  for (let k = 0; k < size - 1; k++) {
    for (let j = 0; j < size - 1; j++) {
      for (let i = 0; i < size - 1; i++) {
        let cubeindex = 0
        for (let c = 0; c < 8; c++) {
          const ii = i + CX[c]
          const jj = j + CY[c]
          const kk = k + CZ[c]
          const v = values[ii + jj * size + kk * size2]
          cornerV[c] = v
          cornerX[c] = ox + (ii + 0.5) * vs
          cornerY[c] = oy + (jj + 0.5) * vs
          cornerZ[c] = oz + (kk + 0.5) * vs
          if (v > iso) cubeindex |= 1 << c
        }

        const edgeMask = EDGE_TABLE[cubeindex]
        if (edgeMask === 0) continue

        for (let e = 0; e < 12; e++) {
          if ((edgeMask & (1 << e)) === 0) continue
          const a = EDGE_A[e]
          const b = EDGE_B[e]
          const v1 = cornerV[a]
          const v2 = cornerV[b]
          const x1 = cornerX[a]
          const y1 = cornerY[a]
          const z1 = cornerZ[a]
          const x2 = cornerX[b]
          const y2 = cornerY[b]
          const z2 = cornerZ[b]

          if (Math.abs(iso - v1) < 1e-5) {
            vertX[e] = x1
            vertY[e] = y1
            vertZ[e] = z1
          } else if (Math.abs(iso - v2) < 1e-5) {
            vertX[e] = x2
            vertY[e] = y2
            vertZ[e] = z2
          } else if (Math.abs(v1 - v2) < 1e-5) {
            vertX[e] = x1
            vertY[e] = y1
            vertZ[e] = z1
          } else {
            const mu = (iso - v1) / (v2 - v1)
            vertX[e] = x1 + mu * (x2 - x1)
            vertY[e] = y1 + mu * (y2 - y1)
            vertZ[e] = z1 + mu * (z2 - z1)
          }
        }

        const base = cubeindex * 16
        for (let t = 0; t < 16; t += 3) {
          const e0 = TRI_TABLE[base + t]
          if (e0 === -1) break
          // Reverse winding so normals face outward for >iso solid.
          const e1 = TRI_TABLE[base + t + 2]
          const e2 = TRI_TABLE[base + t + 1]

          const ax = vertX[e0]
          const ay = vertY[e0]
          const az = vertZ[e0]
          const bx = vertX[e1]
          const by = vertY[e1]
          const bz = vertZ[e1]
          const cx = vertX[e2]
          const cy = vertY[e2]
          const cz = vertZ[e2]

          const e1x = bx - ax
          const e1y = by - ay
          const e1z = bz - az
          const e2x = cx - ax
          const e2y = cy - ay
          const e2z = cz - az
          let nx = e1y * e2z - e1z * e2y
          let ny = e1z * e2x - e1x * e2z
          let nz = e1x * e2y - e1y * e2x
          const len = Math.hypot(nx, ny, nz) || 1
          nx /= len
          ny /= len
          nz /= len

          ensure(9)
          positions[cursor] = ax
          positions[cursor + 1] = ay
          positions[cursor + 2] = az
          positions[cursor + 3] = bx
          positions[cursor + 4] = by
          positions[cursor + 5] = bz
          positions[cursor + 6] = cx
          positions[cursor + 7] = cy
          positions[cursor + 8] = cz
          normals[cursor] = nx
          normals[cursor + 1] = ny
          normals[cursor + 2] = nz
          normals[cursor + 3] = nx
          normals[cursor + 4] = ny
          normals[cursor + 5] = nz
          normals[cursor + 6] = nx
          normals[cursor + 7] = ny
          normals[cursor + 8] = nz
          cursor += 9
        }
      }
    }
  }

  return {
    positions: positions.slice(0, cursor),
    normals: normals.slice(0, cursor),
    triangleCount: (cursor / 9) | 0,
  }
}
