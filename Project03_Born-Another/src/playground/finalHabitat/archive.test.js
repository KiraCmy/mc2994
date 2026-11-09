import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ARCHIVE_KEY, createSpecimen, describeEnvironment, loadArchive, removeSpecimen, saveSpecimen } from './archive.js'

function memory() {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }
}

const fossil = { id: 'ammonite', name: 'Ammonite', latin: 'Ammonoidea', appeared: 'a', vanished: 'v' }

test('save, list newest first, remove', () => {
  const s = memory()
  const a = createSpecimen({ fossil, species: 'spiral', seed: 1, savedAt: new Date(1000) })
  const b = createSpecimen({ fossil, species: 'spiral', seed: 2, savedAt: new Date(2000) })
  saveSpecimen(a, s)
  const { list, saved } = saveSpecimen(b, s)
  assert.equal(saved, true)
  assert.deepEqual(list.map((e) => e.seed), [2, 1])
  assert.equal(loadArchive(s).length, 2)
  assert.equal(removeSpecimen(a.key, s).length, 1)
})

test('broken or missing storage never throws', () => {
  const bad = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
  assert.deepEqual(loadArchive(bad), [])
  assert.equal(saveSpecimen(createSpecimen({ fossil, seed: 3 }), bad).saved, false)
  const junk = memory()
  junk.setItem(ARCHIVE_KEY, '{not json')
  assert.deepEqual(loadArchive(junk), [])
  assert.deepEqual(loadArchive(null), [])
})

test('the medium is described in words', () => {
  assert.equal(describeEnvironment({ temperature: 0.2, moisture: 0.8, turbulence: 0.7 }), 'cold, wet, stormy')
  assert.equal(describeEnvironment({ temperature: 0.5, moisture: 0.5, turbulence: 0.05 }), 'mild, temperate, still')
})
