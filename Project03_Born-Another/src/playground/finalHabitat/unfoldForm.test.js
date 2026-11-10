import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bodyFactors, characterOf, createHistory, updateHistory } from './unfoldForm.js'

function dirs(n = 400) {
  const out = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const z = 1 - (2 * (i + 0.5)) / n
    const r = Math.sqrt(1 - z * z)
    const a = i * 2.399963
    out.set([Math.cos(a) * r, z, Math.sin(a) * r], i * 3)
  }
  return out
}

function live(seed, script) {
  const h = createHistory(seed)
  for (let t = 0; t < 120; t += 0.1) updateHistory(h, { dt: 0.1, ...script(t) })
  return h
}

test('same species, different lives: different characters', () => {
  const calm = live(7, () => ({ env: { temperature: 0.5, moisture: 0.5, turbulence: 0 } }))
  const spoken = live(7, (t) => ({
    env: { temperature: t > 30 && t < 70 ? 0.85 : t > 90 ? 0.2 : 0.5, moisture: 0.5, turbulence: t > 50 && t < 60 ? 0.8 : 0 },
    viewer: [0, 0.3, 0.95],
    near: true,
  }))
  assert.equal(calm.marks.length, 0)
  assert.ok(spoken.marks.length >= 2)
  const a = characterOf(calm, 7)
  const b = characterOf(spoken, 7)
  assert.notEqual(a.key, b.key)
  assert.ok(b.opening && !a.opening)
  const d = dirs()
  const fa = bodyFactors(a, d)
  const fb = bodyFactors(b, d)
  let diff = 0
  for (let i = 0; i < fa.length; i++) diff += Math.abs(fa[i] - fb[i])
  assert.ok(diff / fa.length > 0.005)
})

test('the species form never fully takes over', () => {
  const c = characterOf(createHistory(3), 3)
  assert.ok(c.lobeCap <= 0.88 && c.lobeCap >= 0.4)
  assert.ok(c.coilMax <= 0.8)
  assert.equal(c.axis.length, 3)
})

test('the medium shapes the body, is remembered, freezes and picks the crystal habit', async () => {
  const { createMorph, stepMorph } = await import('./unfoldForm.js')
  const m = createMorph()
  for (let i = 0; i < 400; i++) stepMorph(m, { temperature: 0.5, moisture: 0.95, turbulence: 0 }, 0.1, 0)
  assert.ok(m.shown.bubble > 0.8)
  /* Back to a neutral medium: the blisters partly stay. */
  for (let i = 0; i < 400; i++) stepMorph(m, { temperature: 0.5, moisture: 0.5, turbulence: 0 }, 0.1, 0)
  assert.ok(m.shown.bubble > 0.4 && m.shown.bubble < 0.8)
  /* Crystallizing: it freezes in that shape and crystallizes as blisters. */
  stepMorph(m, { temperature: 0.1, moisture: 0.5, turbulence: 0.9 }, 0.1, 0.3)
  assert.equal(m.mode, 'bubble')
  const frozen = { ...m.shown }
  for (let i = 0; i < 400; i++) stepMorph(m, { temperature: 0.1, moisture: 0.5, turbulence: 0.9 }, 0.1, 0.8)
  assert.ok(Math.abs(m.shown.strata - frozen.strata) < 1e-6)
  assert.equal(m.mode, 'bubble')
})
