import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ammoniteRadius, BODY_FOSSIL, deathPhases, FOSSIL_AMMONITE, fossilForBody, witherAmount,
} from './habitatFossil.js'

test('withering begins before the last stretch and eases to death', () => {
  assert.equal(witherAmount(0.68), 0)
  const mid = witherAmount(0.85)
  assert.ok(mid > 0.15 && mid < 0.7, `mid ${mid}`)
  assert.ok(witherAmount(0.95) > 0.55)
  assert.equal(witherAmount(1), 1)
})

test('after death: coil, then dusk, then the reveal', () => {
  const a = deathPhases(1), b = deathPhases(4), c = deathPhases(9)
  assert.ok(a.coil > a.dusk && a.reveal === 0)
  assert.ok(b.dusk > 0 && b.reveal === 0)
  assert.equal(c.reveal, 1)
  assert.deepEqual(deathPhases(-1), { coil: 0, sink: 0, dusk: 0, reveal: 0 })
})

test('ammonite husk: flat along the coil axis, ribbed and finite', () => {
  let mean = 0, n = 0
  for (let i = 0; i < 2000; i++) {
    const y = 1 - (2 * (i + 0.5)) / 2000, rr = Math.sqrt(1 - y * y), a = i * 2.399963
    const v = ammoniteRadius(Math.cos(a) * rr, y, Math.sin(a) * rr)
    assert.ok(Number.isFinite(v) && v > 0.2 && v < 2)
    mean += v; n++
  }
  mean /= n
  assert.ok(mean > 0.75 && mean < 1.25, `mean ${mean}`)
  assert.ok(ammoniteRadius(0, 0, 1) < 0.6 * ammoniteRadius(1, 0, 0))
  assert.notEqual(ammoniteRadius(1, 0.05, 0), ammoniteRadius(1, 0.15, 0))
})

test('card carries name, time and cause', () => {
  for (const k of ['name', 'latin', 'appeared', 'vanished', 'cause']) assert.ok(FOSSIL_AMMONITE[k])
})

test('each life is named for the body the viewer stayed with', () => {
  assert.equal(fossilForBody('hero').id, 'ammonite')
  assert.equal(fossilForBody('o1').name, 'Dickinsonia')
  assert.equal(fossilForBody('o2').name, 'Trilobite')
  assert.equal(fossilForBody('o1').id, BODY_FOSSIL.o1)
  assert.ok(fossilForBody('o2').cause.length > 20)
  assert.notEqual(fossilForBody('o1').latin, fossilForBody('o2').latin)
})
