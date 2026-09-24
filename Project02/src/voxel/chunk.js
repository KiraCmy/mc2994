import { createVoxelGrid, index3 } from './VoxelGrid.js'

/**
 * Chunk struct (Stage 6).
 *
 * {
 *   cx, cy, cz,   // chunk coords in chunk space
 *   size,         // cells per axis (e.g. 16)
 *   values,       // Float32Array density (size³)
 *   geometry,     // THREE.BufferGeometry | null (filled by mesher later)
 * }
 *
 * World origin of chunk (min corner of cell (0,0,0)):
 *   origin = [cx, cy, cz] * size * voxelSize
 * Sample lattice matches VoxelGrid (cell centers, i→X j→Y k→Z).
 */

/**
 * @param {{
 *   cx?: number,
 *   cy?: number,
 *   cz?: number,
 *   size?: number,
 *   voxelSize?: number,
 * }} [options]
 */
export function createChunk({
  cx = 0,
  cy = 0,
  cz = 0,
  size = 16,
  voxelSize = 0.2,
} = {}) {
  const n = Math.max(1, Math.floor(size))
  const origin = /** @type {[number, number, number]} */ ([
    cx * n * voxelSize,
    cy * n * voxelSize,
    cz * n * voxelSize,
  ])

  const grid = createVoxelGrid({ size: n, voxelSize, origin })

  return {
    cx,
    cy,
    cz,
    size: n,
    voxelSize,
    origin,
    values: grid.values,
    /** @type {import('three').BufferGeometry | null} */
    geometry: null,
    /**
     * When true, chunk needs refill and/or remesh.
     * Global noise → markAllChunksDirty; CSG brush move → mark overlapping only.
     */
    dirty: true,
    /** Stable key for maps / React lists */
    key: `${cx},${cy},${cz}`,
    index: (i, j, k) => index3(n, i, j, k),
  }
}

/** World-space AABB of the chunk volume (inclusive of full cell extents). */
export function chunkBounds(chunk) {
  const extent = chunk.size * chunk.voxelSize
  const [ox, oy, oz] = chunk.origin
  return {
    min: [ox, oy, oz],
    max: [ox + extent, oy + extent, oz + extent],
  }
}

/** Dispose GPU geometry if present and clear the handle. */
export function disposeChunkGeometry(chunk) {
  if (chunk.geometry) {
    chunk.geometry.dispose()
    chunk.geometry = null
  }
}

export function markChunkDirty(chunk) {
  chunk.dirty = true
}

export function clearChunkDirty(chunk) {
  chunk.dirty = false
}

/** Required path: any global noise / shape / threshold change dirties everything. */
export function markAllChunksDirty(chunks) {
  for (const chunk of chunks) markChunkDirty(chunk)
  return chunks
}

export function dirtyChunks(chunks) {
  return chunks.filter((c) => c.dirty)
}

/**
 * Optional path: dirty only chunks whose AABB overlaps a world-space box
 * (e.g. CSG brush bounds). Neighbors that share a face are also dirtied so
 * halo meshing stays consistent.
 */
export function markChunksOverlappingAabb(chunks, min, max, { includeFaceNeighbors = true } = {}) {
  const hit = []
  for (const chunk of chunks) {
    const b = chunkBounds(chunk)
    const overlaps =
      min[0] <= b.max[0] &&
      max[0] >= b.min[0] &&
      min[1] <= b.max[1] &&
      max[1] >= b.min[1] &&
      min[2] <= b.max[2] &&
      max[2] >= b.min[2]
    if (overlaps) {
      markChunkDirty(chunk)
      hit.push(chunk)
    }
  }

  if (includeFaceNeighbors && hit.length) {
    const keys = new Set(hit.map((c) => c.key))
    for (const chunk of hit) {
      for (const [dx, dy, dz] of [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ]) {
        const n = chunks.find(
          (c) => c.cx === chunk.cx + dx && c.cy === chunk.cy + dy && c.cz === chunk.cz + dz,
        )
        if (n && !keys.has(n.key)) {
          markChunkDirty(n)
          keys.add(n.key)
        }
      }
    }
  }

  return chunks.filter((c) => c.dirty)
}

/** Sphere brush helper → AABB, then mark overlapping chunks. */
export function markChunksOverlappingSphere(chunks, center, radius) {
  const [cx, cy, cz] = center
  const r = Math.abs(radius)
  return markChunksOverlappingAabb(
    chunks,
    [cx - r, cy - r, cz - r],
    [cx + r, cy + r, cz + r],
  )
}
