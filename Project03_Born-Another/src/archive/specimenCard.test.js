import test from 'node:test'
import assert from 'node:assert/strict'
import { cardData, pictureSilhouette } from './specimenCard.js'

test('the card states the record, not sample values', () => {
  const entry = {
    key: 'k',
    name: 'Ammonite',
    latin: 'Ammonoidea',
    fossilId: 'ammonite',
    species: 'spiral',
    lived: 11,
    crystallization: 1,
    environment: { temperature: 0.38, moisture: 0.68, turbulence: 0.12 },
    words: [{ t: 5, text: 'grow slowly', applied: true }],
    stages: [],
    savedAt: '2026-11-24T18:00:00.000Z',
    seed: 4197,
    generation: 2,
  }
  const d = cardData(entry, '005')
  assert.equal(d.no, '0005')
  assert.equal(d.name, 'Ammonite')
  assert.equal(d.latin, 'Ammonoidea')
  assert.equal(d.lifespan, '11 s')
  assert.equal(d.condition, 'Fully crystallized')
  assert.equal(d.last.text, 'grow slowly')
  assert.equal(d.stages.length, 4)
  assert.deepEqual(d.callouts.map((c) => c.id), ['mineral', 'membrane', 'core'])
  assert.equal(d.seed, 4197)
  /* Older records: no story fields, still a card. */
  const old = cardData({ name: 'Trilobite', fossilId: 'trilobite' }, '—')
  assert.equal(old.no, '—')
  assert.equal(old.last, null)
  assert.equal(old.lifespan, '—')
})

test('silhouette of a cut-out picture: box and points on the body', () => {
  const n = 64
  const alpha = new Uint8ClampedArray(n * n)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (((x - 32) / 20) ** 2 + ((y - 30) / 14) ** 2 <= 1) alpha[y * n + x] = 255
  const s = pictureSilhouette(alpha, n)
  assert.ok(Math.abs(s.box.x0 - 12 / n) < 0.03 && Math.abs(s.box.x1 - 53 / n) < 0.03)
  assert.ok(Math.abs(s.box.y0 - 16 / n) < 0.03 && Math.abs(s.box.y1 - 45 / n) < 0.03)
  for (const [x, y] of Object.values(s.anchors)) {
    const px = x * n - 0.5
    const py = y * n - 0.5
    assert.ok(((px - 32) / 20) ** 2 + ((py - 30) / 14) ** 2 <= 1.1, `${px},${py}`)
  }
  assert.equal(pictureSilhouette(new Uint8ClampedArray(n * n), n), null)
})
