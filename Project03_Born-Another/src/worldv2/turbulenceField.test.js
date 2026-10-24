import assert from 'node:assert/strict'
import test from 'node:test'
import {
  sampleTurbulenceFromLife,
  sampleTurbulenceRadialOffset,
  TURBULENCE_MAX_DISPLACEMENT,
} from './turbulenceField.js'
import {
  createLifeState,
  replayLife,
  runLifeSteps,
  setLifeTurbulence,
  lifeSnapshot,
} from './life/lifeEngine.js'

test('turbulence 0 preserves zero membrane offset', () => {
  const offset = sampleTurbulenceRadialOffset(1.2, 0.4, -0.3, {
    seed: 7319,
    time: 12.5,
    turbulence: 0,
  })
  assert.equal(offset, 0)
})

test('turbulence is bounded and increases with intensity', () => {
  const args = { seed: 7319, time: 8, x: 0.8, y: 0.5, z: -0.3 }
  const calm = sampleTurbulenceRadialOffset(args.x, args.y, args.z, {
    seed: args.seed,
    time: args.time,
    turbulence: 0,
  })
  const mid = sampleTurbulenceRadialOffset(args.x, args.y, args.z, {
    seed: args.seed,
    time: args.time,
    turbulence: 0.5,
  })
  const strong = sampleTurbulenceRadialOffset(args.x, args.y, args.z, {
    seed: args.seed,
    time: args.time,
    turbulence: 1,
  })
  assert.equal(calm, 0)
  assert.ok(Math.abs(mid) > 0)
  assert.ok(Math.abs(strong) > Math.abs(mid))
  assert.ok(Math.abs(strong) <= TURBULENCE_MAX_DISPLACEMENT + 1e-9)
})

test('turbulence field is deterministic for seed and time', () => {
  const a = sampleTurbulenceRadialOffset(0.2, 0.9, -0.4, {
    seed: 42,
    time: 3.25,
    turbulence: 0.8,
  })
  const b = sampleTurbulenceRadialOffset(0.2, 0.9, -0.4, {
    seed: 42,
    time: 3.25,
    turbulence: 0.8,
  })
  assert.equal(a, b)
})

test('setLifeTurbulence updates environment and replays', () => {
  let life = runLifeSteps(createLifeState({ seed: 7319 }), 400)
  life = setLifeTurbulence(life, 0.75)
  assert.equal(life.environment.turbulence, 0.75)

  const replayed = replayLife({
    seed: life.seed,
    history: life.history,
    environmentHistory: life.environmentHistory,
    step: life.step,
    durationSeconds: life.durationSeconds,
  })
  assert.deepEqual(lifeSnapshot(replayed).environment, lifeSnapshot(life).environment)
  assert.equal(
    sampleTurbulenceFromLife(1, 0, 0, replayed),
    sampleTurbulenceFromLife(1, 0, 0, life),
  )
})

test('turbulence does not change crystal lengths', () => {
  const steps = 900
  const calm = runLifeSteps(createLifeState({ seed: 7319 }), steps)
  let stormy = setLifeTurbulence(createLifeState({ seed: 7319 }), 1)
  stormy = runLifeSteps(stormy, steps)

  assert.deepEqual(
    calm.spatial.sites.map((site) => ({
      length: site.crystal?.length,
      radius: site.crystal?.radius,
      branches: site.crystal?.branches?.length ?? 0,
    })),
    stormy.spatial.sites.map((site) => ({
      length: site.crystal?.length,
      radius: site.crystal?.radius,
      branches: site.crystal?.branches?.length ?? 0,
    })),
  )
})
