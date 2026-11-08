import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPopulation, STAGE } from '../finalForm/populationSim.js'
import { ageKin, KIN_LIFESPAN, KIN_MAX_RADIUS, KIN_MIN_RADIUS, kinCrystalLevel, kinPlacement, kinScale, kinTempo, liftForAge, relaxKin } from './habitatKin.js'

test('kin never sit inside the hero and stay in the habitat', () => {
  const pop = createPopulation({ count: 6, seed: 1 })
  for (const org of pop.organisms.slice(1)) {
    const { x, z } = kinPlacement(org)
    const r = Math.hypot(x, z)
    assert.ok(r >= KIN_MIN_RADIUS - 1e-6 && r <= KIN_MAX_RADIUS + 1e-6, `${org.id} r=${r}`)
  }
})

test('float height falls with AGE: buds highest, old lowest', () => {
  assert.ok(liftForAge(0.1) > liftForAge(0.45))
  assert.ok(liftForAge(0.45) > liftForAge(0.9))
})

test('kin move over time (wander), not only bob', () => {
  const org = createPopulation({ count: 6, seed: 1 }).organisms[2]
  const a = kinPlacement(org, null, 0)
  const b = kinPlacement(org, null, 20)
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 0.3)
})

test('every individual has its own life rhythm', () => {
  const pop = createPopulation({ count: 6, seed: 1 })
  const spans = pop.organisms.map((o) => kinTempo(o.archetypeSeed, 0).lifespan)
  assert.ok(new Set(spans.map((s) => Math.round(s))).size >= 5)
  for (const s of spans) assert.ok(s >= KIN_LIFESPAN[0] && s <= KIN_LIFESPAN[1])
  /* a new generation gets a new rhythm */
  assert.notEqual(kinTempo(9043, 0).lifespan, kinTempo(9043, 1).lifespan)
  /* ageing follows the individual clock */
  const env = { temperature: 0.5, moisture: 0.5, turbulence: 0 }
  const [x, y] = pop.organisms.slice(1, 3).map((o) => ({ ...o, stage: STAGE.MATURE, age: 0.5, nurture: 0 }))
  ageKin(x, 10, env)
  ageKin(y, 10, env)
  assert.notEqual(x.age, y.age)
})

test('crystallization: buds resist, old bodies harden even in a warm medium', () => {
  assert.ok(kinCrystalLevel(0.8, 0.1) < kinCrystalLevel(0.8, 0.6))
  assert.ok(kinCrystalLevel(0, 0.95) > 0.35)
  assert.ok(kinCrystalLevel(0, 0.3) < 0.01)
  for (const g of [0, 0.5, 1]) for (const a of [0, 0.5, 1]) {
    const v = kinCrystalLevel(g, a)
    assert.ok(v >= 0 && v <= 1)
  }
})

test('kin dissolve to nothing at the end of life', () => {
  assert.ok(kinScale(0.97) < 0.01)
  assert.ok(kinScale(0.6) > kinScale(0.1))
})

test('relaxed kin never overlap each other or the hero', () => {
  const items = [
    { x: 1, z: 3.5, lift: 2.3, scale: 0.7 },
    { x: 1.3, z: 3.6, lift: 2.6, scale: 0.6 },
    { x: 0.5, z: 0.5, lift: 0, scale: 0.8 },
  ]
  relaxKin(items, { iterations: 30 })
  const c = (it) => [it.x, it.lift + 2 * it.scale, it.z]
  for (let i = 0; i < items.length; i++) {
    const [x, y, z] = c(items[i])
    assert.ok(Math.hypot(x, y - 2.1, z) >= 1.6 * items[i].scale + 1.7 - 1e-3)
    for (let j = i + 1; j < items.length; j++) {
      const [x2, y2, z2] = c(items[j])
      assert.ok(Math.hypot(x2 - x, y2 - y, z2 - z) >= 1.6 * (items[i].scale + items[j].scale) - 0.05)
    }
  }
})
