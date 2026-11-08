/**
 * World Final — CPU-displaced seabed geometry from heightAt.
 *
 * Vertices are authored directly in world XZ with Y = elevation, using the
 * same mapping as rotateX(−π/2): plane (x, y, 0) → world (x, h, −y).
 * The −y is required: mapping to +y mirrors the grid and flips every
 * triangle's winding, so front faces and computed normals point down.
 */
import * as THREE from 'three'
import { normalizeWorldFinalConfig, WORLD_FINAL_TERRAIN_EXTENT } from './config.js'
import { heightLayers } from './heightField.js'

function clampCue(v, min, max) {
  return Math.min(max, Math.max(min, v))
}

/**
 * Plane spans ±basinRadius·WORLD_FINAL_TERRAIN_EXTENT so the highlands past
 * the rim exist; the material fades the outer band to transparent.
 * @param {object} [config]
 * @returns {THREE.PlaneGeometry}
 */
export function buildSeabedGeometry(config) {
  const cfg = normalizeWorldFinalConfig(config)
  const size = cfg.basinRadius * 2 * WORLD_FINAL_TERRAIN_EXTENT
  const seg = cfg.gridRes
  const geometry = new THREE.PlaneGeometry(size, size, seg, seg)

  const pos = geometry.attributes.position
  /* aTerrain = (basin height 0 floor → 1 rim, ridge −1 trough → 1 crest):
     shading cues only, sampled in the same pass as the height. */
  const cues = new Float32Array(pos.count * 2)
  const basinScale = 1 / Math.max(1e-3, cfg.basinDepth)
  const ridgeScale = 1 / Math.max(1e-3, cfg.ridgeHeight)
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i)
    const z = -pos.getY(i)
    const layers = heightLayers(x, z, cfg)
    pos.setXYZ(i, x, layers.macro + layers.meso + layers.micro, z)
    cues[i * 2] = cfg.basinDepth > 1e-3 ? clampCue(layers.macro * basinScale, 0, 1.4) : 0
    cues[i * 2 + 1] = cfg.ridgeHeight > 1e-3 ? clampCue(layers.meso * ridgeScale, -1, 1) : 0
  }
  pos.needsUpdate = true
  geometry.setAttribute('aTerrain', new THREE.BufferAttribute(cues, 2))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  geometry.computeBoundingBox()
  geometry.name = 'WorldFinalSeabed'

  assertHorizontalSeabed(geometry, cfg.basinRadius)
  return geometry
}

/**
 * Throws if extents would read as a vertical wall or normals point down.
 */
export function assertHorizontalSeabed(geometry, basinRadius) {
  const bb = geometry.boundingBox
  if (!bb) return
  const sx = bb.max.x - bb.min.x
  const sy = bb.max.y - bb.min.y
  const sz = bb.max.z - bb.min.z
  const span = Math.max(1e-3, basinRadius * 2)
  if (sx < span * 0.9 || sz < span * 0.9) {
    throw new Error(
      `Seabed not horizontal in XZ (size ${sx.toFixed(1)}×${sy.toFixed(1)}×${sz.toFixed(1)})`,
    )
  }
  /* Meso relief stacks three ridge families, so the extreme slider corner
     (deep basin, tall ridges) is taller than a single family allowed. */
  if (sy > span * 0.5) {
    throw new Error(
      `Seabed Y extent too large for a basin (${sy.toFixed(1)} vs span ${span.toFixed(1)})`,
    )
  }
  const normal = geometry.attributes.normal
  if (normal && normal.count > 0 && normal.getY(Math.floor(normal.count / 2)) <= 0) {
    throw new Error('Seabed normals point down — triangle winding is flipped')
  }
}

/**
 * Integrity audit for tests / diagnostics.
 * @returns {{ triangles: number, facesUp: number, facesDown: number,
 *   degenerate: number, nonFinitePositions: number, nonFiniteNormals: number,
 *   normalsDown: number, outOfRangeIndices: number }}
 */
export function auditSeabedGeometry(geometry) {
  const pos = geometry.attributes.position
  const nrm = geometry.attributes.normal
  const index = geometry.index.array
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const e1 = new THREE.Vector3()
  const e2 = new THREE.Vector3()
  const report = {
    triangles: index.length / 3,
    facesUp: 0,
    facesDown: 0,
    degenerate: 0,
    nonFinitePositions: 0,
    nonFiniteNormals: 0,
    normalsDown: 0,
    outOfRangeIndices: 0,
  }
  for (let i = 0; i < index.length; i += 3) {
    const ia = index[i]
    const ib = index[i + 1]
    const ic = index[i + 2]
    if (ia >= pos.count || ib >= pos.count || ic >= pos.count) {
      report.outOfRangeIndices += 1
      continue
    }
    a.fromBufferAttribute(pos, ia)
    b.fromBufferAttribute(pos, ib)
    c.fromBufferAttribute(pos, ic)
    e1.subVectors(b, a)
    e2.subVectors(c, a)
    e1.cross(e2)
    if (e1.lengthSq() < 1e-12) report.degenerate += 1
    if (e1.y > 0) report.facesUp += 1
    else report.facesDown += 1
  }
  for (let i = 0; i < pos.array.length; i += 1) {
    if (!Number.isFinite(pos.array[i])) report.nonFinitePositions += 1
    if (!Number.isFinite(nrm.array[i])) report.nonFiniteNormals += 1
  }
  for (let i = 0; i < nrm.count; i += 1) {
    if (nrm.getY(i) <= 0) report.normalsDown += 1
  }
  return report
}
