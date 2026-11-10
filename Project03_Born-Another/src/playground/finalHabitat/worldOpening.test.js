import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  descentPose, DESCENT_SECONDS, entranceCue, ENTRANCE_SECONDS, explorePose, focusPose, noticeRadius, openingHaze,
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

test('the entrance opens from darkness through three quiet lines into the world', () => {
  const start = entranceCue(0)
  assert.equal(start.night, 1)
  assert.equal(start.veil, 1)
  assert.ok(start.phrases.every((v) => v === 0))
  const early = entranceCue(4.2)
  assert.ok(early.night < 0.75 && early.night > 0.15, `gradient arriving, night ${early.night}`)
  assert.equal(early.veil, 1)
  assert.ok(early.phrases[0] > 0.9)
  const know = entranceCue(8.4)
  assert.equal(know.phrases[0], 0)
  assert.ok(know.phrases[1] > 0.9)
  const remember = entranceCue(11.9)
  assert.ok(remember.phrases[2] > 0.9)
  assert.equal(remember.phrases[0], 0)
  assert.equal(remember.phrases[1], 0)
  assert.ok(remember.veil > 0.55, `last line still in the dim, veil ${remember.veil}`)
  const after = entranceCue(13.6)
  assert.equal(after.phrases[2], 0)
  assert.ok(after.veil > 0.35, 'the world is not fully open the moment the line ends')
  assert.equal(entranceCue(ENTRANCE_SECONDS).veil, 0)
  assert.equal(entranceCue(ENTRANCE_SECONDS).night, 0)
  assert.ok(entranceCue(ENTRANCE_SECONDS).phrases.every((v) => v === 0))
  let prevVeil = 1
  for (let t = 0; t <= ENTRANCE_SECONDS; t += 0.05) {
    const cue = entranceCue(t)
    assert.ok(cue.phrases.filter((v) => v > 0.2).length <= 1, `overlap at ${t}`)
    assert.ok(cue.veil <= prevVeil + 1e-9, `veil jumped up at ${t}`)
    prevVeil = cue.veil
    if (cue.phrases[2] > 0.15) {
      const edgeIn = cue.phrases[2] < 0.98
      assert.ok(cue.veil > 0.5, `remember against a bright world at ${t}`)
      if (edgeIn) assert.ok(cue.phrases[2] > 0)
    }
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
  const rise = pose.target[1] - pose.position[1]
  assert.ok(rise > 0.4 && rise < 2.5, `lands looking nearly level, a little up (rise ${rise})`)
  assert.ok(Math.hypot(pose.position[0] - HERO_HOME[0], pose.position[2] - HERO_HOME[1]) > 28, 'lands well back: the lives are found, not handed over')
  const fwd = [pose.target[0] - pose.position[0], pose.target[2] - pose.position[2]]
  const toHero = [HERO_HOME[0] - pose.position[0], HERO_HOME[1] - pose.position[2]]
  const cos = (fwd[0] * toHero[0] + fwd[1] * toHero[1]) / (Math.hypot(...fwd) * Math.hypot(...toHero))
  assert.ok(cos > 0.97, `the lives near the centre of the landing view (cos ${cos})`)
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
