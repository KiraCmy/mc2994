import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ALBUM_LIMIT, createCapture, listCaptures } from './album.js'

test('a capture keeps the picture, its size, the time and the water (rounded)', () => {
  const blob = { size: 10, type: 'image/webp' }
  const c = createCapture({ blob, width: 1600, height: 1000, savedAt: new Date('2026-11-10T21:30:00Z'), environment: { temperature: 0.4567, moisture: 0.7, turbulence: 0.12345 }, crystallization: 0.333 })
  assert.equal(c.blob, blob)
  assert.equal(c.width, 1600)
  assert.equal(c.height, 1000)
  assert.equal(c.savedAt, '2026-11-10T21:30:00.000Z')
  assert.deepEqual(c.environment, { temperature: 0.46, moisture: 0.7, turbulence: 0.12 })
  assert.equal(c.crystallization, 0.33)
  assert.match(c.key, /^moment-\d+-\d+$/)
  assert.ok(ALBUM_LIMIT > 0)
})

test('without IndexedDB (Node, private windows) the album reads as empty instead of failing', async () => {
  assert.deepEqual(await listCaptures(), [])
})
