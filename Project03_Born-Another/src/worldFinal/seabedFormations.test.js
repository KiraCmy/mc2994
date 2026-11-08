import assert from 'node:assert/strict'
import test from 'node:test'
import { organismAnchorFor } from './cameraPoses.js'
import { normalizeWorldFinalConfig, WORLD_FINAL_DEFAULTS } from './config.js'
import { heightAt } from './heightField.js'
import {
  FOLD_BASE_COUNT,
  FORMATION_BUILDERS,
  FORMATION_KINDS,
  FORMATION_MAX_COUNTS,
  formationSites,
  MINERALS_PER_FOLD,
  QUIET_RADIUS,
} from './seabedFormations.js'

test('folds are few, sunk into the sand, and keep clear of the organism', () => {
  const cfg = normalizeWorldFinalConfig(WORLD_FINAL_DEFAULTS)
  const anchor = organismAnchorFor(cfg)
  const a = formationSites(cfg, anchor)
  const b = formationSites(cfg, anchor)
  assert.equal(a.fold.length, FOLD_BASE_COUNT)
  assert.equal(a.mineral.length, FOLD_BASE_COUNT * MINERALS_PER_FOLD)
  assert.deepEqual(a.fold.map((s) => s.x), b.fold.map((s) => s.x))
  const quiet = anchor.radius * QUIET_RADIUS
  for (const s of [...a.fold, ...a.mineral]) {
    const ground = heightAt(s.x, s.z, cfg)
    assert.ok(s.y < ground && s.y > ground - s.scale, 'grown out of the sand')
    assert.ok(Math.hypot(s.x - anchor.x, s.z - anchor.z) > quiet * 0.6, 'quiet ground around the organism')
  }
})

test('minerals sit on a fold hem and nowhere else', () => {
  const cfg = normalizeWorldFinalConfig(WORLD_FINAL_DEFAULTS)
  const { fold, mineral } = formationSites(cfg, organismAnchorFor(cfg))
  for (const m of mineral) {
    const nearest = Math.min(...fold.map((f) => Math.hypot(m.x - f.x, m.z - f.z) / f.scale))
    assert.ok(nearest < 0.6, `mineral at ${nearest} of a fold`)
    assert.ok(m.scale < 1.5, 'grains stay small')
  }
})

test('formation density scales every kind within its instance budget', () => {
  const at = (formationDensity) => formationSites(normalizeWorldFinalConfig({ formationDensity }))
  const none = at(0)
  const full = at(2)
  for (const kind of FORMATION_KINDS) {
    assert.equal(none[kind].length, 0)
    assert.ok(full[kind].length <= FORMATION_MAX_COUNTS[kind])
    assert.ok(full[kind].length > at(1)[kind].length)
  }
})

test('fold is a low film, minerals are small rounded grains', () => {
  const fold = FORMATION_BUILDERS.fold()
  fold.computeBoundingBox()
  const foldSize = fold.boundingBox.getSize(fold.boundingBox.min.clone())
  assert.ok(foldSize.y < Math.max(foldSize.x, foldSize.z) * 0.7, 'the sheet lies down')
  assert.ok(fold.attributes.aBody.array.every((v) => v === 0))
  const mineral = FORMATION_BUILDERS.mineral()
  mineral.computeBoundingBox()
  const mineralSize = mineral.boundingBox.getSize(mineral.boundingBox.min.clone())
  assert.ok(Math.max(mineralSize.x, mineralSize.y, mineralSize.z) < 0.6, 'grains are small')
  assert.ok(mineralSize.y < mineralSize.x, 'grains are not spikes')
  for (const g of [fold, mineral]) {
    const triangles = g.index.count / 3
    assert.ok(triangles < 1400, `triangles ${triangles}`)
    g.dispose()
  }
})
