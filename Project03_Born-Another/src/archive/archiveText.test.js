import { test } from 'node:test'
import assert from 'node:assert/strict'
import { countRises, effectLabels, lastWords, overviewLine, specimenNumber } from './archiveText.js'

test('counts separate climbs of crystallization', () => {
  const tl = [0.1, 0.1, 0.2, 0.3, 0.3, 0.3, 0.45, 0.5, 0.5, 0.9].map((level) => ({ level }))
  assert.equal(countRises(tl), 3)
  assert.equal(countRises([]), 0)
})

test('effects, last words, numbering and old records', () => {
  assert.deepEqual(effectLabels({ applied: true, impulses: { temperature: -0.2, disturbance: 0.3 } }), ['Temperature −', 'Turbulence +'])
  assert.deepEqual(effectLabels({ applied: false }), ['Not understood'])
  assert.equal(lastWords({ words: [{ text: 'a' }, { text: 'b' }] }).text, 'b')
  assert.equal(specimenNumber([{ key: 'c' }, { key: 'b' }, { key: 'a' }], 'c'), '003')
  const old = { name: 'Ammonite', environment: { temperature: 0.3, moisture: 0.8, turbulence: 0.1 } }
  assert.equal(overviewLine(old), 'Ammonite. Lived in cold, wet, still water.')
})
