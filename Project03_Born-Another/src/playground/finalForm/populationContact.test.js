import assert from 'node:assert/strict'
import test from 'node:test'
import { replayLife } from '../../worldv2/life/lifeEngine.js'
import {
  contactDeformations,
  createContactLifeCache,
  withContactDeformation,
} from './populationContact.js'

const life = replayLife({ seed: 884731, history: [], environmentHistory: [], step: 1200 })

test('no contact → same life object (no membrane re-morph)', () => {
  const org = { id: 'o0', spin: 0, contacts: [] }
  assert.equal(withContactDeformation(life, org), life)
})

test('contact dents the facing side and slightly bulges the far side', () => {
  const org = { id: 'o0', spin: 0, contacts: [{ id: 'o1', direction: [1, 0, 0], amount: 0.8 }] }
  const regions = contactDeformations(org)
  const dent = regions.find((r) => r.id === 'contact-o1')
  const bulge = regions.find((r) => r.id === 'contact-o1-far')
  assert.ok(dent.deformation < 0 && bulge.deformation > 0)
  assert.ok(Math.abs(dent.direction[0] - 1) < 1e-9)
  assert.ok(Math.abs(bulge.direction[0] + 1) < 1e-9)
  const deformed = withContactDeformation(life, org)
  const base = life.outputs.form.localDeformations.length
  assert.equal(deformed.outputs.form.localDeformations.length, base + 2)
  /* Life history untouched (reversible). */
  assert.equal(deformed.history, life.history)
})

test('contact direction is expressed in the organism local (spun) frame', () => {
  const org = { id: 'o0', spin: Math.PI / 2, contacts: [{ id: 'o1', direction: [1, 0, 0], amount: 1 }] }
  const dent = contactDeformations(org)[0]
  /* Rotating local +Z by +90° about Y gives world +X. */
  assert.ok(Math.abs(dent.direction[0]) < 1e-9)
  assert.ok(Math.abs(dent.direction[2] - 1) < 1e-9)
})

test('cache reuses objects until base life or quantised contact changes', () => {
  const lives = { o0: life }
  const cache = createContactLifeCache()
  const org = { id: 'o0', spin: 0, contacts: [{ id: 'o1', direction: [1, 0, 0], amount: 0.52 }] }
  const a = cache([org], lives).o0
  const b = cache([{ ...org, contacts: [{ ...org.contacts[0], amount: 0.54 }] }], lives).o0
  assert.equal(a, b, 'sub-step change reuses')
  const c = cache([{ ...org, contacts: [{ ...org.contacts[0], amount: 0.9 }] }], lives).o0
  assert.notEqual(a, c)
  assert.equal(cache([org], lives, false).o0, null, 'disabled → no override')
})
