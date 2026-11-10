import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cutOutPixels } from './snapshotCutout.js'

test('the background goes clear and the body stays', () => {
  const size = 40
  const data = new Uint8ClampedArray(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const body = Math.hypot(x - 20, y - 20) < 9 || (x === 33 && y === 20)
      data.set(body ? [240, 170, 200, 255] : [170, 168, 190, 255], i)
    }
  }
  cutOutPixels(data, size)
  assert.equal(data[(2 * size + 2) * 4 + 3], 0)
  assert.ok(data[(20 * size + 20) * 4 + 3] > 240)
  /* a distinct pixel outside the middle (a crystal) is kept, softened */
  assert.ok(data[(20 * size + 33) * 4 + 3] > 20)
  /* plain water just outside the body fades out */
  assert.ok(data[(20 * size + 36) * 4 + 3] < 40)
})
