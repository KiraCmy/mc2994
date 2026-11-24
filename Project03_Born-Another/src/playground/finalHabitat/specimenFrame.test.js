import test from 'node:test'
import assert from 'node:assert/strict'
import { distanceForRadius, layoutCallouts, specimenRadius, specimenRegion } from './specimenFrame.js'

test('stage sits between the panels and the body fits it', () => {
  const region = specimenRegion(1736, 906, {
    card: { left: 58, top: 140, right: 390, bottom: 560 },
    record: { left: 1362, top: 145, right: 1688, bottom: 750 },
    bottom: 760,
  })
  assert.ok(region.x0 > 390 && region.x1 < 1362)
  assert.ok(region.cx > 800 && region.cx < 960)
  const big = specimenRadius(region, 900)
  const half = Math.min(region.x1 - region.x0, region.y1 - region.y0) / 2
  assert.ok(big <= half * 0.86 + 1e-6)
  assert.equal(specimenRadius(region, 300), 300 * 0.58 < half * 0.5 ? half * 0.5 : 174)
})

test('a stacked record leaves the stage below it', () => {
  const region = specimenRegion(400, 800, { card: { left: 16, top: 90, right: 384, bottom: 420 }, bottom: 690 })
  assert.ok(region.y0 >= 420 && region.y1 <= 690)
  assert.equal(region.labelRoom, 0)
  assert.ok(region.x1 - region.x0 > 300)
})

test('distance scales inversely with screen radius', () => {
  const d1 = distanceForRadius(1, 100, 900, 34)
  const d2 = distanceForRadius(1, 50, 900, 34)
  assert.ok(Math.abs(d2 / d1 - 2) < 1e-9)
})

test('callouts stay inside the safe area and apart', () => {
  const box = { x0: 700, y0: 220, x1: 1090, y1: 700 }
  const anchors = { mineral: [720, 330], membrane: [1070, 420], core: [920, 520] }
  const sizes = { mineral: { w: 170, h: 44 }, membrane: { w: 150, h: 44 }, core: { w: 150, h: 44 } }
  const safe = { left: 420, top: 120, right: 1340, bottom: 800 }
  const out = layoutCallouts(box, anchors, sizes, safe)
  for (const c of Object.values(out)) {
    for (const [x, y] of c.points.slice(1)) {
      assert.ok(x >= safe.left - 1e-6 && x <= safe.right + 1e-6, `x ${x}`)
      assert.ok(y >= safe.top && y <= safe.bottom)
    }
    assert.ok(c.label.y >= safe.top)
  }
  assert.ok(out.mineral.points[2][0] < box.x0)
  assert.ok(out.membrane.points[2][0] > box.x1)
  assert.ok(out.core.label.y - out.membrane.points[1][1] >= 14)
  /* Squeezed: still inside. */
  const tight = layoutCallouts(box, anchors, sizes, { left: 600, top: 260, right: 1150, bottom: 640 })
  for (const c of Object.values(tight)) for (const [x] of c.points.slice(1)) assert.ok(x >= 600 && x <= 1150)
})
