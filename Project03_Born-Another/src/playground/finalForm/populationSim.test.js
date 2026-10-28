import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPopulation,
  POPULATION_BOUNDS,
  POPULATION_DT,
  POPULATION_MAX,
  radiusForAge,
  runPopulationSteps,
  scaleForAge,
  setPopulationFlags,
  STAGE,
  stageForAge,
  stepPopulation,
} from './populationSim.js'

const sec = (s) => Math.round(s / POPULATION_DT)

function minGap(pop) {
  let gap = Infinity
  const list = pop.organisms
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i]
      const b = list[j]
      const d = Math.hypot(
        a.position[0] - b.position[0],
        a.position[1] - b.position[1],
        a.position[2] - b.position[2],
      )
      gap = Math.min(gap, d - radiusForAge(a.age) - radiusForAge(b.age))
    }
  }
  return gap
}

test('roster: count clamps; mixed silhouettes and every life stage present', () => {
  assert.equal(createPopulation({ count: 0 }).organisms.length, 1)
  assert.equal(createPopulation({ count: 99 }).organisms.length, POPULATION_MAX)
  const pop = createPopulation({ count: 6 })
  const types = new Set(pop.organisms.map((o) => o.morphologyType))
  assert.ok(types.size >= 3, 'all three Exp05 morphology types')
  const stages = new Set(pop.organisms.map((o) => o.stage))
  for (const s of [STAGE.BUD, STAGE.YOUNG, STAGE.MATURE, STAGE.OLD]) {
    assert.ok(stages.has(s), `stage ${s} present`)
  }
  assert.equal(new Set(pop.organisms.map((o) => o.seed)).size, pop.organisms.length)
})

test('stage + scale helpers are monotone where expected', () => {
  assert.equal(stageForAge(0.1), STAGE.BUD)
  assert.equal(stageForAge(0.3), STAGE.YOUNG)
  assert.equal(stageForAge(0.6), STAGE.MATURE)
  assert.equal(stageForAge(0.9), STAGE.OLD)
  assert.ok(scaleForAge(0.15) < scaleForAge(0.4))
  assert.ok(scaleForAge(0.4) < scaleForAge(0.65))
  assert.ok(scaleForAge(0.98) < scaleForAge(0.7), 'old bodies wane slightly')
})

test('deterministic: same inputs → identical trajectory', () => {
  const a = runPopulationSteps(createPopulation({ count: 6, seed: 3 }), sec(20))
  const b = runPopulationSteps(createPopulation({ count: 6, seed: 3 }), sec(20))
  assert.deepEqual(a.organisms.map((o) => o.position), b.organisms.map((o) => o.position))
})

test('bodies never interpenetrate and stay inside the medium', () => {
  let pop = createPopulation({ count: 7, seed: 1 })
  assert.ok(minGap(pop) > 0, 'spawn settled')
  for (let i = 0; i < 12; i += 1) {
    pop = runPopulationSteps(pop, sec(15))
    assert.ok(minGap(pop) > -0.05, `overlap at t=${pop.time.toFixed(0)}`)
    for (const o of pop.organisms) {
      const [bx, by, bz] = POPULATION_BOUNDS
      const e = Math.hypot(o.position[0] / bx, o.position[1] / by, o.position[2] / bz)
      assert.ok(e < 1.1, `${o.id} escaped (${e.toFixed(2)})`)
    }
  }
})

test('organisms actually float (move) without exploding', () => {
  const p0 = createPopulation({ count: 6 })
  const p1 = runPopulationSteps(p0, sec(30))
  for (let i = 0; i < p0.organisms.length; i += 1) {
    const a = p0.organisms[i].position
    const b = p1.organisms[i].position
    const moved = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
    assert.ok(moved > 0.15, `${p0.organisms[i].id} barely moved`)
    assert.ok(moved < 12, `${p0.organisms[i].id} moved too far`)
  }
})

test('nurture: mature → young streams occur and speed up the young', () => {
  let pop = createPopulation({ count: 6, seed: 1 })
  let streams = 0
  for (let i = 0; i < sec(120); i += 1) {
    const before = pop
    pop = runPopulationSteps(pop, 1)
    for (const e of pop.exchanges) {
      /* Stages as they were when the exchange was decided (pre-step). */
      const from = before.organisms.find((o) => o.id === e.from)
      const to = before.organisms.find((o) => o.id === e.to)
      assert.equal(from.stage, STAGE.MATURE)
      assert.ok(to.stage === STAGE.BUD || to.stage === STAGE.YOUNG)
      streams += 1
    }
  }
  assert.ok(streams > 0, 'expected nurture streams within 2 minutes')

  /* Same start, exchange off → the young age more slowly. */
  const on = runPopulationSteps(createPopulation({ count: 6, seed: 1 }), sec(90))
  const off = runPopulationSteps(
    setPopulationFlags(createPopulation({ count: 6, seed: 1 }), { exchange: false }),
    sec(90),
  )
  const youngIds = createPopulation({ count: 6, seed: 1 })
    .organisms.filter((o) => o.stage === STAGE.BUD || o.stage === STAGE.YOUNG)
    .map((o) => o.id)
  const meanAge = (p) =>
    youngIds.reduce((s, id) => s + p.organisms.find((o) => o.id === id).age, 0) /
    youngIds.length
  assert.ok(meanAge(on) > meanAge(off), `${meanAge(on)} vs ${meanAge(off)}`)
})

test('young seek mature bodies (smaller gap with behaviours on)', () => {
  /* Mean surface gap from each young body to its nearest mature body. */
  const gap = (p) => {
    const youngs = p.organisms.filter((o) => o.stage === STAGE.BUD || o.stage === STAGE.YOUNG)
    const matures = p.organisms.filter((o) => o.stage === STAGE.MATURE)
    return youngs.reduce((s, y) => {
      const d = Math.min(...matures.map((m) => Math.hypot(
        y.position[0] - m.position[0], y.position[1] - m.position[1], y.position[2] - m.position[2],
      ) - radiusForAge(y.age) - radiusForAge(m.age)))
      return s + d
    }, 0) / youngs.length
  }
  let on = 0
  let off = 0
  for (const seed of [1, 2, 3]) {
    const opts = { count: 6, seed, options: { ageRate: 0 } }
    on += gap(runPopulationSteps(createPopulation(opts), sec(40)))
    off += gap(runPopulationSteps(
      setPopulationFlags(createPopulation(opts), { behaviours: false }),
      sec(40),
    ))
  }
  assert.ok(on < off * 0.8, `${on.toFixed(2)} vs ${off.toFixed(2)}`)
})

test('lifecycle: an old body dissolves and is re-born as a bud with a new seed', () => {
  const pop0 = createPopulation({ count: 6 })
  const old = pop0.organisms.find((o) => o.stage === STAGE.OLD)
  const pop = runPopulationSteps(pop0, sec(120))
  const reborn = pop.organisms.find((o) => o.id === old.id)
  assert.ok(reborn.generation >= 1)
  assert.notEqual(reborn.seed, old.seed)
  assert.ok(pop.births >= 1)
  const frozen = runPopulationSteps(
    setPopulationFlags(createPopulation({ count: 6 }), { lifecycle: false }),
    sec(120),
  )
  assert.equal(frozen.births, 0)
})

test('stepPopulation caps catch-up and is a no-op for tiny elapsed', () => {
  const p0 = createPopulation({ count: 3 })
  assert.equal(stepPopulation(p0, 0.001).step, 0)
  assert.equal(stepPopulation(p0, 5).step, 4)
})

test('environment: neutral factors are 1; hot ages faster, turbulent moves faster', async () => {
  const { environmentFactors, setPopulationEnvironment } = await import('./populationSim.js')
  const f = environmentFactors({ temperature: 0.5, moisture: 0.5, turbulence: 0 })
  for (const v of Object.values(f)) assert.ok(Math.abs(v - 1) < 1e-9)

  const run = (env) =>
    runPopulationSteps(
      setPopulationEnvironment(
        setPopulationFlags(createPopulation({ count: 6, seed: 4 }), { lifecycle: false }),
        env,
      ),
      sec(30),
    )
  const meanAge = (p) => p.organisms.reduce((s, o) => s + o.age, 0) / p.organisms.length
  assert.ok(meanAge(run({ temperature: 0.9 })) > meanAge(run({ temperature: 0.1 })))

  const travel = (env) => {
    const p0 = setPopulationEnvironment(createPopulation({ count: 6, seed: 4 }), env)
    let p = p0
    let path = 0
    for (let i = 0; i < sec(20); i += 1) {
      const next = runPopulationSteps(p, 1)
      for (let k = 0; k < p.organisms.length; k += 1) {
        const a = p.organisms[k].position
        const b = next.organisms[k].position
        path += Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
      }
      p = next
    }
    return path
  }
  assert.ok(travel({ turbulence: 1 }) > travel({ turbulence: 0 }) * 1.3)
})

test('traits: per-organism shape / AGE / freeze / reseed edits apply and clamp', async () => {
  const { setOrganismTraits, ORGANISM_TRAIT_LIMITS } = await import('./populationSim.js')
  let pop = createPopulation({ count: 3 })
  pop = setOrganismTraits(pop, 'o1', {
    morphologyType: 'spiral',
    lobe: 99,
    sculpt: -3,
    age: 0.7,
    frozen: true,
  })
  const o1 = pop.organisms.find((o) => o.id === 'o1')
  assert.equal(o1.morphologyType, 'spiral')
  assert.equal(o1.lobe, ORGANISM_TRAIT_LIMITS.lobe[1])
  assert.equal(o1.sculpt, ORGANISM_TRAIT_LIMITS.sculpt[0])
  assert.equal(o1.stage, STAGE.MATURE)
  /* Frozen bodies hold AGE while others keep ageing. */
  const later = runPopulationSteps(pop, sec(20))
  assert.equal(later.organisms.find((o) => o.id === 'o1').age, 0.7)
  assert.ok(later.organisms.find((o) => o.id === 'o0').age > pop.organisms[0].age)
  /* Unknown morphology ignored; reseed gives a new individual. */
  const bad = setOrganismTraits(pop, 'o1', { morphologyType: 'cube' })
  assert.equal(bad.organisms.find((o) => o.id === 'o1').morphologyType, 'spiral')
  const re = setOrganismTraits(pop, 'o1', { reseed: true })
  assert.notEqual(re.organisms.find((o) => o.id === 'o1').seed, o1.seed)
})
