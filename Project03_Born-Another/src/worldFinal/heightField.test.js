import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeWorldFinalConfig, WORLD_FINAL_DEFAULTS } from './config.js'
import {
  basinFrame,
  heightAt,
  heightLayers,
  meanHeightOnRing,
  radiusNorm,
} from './heightField.js'

const D = normalizeWorldFinalConfig(WORLD_FINAL_DEFAULTS)

function std(values) {
  const m = values.reduce((s, v) => s + v, 0) / values.length
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length)
}

function layerStd(cfg) {
  const out = { macro: [], meso: [], micro: [] }
  for (let x = -440; x <= 440; x += 11) {
    for (let z = -440; z <= 440; z += 11) {
      const L = heightLayers(x, z, cfg)
      out.macro.push(L.macro)
      out.meso.push(L.meso)
      out.micro.push(L.micro)
    }
  }
  return { macro: std(out.macro), meso: std(out.meso), micro: std(out.micro) }
}

test('heightAt is deterministic for fixed seed/config', () => {
  const a = heightAt(40, -25, D)
  assert.equal(a, heightAt(40, -25, { ...WORLD_FINAL_DEFAULTS }))
  assert.ok(Number.isFinite(a))
})

test('heightAt changes with seed', () => {
  assert.notEqual(
    heightAt(40, -25, { ...WORLD_FINAL_DEFAULTS, seed: 1 }),
    heightAt(40, -25, { ...WORLD_FINAL_DEFAULTS, seed: 99 }),
  )
})

test('radiusNorm is distance / basinRadius', () => {
  assert.ok(Math.abs(radiusNorm(200, 0, { basinRadius: 400 }) - 0.5) < 1e-9)
})

test('macro dominates meso, meso dominates micro', () => {
  const s = layerStd(D)
  assert.ok(s.macro > s.meso * 4, `macro ${s.macro} vs meso ${s.meso}`)
  assert.ok(s.meso > s.micro * 4, `meso ${s.meso} vs micro ${s.micro}`)
})

test('basin: low centre, rim clearly higher, highlands beyond', () => {
  const floor = meanHeightOnRing(0.05, D, 32)
  const mid = meanHeightOnRing(0.4, D, 32)
  const rim = meanHeightOnRing(D.basinWidth, D, 32)
  const beyond = meanHeightOnRing(D.basinWidth * 1.3, D, 32)
  assert.ok(rim - floor > D.basinDepth * 0.7, `rim ${rim} floor ${floor}`)
  assert.ok(mid > floor && rim > mid, 'monotonic rise floor → rim')
  assert.ok(beyond > rim, 'surroundings stay elevated past the rim')
})

test('basin is asymmetric: rim height varies by direction and centre is offset', () => {
  const f = basinFrame(D)
  assert.ok(Math.hypot(f.cx, f.cz) > 10, 'centre should be offset at default asymmetry')
  const rims = []
  for (let i = 0; i < 16; i += 1) {
    const t = (i / 16) * Math.PI * 2
    rims.push(heightAt(f.cx + Math.cos(t) * f.rimRadius, f.cz + Math.sin(t) * f.rimRadius, D))
  }
  assert.ok(Math.max(...rims) - Math.min(...rims) > D.basinDepth * 0.15, 'rim should not be uniform')
})

test('no steep walls at default settings', () => {
  let maxSlope = 0
  for (let x = -480; x <= 480; x += 5) {
    for (let z = -480; z <= 480; z += 5) {
      const h = heightAt(x, z, D)
      maxSlope = Math.max(
        maxSlope,
        Math.hypot(heightAt(x + 1, z, D) - h, heightAt(x, z + 1, D) - h),
      )
    }
  }
  assert.ok(Math.atan(maxSlope) < (40 * Math.PI) / 180, `steepest ${maxSlope}`)
})

test('each slider changes its own scale predictably', () => {
  const base = layerStd(D)
  const deeper = layerStd(normalizeWorldFinalConfig({ ...D, basinDepth: D.basinDepth * 1.6 }))
  assert.ok(deeper.macro > base.macro * 1.4, 'basinDepth scales macro')
  assert.ok(Math.abs(deeper.meso - base.meso) < base.meso * 0.05, 'basinDepth leaves meso alone')

  const ridgier = layerStd(normalizeWorldFinalConfig({ ...D, ridgeHeight: D.ridgeHeight * 2 }))
  assert.ok(ridgier.meso > base.meso * 1.9, 'ridgeHeight scales meso')
  assert.equal(ridgier.macro, base.macro)

  const detailed = layerStd(normalizeWorldFinalConfig({ ...D, surfaceDetail: D.surfaceDetail * 3 }))
  assert.ok(Math.abs(detailed.micro - base.micro * 3) < base.micro * 0.01, 'surfaceDetail scales micro')

  const flat = normalizeWorldFinalConfig({ ...D, basinDepth: 0, ridgeHeight: 0, surfaceDetail: 0 })
  assert.equal(heightAt(123, -45, flat), 0)

  const wide = normalizeWorldFinalConfig({ ...D, basinWidth: 1.0 })
  const narrow = normalizeWorldFinalConfig({ ...D, basinWidth: 0.55 })
  const f = basinFrame(D)
  const probe = (cfg) => heightAt(f.cx + 180, f.cz, cfg)
  assert.ok(probe(narrow) > probe(wide) + 10, 'narrower basin rises sooner')
})
