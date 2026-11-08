import assert from 'node:assert/strict'
import test from 'node:test'
import { organismAnchorFor } from './cameraPoses.js'
import { normalizeWorldFinalConfig, WORLD_FINAL_DEFAULTS } from './config.js'
import { heightAt } from './heightField.js'
import { buildSprayGeometry, SPRAY_BASE_COUNT, SPRAY_MAX_COUNT, spraySites } from './seabedSprays.js'

test('spray sites: deterministic, rooted in the seabed, inside the basin', () => {
  const cfg = normalizeWorldFinalConfig({ ...WORLD_FINAL_DEFAULTS, sprayDensity: 1 })
  const anchor = organismAnchorFor(cfg)
  const a = spraySites(cfg, anchor)
  const b = spraySites(cfg, anchor)
  assert.equal(a.length, SPRAY_BASE_COUNT)
  assert.deepEqual(a.map((s) => s.x), b.map((s) => s.x))
  for (const s of a) {
    const ground = heightAt(s.x, s.z, cfg)
    assert.ok(s.y <= ground && s.y > ground - 1.5, 'root just below the surface')
    assert.ok(Math.hypot(s.x, s.z) < cfg.basinRadius * 1.05)
    assert.ok(s.normal.y > 0.5 && s.scale > 1 && s.scale < 10)
  }
  const near = a.filter((s) => Math.hypot(s.x - anchor.x, s.z - anchor.z) < anchor.radius * 8)
  assert.ok(near.length >= SPRAY_BASE_COUNT * 0.2, `near organism ${near.length}`)
})

test('spray density scales the count, within the instance budget', () => {
  const at = (sprayDensity) => spraySites(normalizeWorldFinalConfig({ sprayDensity })).length
  assert.equal(at(0), 0)
  assert.equal(at(2), SPRAY_MAX_COUNT)
  assert.ok(at(0.5) < at(1))
})

test('spray prototype is a light crown with beads', () => {
  const g = buildSprayGeometry()
  const triangles = g.index.count / 3
  assert.ok(triangles < 1300, `triangles ${triangles}`)
  const bead = g.attributes.aBead.array
  assert.ok(bead.some((v) => v === 1) && bead.some((v) => v === 0))
  g.computeBoundingBox()
  assert.ok(g.boundingBox.max.y > 0.6 && g.boundingBox.max.y < 1.6)
  g.dispose()
})
