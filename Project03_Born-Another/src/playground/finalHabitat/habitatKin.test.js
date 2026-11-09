import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPopulation, STAGE } from '../finalForm/populationSim.js'
import { ageKin, KIN_LIFESPAN, KIN_MAX_RADIUS, KIN_MIN_RADIUS, kinCrystalLevel, kinPlacement, kinScale, kinTempo, kinTint, KIN_TINTS, liftForAge, stepKinPhysics } from './habitatKin.js'

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

function body(id, x, vx) {
  return { id, x, y: 3, z: 0, vx, vy: 0, vz: 0, r: 1, tx: x, ty: 3, tz: 0, floor: 0 }
}

test('bodies that meet bounce apart gently and never pass through', () => {
  const a = body('a', -3, 1.8)
  const b = body('b', 3, -1.8)
  a.tx = 3; b.tx = -3 /* their targets cross: they must meet */
  const dents = new Map()
  let minGap = Infinity
  let maxDent = 0
  let bounced = false
  for (let k = 0; k < 240; k++) {
    const c = stepKinPhysics([a, b], null, dents, 1 / 60)
    minGap = Math.min(minGap, Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z))
    maxDent = Math.max(maxDent, c.get('a')?.[0]?.amount ?? 0)
    if (a.vx < -0.05 && b.vx > 0.05) bounced = true
  }
  assert.ok(minGap >= 2 * 0.96 - 1e-3, `gap ${minGap}`)
  assert.ok(bounced, 'they should push back off each other')
  assert.ok(maxDent > 0.2, 'contact presses a dent into the membrane')
})

test('the hero is an obstacle and dents recover after parting', () => {
  const a = body('a', -2.2, 1.5)
  const hero = { id: 'hero', x: 0, y: 3, z: 0, r: 1.2 }
  const dents = new Map()
  for (let k = 0; k < 90; k++) stepKinPhysics([a], hero, dents, 1 / 60)
  assert.ok(Math.hypot(a.x, a.y - 3, a.z) >= 2.2 * 0.96 - 1e-3)
  a.tx = -8
  let last = 1
  for (let k = 0; k < 600; k++) last = stepKinPhysics([a], hero, dents, 1 / 60).get('a')?.[0]?.amount ?? 0
  assert.ok(last < 0.02)
})

test('kin get their own tint from the palette, never the hero rose', () => {
  const seen = new Set()
  for (const seed of [52711, 9043, 31337, 70219, 15485]) {
    const t = kinTint(seed, 0)
    assert.ok(KIN_TINTS.includes(t) && t.id !== 'rose')
    seen.add(t.id)
  }
  assert.ok(seen.size >= 2)
})
