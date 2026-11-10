import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLifeLog, logWords, sampleLife, setStage, summarizeLife, thin } from './lifeLog.js'

test('a life collects watch time, samples, words and its end', () => {
  const log = createLifeLog()
  sampleLife(log, 'hero-0', 10, { level: 0.2, env: { temperature: 0.4 }, watched: false })
  logWords(log, 11, { text: 'a cold, wet night', applied: true, impulses: { temperature: -0.2, moisture: 0.3 } })
  sampleLife(log, 'hero-0', 11, { level: 0.3, watched: true })
  sampleLife(log, 'hero-0', 12, { level: 0.9, watched: true, ended: true })
  logWords(log, 30, { text: 'too late' })
  setStage(log, 'hero-0', 11, 'first', 'data:image/webp;base64,AAA')
  const s = summarizeLife(log, 'hero-0', 40)
  assert.equal(s.lived, 2)
  assert.equal(s.watched, 2)
  assert.equal(s.witnessedEnd, true)
  assert.deepEqual(s.words.map((w) => w.text), ['a cold, wet night'])
  assert.equal(s.words[0].t, 1)
  assert.deepEqual(s.words[0].impulses, { temperature: -0.2, moisture: 0.3 })
  assert.equal(s.timeline.length, 3)
  assert.equal(s.stages[0].name, 'first')
})

test('samples after the end are ignored; timelines are thinned', () => {
  const log = createLifeLog()
  sampleLife(log, 'k', 0, { ended: true })
  sampleLife(log, 'k', 5, { level: 1 })
  assert.equal(summarizeLife(log, 'k', 9).timeline.length, 1)
  const many = Array.from({ length: 500 }, (_, i) => ({ t: i }))
  const t = thin(many, 64)
  assert.equal(t.length, 64)
  assert.equal(t[0].t, 0)
  assert.equal(t[63].t, 499)
})
