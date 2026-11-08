import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import {
  atmosphereParams,
  FILL_DIRECTION,
  KEY_DIRECTION,
  luminance,
} from './atmosphere.js'
import { waterColor } from './waterVolume.js'
import { buildSeabedGeometry } from './buildSeabedGeometry.js'
import { normalizeWorldFinalConfig } from './config.js'
import { heightAt } from './heightField.js'

/** JS mirror of the shaded seabed's flat-ground lighting (no haze). */
function shadeFlat(params, normal = new THREE.Vector3(0, 1, 0)) {
  const keyWrapRaw = Math.min(1, Math.max(0, (normal.dot(KEY_DIRECTION) + 0.1) / 1.1))
  const keyWrap = keyWrapRaw * keyWrapRaw * (3 - 2 * keyWrapRaw)
  const fillWrap = Math.min(1, Math.max(0, (normal.dot(FILL_DIRECTION) + 0.5) / 1.5))
  const hemi = params.ground.clone().lerp(params.sky, normal.y * 0.5 + 0.5)
  const light = hemi
    .multiplyScalar(0.5)
    .add(params.key.clone().multiplyScalar(keyWrap * 1.2 * params.lightIntensity))
    .add(params.fill.clone().multiplyScalar(fillWrap * 0.32 * params.lightIntensity))
  return params.pearl.clone().multiply(light)
}

test('haze color is the horizon water: bright cool gray, not violet', () => {
  const haze = atmosphereParams({}).haze.clone().convertLinearToSRGB()
  const [r, g, b] = [haze.r, haze.g, haze.b].map((v) => v * 255)
  for (const v of [r, g, b]) assert.ok(v > 175 && v < 225, `channel ${v}`)
  assert.ok(Math.max(r, g, b) - Math.min(r, g, b) < 25, `too saturated ${r} ${g} ${b}`)
  assert.ok(b >= g && g >= r, 'cool: blue leads, green over red')
})

test('water is deeper looking down, paler up, brightest toward the sun', () => {
  const L = (d) => luminance(waterColor(d))
  const down = L(new THREE.Vector3(0.2, -1, 0))
  const level = L(new THREE.Vector3(-KEY_DIRECTION.x, 0, -KEY_DIRECTION.z))
  const up = L(new THREE.Vector3(-KEY_DIRECTION.x, 1, -KEY_DIRECTION.z))
  assert.ok(down < level && level < up, `${down} ${level} ${up}`)
  assert.ok(L(KEY_DIRECTION) > up * 1.2, 'sun glow')
  assert.ok(waterColor(new THREE.Vector3(-KEY_DIRECTION.x, 0, -KEY_DIRECTION.z)).equals(atmosphereParams({}).haze))
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

test('key-facing vs away-facing slopes read clearly (raking sun), never black', () => {
  const p = atmosphereParams(normalizeWorldFinalConfig({}))
  /* ~25° flanks: the steepest common slope of the M1.3 basin. */
  const h = new THREE.Vector2(KEY_DIRECTION.x, KEY_DIRECTION.z).normalize().multiplyScalar(0.47)
  const toward = new THREE.Vector3(h.x, 1, h.y).normalize()
  const away = new THREE.Vector3(-h.x, 1, -h.y).normalize()
  const ratio = luminance(shadeFlat(p, away)) / luminance(shadeFlat(p, toward))
  assert.ok(ratio > 0.35 && ratio < 0.75, `shadow/lit ratio ${ratio.toFixed(2)}`)
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
