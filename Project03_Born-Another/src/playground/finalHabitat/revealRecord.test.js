import test from 'node:test'
import assert from 'node:assert/strict'
import {
  anatomyCallouts,
  averageEnvironment,
  clock,
  finalLevel,
  interactionLabel,
  keyEvents,
  lifecycleCurve,
} from './revealRecord.js'

const story = {
  lived: 178,
  watched: 120,
  witnessedEnd: true,
  words: [
    { t: 30, text: 'warm sun on the reef', applied: true },
    { t: 60, text: 'asdf', applied: false },
  ],
  timeline: [
    { t: 0, level: 0, temperature: 0.6, moisture: 0.2, turbulence: 0.7 },
    { t: 90, level: 0.6, temperature: 0.7, moisture: 0.2, turbulence: 0.7 },
    { t: 178, level: 0.5, temperature: 0.62, moisture: 0.14, turbulence: 0.76 },
  ],
  events: [
    { t: 46, type: 'crystallization', threshold: 0.25 },
    { t: 80, type: 'crystallization', threshold: 0.5 },
    { t: 178, type: 'ended' },
  ],
}

test('clock pads minutes and seconds', () => {
  assert.equal(clock(178), '02:58')
  assert.equal(clock(null), '—')
})

test('averages the water over its life, or uses the water now', () => {
  const avg = averageEnvironment(story)
  assert.ok(Math.abs(avg.temperature - 0.64) < 1e-9)
  assert.deepEqual(averageEnvironment(null, { temperature: 0.3, moisture: 0.9, turbulence: 0.1 }), { temperature: 0.3, moisture: 0.9, turbulence: 0.1 })
})

test('final level and interaction words', () => {
  assert.equal(finalLevel(story), 0.5)
  assert.equal(finalLevel(null, 1), 1)
  assert.equal(interactionLabel(story), 'Language · 2 / 1 heard')
  assert.equal(interactionLabel({ words: [] }), 'Silence')
})

test('lifecycle curve marks the peak', () => {
  const c = lifecycleCurve(story, 100, 50, 0)
  assert.ok(c.d.startsWith('M0.0 50.0'))
  assert.equal(c.peak.level, 0.6)
  assert.equal(lifecycleCurve({ timeline: [{ t: 0 }] }), null)
})

test('key events run from emergence to the end, trimmed with both kept', () => {
  const ev = keyEvents(story)
  assert.equal(ev[0].label, 'Emergence')
  assert.equal(ev[ev.length - 1].label, 'Decomposition')
  assert.deepEqual(ev.map((e) => e.t), [0, 30, 46, 60, 80, 178])
  const short = keyEvents(story, 4)
  assert.equal(short.length, 4)
  assert.deepEqual(short.map((e) => e.kind), ['birth', 'crystal', 'crystal', 'end'])
  assert.deepEqual(keyEvents(null), [])
})

test('callouts read the water', () => {
  const c = anatomyCallouts({ species: 'spiral', env: { temperature: 0.7, moisture: 0.2, turbulence: 0.7 }, level: 0.5 })
  assert.deepEqual(c.map((x) => x.id), ['mineral', 'membrane', 'core'])
  assert.match(c[0].lines[0], /50% crystallized/)
  assert.match(c[0].lines[1], /low moisture/)
  assert.match(c[1].lines[1], /turbulence/)
})
