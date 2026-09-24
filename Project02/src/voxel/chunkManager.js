import {
  clearChunkDirty,
  createChunk,
  disposeChunkGeometry,
  markAllChunksDirty,
  markChunkDirty,
} from './chunk.js'
import { meshFromScalarField } from './marchingCubes.js'
import { meshCulledFaces } from './meshing/culledFaces.js'
import { cellCenter, fillFromDensity, index3 } from './VoxelGrid.js'

/**
 * Fixed chunk block around the origin (Stage 6 / Stage 8).
 *
 * Default: 2×2×2 chunks centered on the world origin. Every cell samples the
 * same world-space density. Halo meshing keeps seams consistent.
 *
 * Empty skip (Stage 8): chunks with all values ≤ iso never run MC.
 */

const EMPTY_MESH = {
  positions: new Float32Array(0),
  normals: new Float32Array(0),
  triangleCount: 0,
}

/**
 * True when every cell is air (≤ iso) — no surface inside this chunk.
 * @param {{ values: Float32Array }} chunk
 * @param {number} [iso=0]
 */
export function isChunkEmpty(chunk, iso = 0) {
  const { values } = chunk
  for (let i = 0; i < values.length; i++) {
    if (values[i] > iso) return false
  }
  return true
}

/** Aggregate counts after a remesh pass. */
export function chunkBlockStats(chunks) {
  let drawnCount = 0
  let skippedCount = 0
  let triangleCount = 0
  for (const chunk of chunks) {
    if (chunk.drawn) {
      drawnCount += 1
      triangleCount += chunk.lastTriangleCount ?? 0
    } else {
      skippedCount += 1
    }
  }
  return {
    chunkCount: chunks.length,
    drawnCount,
    skippedCount,
    triangleCount,
  }
}

/**
 * Chunk coordinates for an nx×ny×nz block centered on the origin.
 * Odd sizes place a chunk at 0; even sizes straddle 0 (e.g. 2 → -1..0).
 */
export function centeredChunkCoords(nx = 2, ny = 2, nz = 2) {
  const coords = []
  const ox = -Math.floor(nx / 2)
  const oy = -Math.floor(ny / 2)
  const oz = -Math.floor(nz / 2)
  for (let cz = 0; cz < nz; cz++) {
    for (let cy = 0; cy < ny; cy++) {
      for (let cx = 0; cx < nx; cx++) {
        coords.push({ cx: ox + cx, cy: oy + cy, cz: oz + cz })
      }
    }
  }
  return coords
}

/**
 * Create empty chunks for a fixed block (no fill yet).
 * @returns {ReturnType<typeof createChunk>[]}
 */
export function createChunkBlock({
  nx = 2,
  ny = 2,
  nz = 2,
  chunkSize = 16,
  voxelSize = 0.2,
} = {}) {
  return centeredChunkCoords(nx, ny, nz).map(({ cx, cy, cz }) =>
    createChunk({ cx, cy, cz, size: chunkSize, voxelSize }),
  )
}

/**
 * Fill every chunk with the same world-space density function.
 * @param {ReturnType<typeof createChunk>[]} chunks
 * @param {(p: { x: number, y: number, z: number }) => number} densityFn
 * @param {{ onlyDirty?: boolean }} [options]
 */
export function fillChunkBlock(chunks, densityFn, { onlyDirty = false } = {}) {
  for (const chunk of chunks) {
    if (onlyDirty && !chunk.dirty) continue
    fillFromDensity(
      {
        size: chunk.size,
        voxelSize: chunk.voxelSize,
        origin: chunk.origin,
        values: chunk.values,
      },
      densityFn,
    )
    disposeChunkGeometry(chunk)
    chunk.lastMesh = null
    chunk.drawn = false
    chunk.empty = false
    markChunkDirty(chunk)
  }
  return chunks
}

/**
 * Remesh dirty chunks. Stage 8: skip empty chunks (all values ≤ iso).
 * mesherId 'mc' uses halo MC; 'culled' meshes each chunk as a local grid.
 *
 * @param {ReturnType<typeof createChunk>[]} chunks
 * @param {number} [iso]
 * @param {(p: { x: number, y: number, z: number }) => number | null} [densityFn]
 * @param {{ onlyDirty?: boolean, mesherId?: string }} [options]
 * @returns {{ chunkCount: number, drawnCount: number, skippedCount: number, triangleCount: number, quadCount: number | null }}
 */
export function remeshChunkBlock(
  chunks,
  iso = 0,
  densityFn = null,
  { onlyDirty = true, mesherId = 'mc' } = {},
) {
  let quadCount = null

  for (const chunk of chunks) {
    if (onlyDirty && !chunk.dirty) continue

    disposeChunkGeometry(chunk)

    if (isChunkEmpty(chunk, iso)) {
      chunk.lastTriangleCount = 0
      chunk.lastQuadCount = 0
      chunk.lastMesh = EMPTY_MESH
      chunk.drawn = false
      chunk.empty = true
      clearChunkDirty(chunk)
      continue
    }

    const mesh =
      mesherId === 'culled'
        ? meshCulledFaces(
            {
              size: chunk.size,
              voxelSize: chunk.voxelSize,
              origin: chunk.origin,
              values: chunk.values,
            },
            iso,
          )
        : meshChunkWithHalo(chunk, chunks, iso, densityFn)

    chunk.lastTriangleCount = mesh.triangleCount
    chunk.lastQuadCount = mesh.quadCount ?? 0
    chunk.lastMesh = mesh
    chunk.empty = false
    chunk.drawn = mesh.triangleCount > 0
    if (!chunk.drawn) chunk.empty = true
    if (typeof mesh.quadCount === 'number') {
      quadCount = (quadCount ?? 0) + mesh.quadCount
    }
    clearChunkDirty(chunk)
  }

  return { ...chunkBlockStats(chunks), quadCount }
}

/**
 * Allocate + fill a centered chunk block in one call.
 * @param {(p: { x: number, y: number, z: number }) => number} densityFn
 */
export function generateChunkBlock(densityFn, options = {}) {
  const chunks = createChunkBlock(options)
  markAllChunksDirty(chunks)
  fillChunkBlock(chunks, densityFn)
  return chunks
}

/** Look up a chunk by integer coords. */
export function findChunk(chunks, cx, cy, cz) {
  return chunks.find((c) => c.cx === cx && c.cy === cy && c.cz === cz) ?? null
}

/**
 * Sample density at chunk-local (i,j,k), walking into neighbors when out of range.
 * Falls back to densityFn(world p) when the neighbor chunk is missing.
 */
export function sampleWithHalo(chunks, chunk, i, j, k, densityFn) {
  const size = chunk.size
  let { cx, cy, cz } = chunk
  let li = i
  let lj = j
  let lk = k

  while (li >= size) {
    li -= size
    cx += 1
  }
  while (li < 0) {
    li += size
    cx -= 1
  }
  while (lj >= size) {
    lj -= size
    cy += 1
  }
  while (lj < 0) {
    lj += size
    cy -= 1
  }
  while (lk >= size) {
    lk -= size
    cz += 1
  }
  while (lk < 0) {
    lk += size
    cz -= 1
  }

  const target = findChunk(chunks, cx, cy, cz)
  if (target) {
    return target.values[index3(size, li, lj, lk)]
  }

  const origin = /** @type {[number, number, number]} */ ([
    cx * size * chunk.voxelSize,
    cy * size * chunk.voxelSize,
    cz * size * chunk.voxelSize,
  ])
  const p = cellCenter({ origin, voxelSize: chunk.voxelSize }, li, lj, lk)
  return densityFn ? densityFn(p) : 0
}

/**
 * (size+1)³ scalar field: chunk interior + +X/+Y/+Z halo planes.
 */
export function buildHaloField(chunk, chunks, densityFn) {
  const n = chunk.size
  const halo = n + 1
  const values = new Float32Array(halo * halo * halo)

  for (let k = 0; k < halo; k++) {
    for (let j = 0; j < halo; j++) {
      for (let i = 0; i < halo; i++) {
        values[index3(halo, i, j, k)] = sampleWithHalo(chunks, chunk, i, j, k, densityFn)
      }
    }
  }

  return {
    size: halo,
    voxelSize: chunk.voxelSize,
    origin: chunk.origin,
    values,
  }
}

/**
 * Marching Cubes for one chunk with a 1-cell positive halo so seams meet.
 */
export function meshChunkWithHalo(chunk, chunks, iso = 0, densityFn = null) {
  const field = buildHaloField(chunk, chunks, densityFn)
  return meshFromScalarField(field, iso)
}

/** Sample density at a local cell, or null if out of this chunk. */
export function sampleChunk(chunk, i, j, k) {
  if (i < 0 || j < 0 || k < 0 || i >= chunk.size || j >= chunk.size || k >= chunk.size) {
    return null
  }
  return chunk.values[index3(chunk.size, i, j, k)]
}

/** World-space center of a cell inside a chunk (same formula as VoxelGrid). */
export function chunkCellCenter(chunk, i, j, k) {
  return cellCenter(
    { origin: chunk.origin, voxelSize: chunk.voxelSize },
    i,
    j,
    k,
  )
}

export {
  markAllChunksDirty,
  markChunkDirty,
  clearChunkDirty,
} from './chunk.js'
export {
  markChunksOverlappingAabb,
  markChunksOverlappingSphere,
  dirtyChunks,
} from './chunk.js'
