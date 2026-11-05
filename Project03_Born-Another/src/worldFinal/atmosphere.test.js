import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import {
  atmosphereParams,
  exp04HorizonRgb,
  FILL_DIRECTION,
  KEY_DIRECTION,
  luminance,
} from './atmosphere.js'
import { buildSeabedGeometry } from './buildSeabedGeometry.js'
import { normalizeWorldFinalConfig } from './config.js'
import { heightAt } from './heightField.js'

/** JS mirror of the shaded seabed's flat-ground lighting (no haze). */
function shadeFlat(params, normal = new THREE.Vector3(0, 1, 0)) {
  const keyWrapRaw = Math.min(1, Math.max(0, (normal.dot(KEY_DIRECTION) + 0.22) / 1.22))
  const keyWrap = keyWrapRaw * keyWrapRaw * (3 - 2 * keyWrapRaw)
  const fillWrap = Math.min(1, Math.max(0, (normal.dot(FILL_DIRECTION) + 0.5) / 1.5))
  const hemi = params.ground.clone().lerp(params.sky, normal.y * 0.5 + 0.5)
  const light = hemi
    .multiplyScalar(0.5)
    .add(params.key.clone().multiplyScalar(keyWrap * 0.96 * params.lightIntensity))
    .add(params.fill.clone().multiplyScalar(fillWrap * 0.2 * params.lightIntensity))
  return params.pearl.clone().multiply(light)
}

test('haze color is the Exp04 background composite, inside its gradient range', () => {
  const [r, g, b] = exp04HorizonRgb()
  for (const v of [r, g, b]) assert.ok(v > 170 && v < 225, `channel ${v}`)
  assert.ok(b > r && b > g, 'pearl-lavender: blue-violet channel leads')
})

test('color balance moves the lights but never the haze', () => {
  const pearl = atmosphereParams({ colorBalance: 0 })
  const warm = atmosphereParams({ colorBalance: 1 })
  const cool = atmosphereParams({ colorBalance: -1 })
  assert.ok(warm.haze.equals(pearl.haze) && cool.haze.equals(pearl.haze))
  assert.ok(warm.key.r - warm.key.b > cool.key.r - cool.key.b, 'warm key is pinker')
  assert.ok(cool.fill.g - cool.fill.r > warm.fill.g - warm.fill.r, 'cool fill is more cyan')
})

test('lit flat seabed sits slightly darker than the atmosphere', () => {
  const p = atmosphereParams(normalizeWorldFinalConfig({}))
  const ratio = luminance(shadeFlat(p)) / luminance(p.haze)
  assert.ok(ratio > 0.6 && ratio < 1, `terrain/haze luminance ratio ${ratio.toFixed(2)}`)
})

test('key-facing vs away-facing slopes differ softly (no harsh contrast)', () => {
  const p = atmosphereParams(normalizeWorldFinalConfig({}))
  /* ~25° flanks: the steepest common slope of the M1.3 basin. */
  const h = new THREE.Vector2(KEY_DIRECTION.x, KEY_DIRECTION.z).normalize().multiplyScalar(0.47)
  const toward = new THREE.Vector3(h.x, 1, h.y).normalize()
  const away = new THREE.Vector3(-h.x, 1, -h.y).normalize()
  const ratio = luminance(shadeFlat(p, away)) / luminance(shadeFlat(p, toward))
  assert.ok(ratio > 0.5 && ratio < 0.9, `shadow/lit ratio ${ratio.toFixed(2)}`)
})

test('sediment tones vary hue around the base without exposure jumps', () => {
  const p = atmosphereParams(normalizeWorldFinalConfig({}))
  const L = luminance(p.base)
  for (const name of ['pearl', 'lavender', 'deep', 'bank', 'high', 'crest']) {
    const r = luminance(p[name]) / L
    assert.ok(r > 0.7 && r < 1.2, `${name} luminance ratio ${r.toFixed(2)}`)
  }
  assert.ok(luminance(p.deep) < luminance(p.pearl) && luminance(p.high) > luminance(p.pearl))
  assert.ok(p.lavender.b / p.lavender.g > p.pearl.b / p.pearl.g, 'lavender tone is bluer-violet')
})

test('shading cues do not change the M1.3 height field', () => {
  const cfg = normalizeWorldFinalConfig({ gridRes: 64 })
  const geometry = buildSeabedGeometry(cfg)
  const pos = geometry.attributes.position
  const cues = geometry.attributes.aTerrain
  assert.equal(cues.count, pos.count)
  for (let i = 0; i < pos.count; i += 97) {
    assert.equal(pos.getY(i), Math.fround(heightAt(pos.getX(i), pos.getZ(i), cfg)))
    assert.ok(Number.isFinite(cues.getX(i)) && Number.isFinite(cues.getY(i)))
  }
  geometry.dispose()
})
