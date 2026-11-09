import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  descentPose, DESCENT_SECONDS, explorePose, focusPose, noticeRadius, openingHaze,
  pickResponse, responseEnvelope, RESPONSE_SECONDS, HERO_HOME, KIN_ANCHORS,
} from './worldOpening.js'

const near = (a, b, e = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < e)

test('descent starts high looking up and lands exactly on the exploration pose', () => {
  const start = descentPose(0, 0)
  assert.ok(start.position[1] > 34, "starts well up in the water")
  assert.ok(start.target[1] > start.position[1], 'looking up at the surface')
  const end = descentPose(DESCENT_SECONDS, 0)
  const pose = explorePose(0)
  assert.ok(near(end.position, pose.position))
  assert.ok(near(end.target, pose.target, 1e-4))
  assert.equal(end.depth, 0)
})

test('descent is smooth (no jumps between frames)', () => {
  let prev = descentPose(0, 0)
  for (let t = 1 / 60; t <= DESCENT_SECONDS; t += 1 / 60) {
    const p = descentPose(t, 0)
    assert.ok(Math.hypot(...p.position.map((v, i) => v - prev.position[i])) < 0.2)
    prev = p
  }
})

test('the haze is thick while sinking and clears after arrival', () => {
  assert.equal(openingHaze(3), 1)
  assert.ok(openingHaze(DESCENT_SECONDS + 10) < 1 && openingHaze(DESCENT_SECONDS + 10) > 0)
  assert.equal(openingHaze(DESCENT_SECONDS + 60), 0)
})

test('the three lives sit near enough to meet, and the landing gaze is level', () => {
  const pts = [HERO_HOME, KIN_ANCHORS.o1, KIN_ANCHORS.o2]
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
    const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])
    assert.ok(d > 3.2 && d < 12, `pair ${i}-${j} distance ${d}`)
  }
  const pose = explorePose(0)
  const drop = pose.position[1] - pose.target[1]
  assert.ok(drop >= 0 && drop < 2, 'level-to-gently-down gaze after the sink')
  assert.ok(Math.hypot(pose.position[0] - HERO_HOME[0], pose.position[2] - HERO_HOME[1]) > 28, 'lands well back: the lives are found, not handed over')
  const fwd = [pose.target[0] - pose.position[0], pose.target[2] - pose.position[2]]
  const toHero = [HERO_HOME[0] - pose.position[0], HERO_HOME[1] - pose.position[2]]
  const cos = (fwd[0] * toHero[0] + fwd[1] * toHero[1]) / (Math.hypot(...fwd) * Math.hypot(...toHero))
  assert.ok(cos > 0.8, `hero within the forward view (cos ${cos})`)
})

test('a response rises, holds and fades; every kind is reachable', () => {
  assert.equal(responseEnvelope(-1), 0)
  assert.ok(responseEnvelope(0.5) > 0 && responseEnvelope(0.5) < 1)
  assert.equal(responseEnvelope(1.0), 1)
  assert.equal(responseEnvelope(RESPONSE_SECONDS + 0.01), 0)
  assert.deepEqual(new Set([0.1, 0.4, 0.6, 0.9].map(pickResponse)), new Set(['contract', 'expand', 'shimmer', 'still']))
  assert.ok(noticeRadius(2) > noticeRadius(1))
})

test('focus pose sits on the viewer side, outside the body, above the sand', () => {
  const centre = [10, 5, -20]
  const pose = focusPose(centre, 1.4, [0, 3, 10], () => 4.5)
  const d = Math.hypot(...pose.position.map((v, i) => v - centre[i]))
  assert.ok(d > 1.4 * 2)
  assert.ok(pose.position[2] > centre[2], 'same side as the camera')
  assert.ok(pose.position[1] >= 4.5 + 1.1)
})

import { BIRTH_SPACING, INITIAL_SPECIES, MAX_REMAINS, pickHome, remainsPhase, SPECIES, speciesFor } from './worldOpening.js'

test('first lives keep their species; later births vary across all species', () => {
  assert.equal(speciesFor('hero', 0, 1), INITIAL_SPECIES.hero)
  const seen = new Set()
  for (let g = 1; g < 40; g++) seen.add(speciesFor('o1', g, 1000 + g * 7))
  assert.deepEqual(seen, new Set(SPECIES))
})

test('new lives are born apart from others and from fresh remains', () => {
  const occupied = [[0, -6], [-4, -3], [4.6, -4.4], [1, -10]]
  for (let g = 1; g < 20; g++) {
    const home = pickHome('o2', g, 4000 + g, occupied)
    const gap = Math.min(...occupied.map((o) => Math.hypot(o[0] - home[0], o[1] - home[1])))
    assert.ok(gap >= BIRTH_SPACING - 1e-9, `gap ${gap}`)
  }
})

test('remains settle first, then are slowly buried', () => {
  const a = remainsPhase(2), b = remainsPhase(8), c = remainsPhase(10000)
  assert.ok(a.settle > 0 && a.settle < 1 && a.bury === 0)
  assert.equal(b.settle, 1)
  assert.equal(c.bury, 1)
  assert.ok(MAX_REMAINS >= 3)
})
