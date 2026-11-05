import assert from 'node:assert/strict'
import test from 'node:test'
import { WORLD_FINAL_DEFAULTS } from './config.js'
import { auditSeabedGeometry, buildSeabedGeometry } from './buildSeabedGeometry.js'
import { heightAt } from './heightField.js'

test('seabed geometry lies in XZ with Y elevation matching heightAt', () => {
  const geometry = buildSeabedGeometry({ ...WORLD_FINAL_DEFAULTS, gridRes: 48 })
  const bb = geometry.boundingBox
  const span = bb.max.x - bb.min.x
  assert.ok(span > 800 && bb.max.z - bb.min.z > 800)
  assert.ok(bb.max.y - bb.min.y < span * 0.2, 'Y span too large (vertical wall?)')

  const pos = geometry.attributes.position
  for (let i = 0; i < pos.count; i += 7) {
    const y = pos.getY(i)
    const expected = heightAt(pos.getX(i), pos.getZ(i), WORLD_FINAL_DEFAULTS)
    assert.ok(Math.abs(y - expected) < 1e-4, `height mismatch at vertex ${i}`)
  }
  geometry.dispose()
})

test('every triangle is front-facing upward with finite, upward normals', () => {
  for (const seed of [1, 1042, 7777]) {
    const geometry = buildSeabedGeometry({
      ...WORLD_FINAL_DEFAULTS,
      seed,
      gridRes: 128,
      basinDepth: 140,
      basinAsymmetry: 1,
      ridgeHeight: 24,
      ridgeSpacing: 30,
      surfaceDetail: 4,
    })
    const r = auditSeabedGeometry(geometry)
    assert.equal(r.facesDown, 0, `seed ${seed}: ${r.facesDown} downward faces`)
    assert.equal(r.facesUp, r.triangles)
    assert.equal(r.degenerate, 0)
    assert.equal(r.outOfRangeIndices, 0)
    assert.equal(r.nonFinitePositions, 0)
    assert.equal(r.nonFiniteNormals, 0)
    assert.equal(r.normalsDown, 0)
    geometry.dispose()
  }
})

test('heightAt is continuous at fine scale (no tears between cells)', () => {
  const eps = 0.01
  let worst = 0
  for (let i = 0; i < 4000; i += 1) {
    const x = Math.sin(i * 12.9898) * 560
    const z = Math.cos(i * 78.233) * 560
    const h = heightAt(x, z, WORLD_FINAL_DEFAULTS)
    assert.ok(Number.isFinite(h))
    const g = Math.max(
      Math.abs(heightAt(x + eps, z, WORLD_FINAL_DEFAULTS) - h),
      Math.abs(heightAt(x, z + eps, WORLD_FINAL_DEFAULTS) - h),
    ) / eps
    worst = Math.max(worst, g)
  }
  assert.ok(worst < 2, `local slope spike ${worst}`)
})
