import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addLifeStimulus,
  canProduceSecondaryBranches,
  CRYSTAL_BRANCH_MATURITY,
  CRYSTAL_BRANCH_MAX_COUNT,
  CRYSTAL_BRANCH_MIN_COUNT,
  CRYSTAL_BRANCH_MINERAL,
  CRYSTAL_INITIAL_LENGTH,
  CRYSTAL_MAX_BRANCH_DEPTH,
  crystalMaturity,
  createLifeState,
  ENV_MOISTURE_NEUTRAL,
  lifeSnapshot,
  moistureBranchCountDelta,
  moistureBranchMaturityGate,
  moistureBranchMineralGate,
  moistureGrowthMultiplier,
  primaryCrystalGrowthRate,
  replayLife,
  runLifeSteps,
  secondaryBranchCount,
  applyLifeMoistureFromBirth,
  setLifeMoisture,
  stepLife,
} from './lifeEngine.js'
import {
  branchAttachAlong,
  primaryCrystalAnchor,
  secondaryCrystalAttachPoint,
} from './worldLifeAdapter.js'

function runUntilNucleation(life) {
  let next = life
  while (!next.dead && next.spatial.sites.length === 0) {
    next = stepLife(next)
  }
  return next
}

test('seed and intervention history replay exactly', () => {
  let life = runLifeSteps(createLifeState({ seed: 42 }), 120)
  life = addLifeStimulus(life, [0.2, 0.8, -0.3])
  life = runLifeSteps(life, 260)
  life = addLifeStimulus(life, [-0.7, 0.1, 0.5])
  life = runLifeSteps(life, 180)

  const replayed = replayLife({
    seed: life.seed,
    history: life.history,
    step: life.step,
    durationSeconds: life.durationSeconds,
  })

  assert.deepEqual(lifeSnapshot(replayed), lifeSnapshot(life))
})

test('growth, mineralization, decay, and memory are irreversible', () => {
  let life = createLifeState({ seed: 7319 })
  let previous = life.variables
  while (!life.dead) {
    life = stepLife(life)
    assert.ok(life.variables.growth >= previous.growth)
    assert.ok(life.variables.mineral >= previous.mineral)
    assert.ok(life.variables.decay >= previous.decay)
    assert.ok(life.variables.memory >= previous.memory)
    previous = life.variables
  }
  assert.equal(life.age, 1)
})

test('stimulus affects future growth but does not directly sculpt', () => {
  let life = runLifeSteps(createLifeState({ seed: 11 }), 90)
  const sitesBeforeStimulus = life.spatial.sites.length
  life = addLifeStimulus(life, [0, 0, 1])
  assert.equal(life.outputs.form.localDeformations[0].deformation, 0)
  assert.equal(life.spatial.sites.length, sitesBeforeStimulus)
  assert.ok(Number.isInteger(life.history[0].region))
  assert.deepEqual(
    life.history[0].direction,
    life.spatial.regions[life.history[0].region].direction,
  )

  life = runLifeSteps(life, 150)
  assert.ok(life.outputs.form.localDeformations[0].deformation > 0)
  assert.ok(life.outputs.surface.mineralSites[0].boost > 0)
})

test('intervention changes spatial nucleation at the same age', () => {
  const seed = 7319
  // ~AGE 0.55 on the 90s life — past primary nucleation for both trials.
  const comparisonStep = 1500
  const control = runLifeSteps(createLifeState({ seed }), comparisonStep)

  let stimulated = runLifeSteps(createLifeState({ seed }), 240)
  stimulated = addLifeStimulus(stimulated, [0, 0, 1])
  stimulated = runLifeSteps(stimulated, comparisonStep - stimulated.step)

  assert.equal(stimulated.step, control.step)
  assert.notDeepEqual(
    stimulated.spatial.sites.map(({ region }) => region),
    control.spatial.sites.map(({ region }) => region),
  )

  const replayed = replayLife({
    seed,
    history: stimulated.history,
    step: stimulated.step,
  })
  assert.deepEqual(replayed.spatial.sites, stimulated.spatial.sites)
})

test('a late stimulus retains capacity for local future nucleation', () => {
  let life = runLifeSteps(createLifeState({ seed: 7319 }), 1500)
  assert.equal(life.spatial.sites.length, 7)

  life = addLifeStimulus(life, [0, 0, 1])
  const touchedRegion = life.history.at(-1).region
  assert.equal(life.spatial.sites.length, 7)

  life = runLifeSteps(life, 360)
  assert.ok(
    life.spatial.sites.some(
      ({ cause, region }) =>
        cause === 'stimulus' && region === touchedRegion,
    ),
  )
})

test('primary crystals emerge with near-zero length after nucleation', () => {
  const life = runUntilNucleation(createLifeState({ seed: 7319 }))
  assert.ok(life.spatial.sites.length > 0)
  for (const site of life.spatial.sites) {
    const { crystal } = site
    assert.equal(crystal.id, site.id)
    assert.equal(crystal.parentSiteId, site.id)
    assert.equal(crystal.bornStep, site.bornStep)
    assert.deepEqual(crystal.growthDirection, site.growthDirection)
    assert.ok(crystal.length >= CRYSTAL_INITIAL_LENGTH)
    assert.ok(crystal.length < 0.02)
    assert.ok(crystal.maxLength > crystal.length)
    assert.ok(crystal.radius > 0)
    assert.ok(crystal.growthRate > 0)
    assert.equal(crystal.origin, undefined)
    assert.equal(crystal.position, undefined)
    assert.deepEqual(
      site.direction,
      life.spatial.regions[site.region].direction,
    )
  }
})

test('primary crystal length increases across simulation steps', () => {
  let life = runUntilNucleation(createLifeState({ seed: 7319 }))
  const siteId = life.spatial.sites[0].id
  const lengthAtBirth = life.spatial.sites[0].crystal.length
  life = runLifeSteps(life, 45)
  const grown = life.spatial.sites.find((site) => site.id === siteId)
  assert.ok(grown.crystal.length > lengthAtBirth)
  const laterLength = grown.crystal.length
  life = runLifeSteps(life, 45)
  const later = life.spatial.sites.find((site) => site.id === siteId)
  assert.ok(later.crystal.length > laterLength)
  assert.ok(later.crystal.length <= later.crystal.maxLength)
})

test('local mineral conditions change primary crystal growth rate', () => {
  assert.ok(
    primaryCrystalGrowthRate(0.9, 1.1, 1, 1) >
      primaryCrystalGrowthRate(0.2, 1.1, 1, 1),
  )
  assert.ok(
    primaryCrystalGrowthRate(0.5, 1.25, 1, 1) >
      primaryCrystalGrowthRate(0.5, 0.75, 1, 1),
  )

  const nucleated = runUntilNucleation(createLifeState({ seed: 7319 }))
  const site = nucleated.spatial.sites[0]
  const control = runLifeSteps(nucleated, 90)
  let stimulated = addLifeStimulus(nucleated, site.direction)
  stimulated = runLifeSteps(stimulated, 90)
  const controlCrystal = control.spatial.sites.find(
    (entry) => entry.id === site.id,
  )
  const stimulatedCrystal = stimulated.spatial.sites.find(
    (entry) => entry.id === site.id,
  )
  assert.ok(
    stimulated.spatial.accumulation[site.region] >
      control.spatial.accumulation[site.region],
  )
  assert.ok(stimulatedCrystal.crystal.length > controlCrystal.crystal.length)
})

test('surface deformation keeps crystal roots in rest-space', () => {
  let life = runUntilNucleation(createLifeState({ seed: 11 }))
  life = addLifeStimulus(life, [0, 1, 0])
  life = runLifeSteps(life, 80)
  const site = life.spatial.sites[0]
  const restRadius = 2
  const undeformed = primaryCrystalAnchor(site, restRadius, [])
  const deformed = primaryCrystalAnchor(site, restRadius, [
    {
      direction: site.direction,
      radius: 0.28,
      deformation: 0.2,
    },
  ])
  const restLength = Math.hypot(...undeformed)
  const deformedLength = Math.hypot(...deformed)
  assert.deepEqual(
    site.direction,
    life.spatial.regions[site.region].direction,
  )
  assert.ok(Math.abs(undeformed[0] / restLength - site.direction[0]) < 1e-9)
  assert.ok(Math.abs(undeformed[1] / restLength - site.direction[1]) < 1e-9)
  assert.ok(Math.abs(undeformed[2] / restLength - site.direction[2]) < 1e-9)
  assert.ok(Math.abs(deformed[0] / deformedLength - site.direction[0]) < 1e-9)
  assert.ok(Math.abs(deformed[1] / deformedLength - site.direction[1]) < 1e-9)
  assert.ok(Math.abs(deformed[2] / deformedLength - site.direction[2]) < 1e-9)
  assert.ok(deformedLength > restLength)
  assert.equal(site.crystal.origin, undefined)
  assert.equal(site.crystal.position, undefined)
})

test('replay reproduces primary crystal growth state', () => {
  let life = runUntilNucleation(createLifeState({ seed: 42 }))
  life = addLifeStimulus(life, [0.2, 0.8, -0.3])
  life = runLifeSteps(life, 120)
  const replayed = replayLife({
    seed: life.seed,
    history: life.history,
    step: life.step,
    durationSeconds: life.durationSeconds,
  })
  assert.deepEqual(
    replayed.spatial.sites.map((site) => site.crystal),
    life.spatial.sites.map((site) => site.crystal),
  )
  assert.deepEqual(lifeSnapshot(replayed), lifeSnapshot(life))
})

function runUntilBranching(life) {
  let next = life
  while (
    !next.dead &&
    !next.spatial.sites.some((site) => (site.crystal?.branches?.length ?? 0) > 0)
  ) {
    next = stepLife(next)
  }
  return next
}

test('primary crystals have no branches at nucleation', () => {
  const life = runUntilNucleation(createLifeState({ seed: 7319 }))
  for (const site of life.spatial.sites) {
    assert.equal(site.crystal.parentId, null)
    assert.equal(site.crystal.depth, 0)
    assert.deepEqual(site.crystal.branches, [])
    assert.equal(
      canProduceSecondaryBranches(
        site.crystal,
        life.spatial.accumulation[site.region],
        life.variables.decay,
      ),
      false,
    )
  }
})

test('mature primaries rewrite into 2–4 persistent secondaries', () => {
  const life = runUntilBranching(createLifeState({ seed: 7319 }))
  assert.ok(life.spatial.sites.length > 0)
  const site = life.spatial.sites.find(
    (entry) => (entry.crystal?.branches?.length ?? 0) > 0,
  )
  assert.ok(site)
  const { crystal } = site
  const count = crystal.branches.length
  assert.ok(count >= CRYSTAL_BRANCH_MIN_COUNT)
  assert.ok(count <= CRYSTAL_BRANCH_MAX_COUNT)
  assert.equal(count, secondaryBranchCount(life.seed, site.region))
  assert.ok(crystalMaturity(crystal) >= CRYSTAL_BRANCH_MATURITY)
  assert.ok(
    life.spatial.accumulation[site.region] >= CRYSTAL_BRANCH_MINERAL,
  )
  assert.ok(life.age >= 0.4)
  assert.ok(crystal.bornStep < crystal.branches[0].bornStep)

  for (const [index, branch] of crystal.branches.entries()) {
    assert.equal(branch.parentId, crystal.id)
    assert.equal(branch.parentSiteId, site.id)
    assert.equal(branch.depth, 1)
    assert.equal(branch.bornStep, crystal.branches[0].bornStep)
    assert.equal(branch.id, site.id * 10 + index + 1)
    assert.equal(branch.direction.length, 3)
    assert.ok(branch.length >= CRYSTAL_INITIAL_LENGTH)
    assert.ok(branch.maxLength < crystal.maxLength)
    assert.ok(branch.attachDistance > 0)
    assert.ok(branch.attachDistance < crystal.length)
    assert.deepEqual(branch.branches, [])
    assert.ok(branch.depth <= CRYSTAL_MAX_BRANCH_DEPTH)
    const parentDir = crystal.growthDirection
    const dot =
      branch.direction[0] * parentDir[0] +
      branch.direction[1] * parentDir[1] +
      branch.direction[2] * parentDir[2]
    assert.ok(dot > 0.55)
    assert.ok(dot < 0.98)
  }
})

test('secondary crystals grow after they appear and never rewrite', () => {
  let life = runUntilBranching(createLifeState({ seed: 7319 }))
  const siteId = life.spatial.sites.find(
    (entry) => entry.crystal.branches.length > 0,
  ).id
  const born = life.spatial.sites.find((entry) => entry.id === siteId)
  const lengthAtBirth = born.crystal.branches.map((branch) => branch.length)
  life = runLifeSteps(life, 60)
  const grown = life.spatial.sites.find((entry) => entry.id === siteId)
  assert.equal(grown.crystal.branches.length, born.crystal.branches.length)
  for (const [index, branch] of grown.crystal.branches.entries()) {
    assert.ok(branch.length > lengthAtBirth[index])
    assert.equal(branch.depth, 1)
    assert.deepEqual(branch.branches, [])
  }
})

test('secondaries attach along the parent, not the organism surface', () => {
  const life = runUntilBranching(createLifeState({ seed: 7319 }))
  const site = life.spatial.sites.find(
    (entry) => entry.crystal.branches.length > 0,
  )
  const restRadius = 2
  const root = primaryCrystalAnchor(site, restRadius, [])
  const parentWorldLength = site.crystal.length
  for (const branch of site.crystal.branches) {
    const along = branchAttachAlong(
      branch.attachDistance,
      site.crystal.length,
      parentWorldLength,
    )
    const attach = secondaryCrystalAttachPoint(
      root,
      site.crystal.growthDirection,
      along,
    )
    const distanceFromRoot = Math.hypot(
      attach[0] - root[0],
      attach[1] - root[1],
      attach[2] - root[2],
    )
    const distanceFromSurface = Math.hypot(
      attach[0] - root[0],
      attach[1] - root[1],
      attach[2] - root[2],
    )
    assert.ok(along > 0.01)
    assert.ok(distanceFromRoot > 0.01)
    assert.equal(distanceFromSurface, distanceFromRoot)
  }
})

test('replay reproduces secondary branching state', () => {
  let life = runUntilBranching(createLifeState({ seed: 42 }))
  life = addLifeStimulus(life, [0.2, 0.8, -0.3])
  life = runLifeSteps(life, 90)
  const replayed = replayLife({
    seed: life.seed,
    history: life.history,
    step: life.step,
    durationSeconds: life.durationSeconds,
  })
  assert.deepEqual(
    replayed.spatial.sites.map((site) => site.crystal.branches),
    life.spatial.sites.map((site) => site.crystal.branches),
  )
  assert.deepEqual(lifeSnapshot(replayed), lifeSnapshot(life))
})

test('death is terminal and rejects further intervention', () => {
  const initial = createLifeState({ seed: 7 })
  const dead = runLifeSteps(initial, initial.totalSteps + 20)
  assert.equal(dead.dead, true)
  assert.equal(stepLife(dead), dead)
  assert.equal(addLifeStimulus(dead, [1, 0, 0]), dead)
  assert.equal(setLifeMoisture(dead, 0.8), dead)
})

function totalCrystalLength(life) {
  let total = 0
  for (const site of life.spatial.sites) {
    const crystal = site.crystal
    if (!crystal) continue
    total += crystal.length
    for (const branch of crystal.branches ?? []) total += branch.length
  }
  return total
}

test('moisture 0.5 growth multiplier is neutral', () => {
  assert.equal(moistureGrowthMultiplier(ENV_MOISTURE_NEUTRAL), 1)
  assert.ok(moistureGrowthMultiplier(0.2) < 1)
  assert.ok(moistureGrowthMultiplier(0.8) > 1)
})

test('moisture 0.5 preserves crystal growth vs legacy default', () => {
  const seed = 7319
  const steps = 900
  const legacy = runLifeSteps(createLifeState({ seed }), steps)
  const neutral = runLifeSteps(
    setLifeMoisture(createLifeState({ seed }), 0.5),
    steps,
  )
  assert.deepEqual(
    legacy.spatial.sites.map((site) => site.crystal),
    neutral.spatial.sites.map((site) => site.crystal),
  )
})

test('low and high moisture produce different crystal growth rates', () => {
  const seed = 7319
  const steps = 900
  const dry = runLifeSteps(
    setLifeMoisture(createLifeState({ seed }), 0.2),
    steps,
  )
  const wet = runLifeSteps(
    setLifeMoisture(createLifeState({ seed }), 0.8),
    steps,
  )
  assert.ok(dry.spatial.sites.length > 0)
  assert.ok(wet.spatial.sites.length > 0)
  assert.ok(totalCrystalLength(wet) > totalCrystalLength(dry))
})

test('moisture history accumulates growth then keeps length after return to neutral', () => {
  const seed = 7319
  const wetPhase = 600
  const settlePhase = 300

  let wetThenNeutral = setLifeMoisture(createLifeState({ seed }), 0.8)
  wetThenNeutral = runLifeSteps(wetThenNeutral, wetPhase)
  const lengthAfterWet = totalCrystalLength(wetThenNeutral)
  wetThenNeutral = setLifeMoisture(wetThenNeutral, 0.5)
  wetThenNeutral = runLifeSteps(wetThenNeutral, settlePhase)
  assert.ok(totalCrystalLength(wetThenNeutral) >= lengthAfterWet)

  const alwaysNeutral = runLifeSteps(
    createLifeState({ seed }),
    wetPhase + settlePhase,
  )
  assert.ok(
    totalCrystalLength(wetThenNeutral) > totalCrystalLength(alwaysNeutral),
  )
})

test('moisture environment history replays deterministically', () => {
  let life = setLifeMoisture(createLifeState({ seed: 42 }), 0.2)
  life = runLifeSteps(life, 400)
  life = setLifeMoisture(life, 0.8)
  life = runLifeSteps(life, 400)
  life = setLifeMoisture(life, 0.5)
  life = runLifeSteps(life, 200)

  const replayed = replayLife({
    seed: life.seed,
    history: life.history,
    environmentHistory: life.environmentHistory,
    step: life.step,
    durationSeconds: life.durationSeconds,
  })

  assert.deepEqual(lifeSnapshot(replayed), lifeSnapshot(life))
  assert.equal(replayed.environment.moisture, 0.5)
})

function totalSecondaryBranches(life) {
  let total = 0
  for (const site of life.spatial.sites) {
    total += site.crystal?.branches?.length ?? 0
  }
  return total
}

test('neutral moisture preserves branch count and gates', () => {
  assert.equal(moistureBranchCountDelta(ENV_MOISTURE_NEUTRAL), 0)
  assert.equal(moistureBranchMaturityGate(0.5), CRYSTAL_BRANCH_MATURITY)
  assert.equal(moistureBranchMineralGate(0.5), CRYSTAL_BRANCH_MINERAL)
  for (let region = 0; region < 48; region += 1) {
    assert.equal(
      secondaryBranchCount(7319, region, 0.5),
      secondaryBranchCount(7319, region),
    )
  }

  const baseline = runUntilBranching(createLifeState({ seed: 7319 }))
  const neutral = runUntilBranching(
    setLifeMoisture(createLifeState({ seed: 7319 }), 0.5),
  )
  assert.deepEqual(
    baseline.spatial.sites.map((site) => site.crystal?.branches?.length ?? 0),
    neutral.spatial.sites.map((site) => site.crystal?.branches?.length ?? 0),
  )
})

test('high moisture increases branching vs low under identical seed and age', () => {
  const seed = 7319
  // Past AGE 0.4 branching window with room for wet/dry divergence.
  const steps = 1600

  const dry = runLifeSteps(setLifeMoisture(createLifeState({ seed }), 0.2), steps)
  const wet = runLifeSteps(setLifeMoisture(createLifeState({ seed }), 0.8), steps)

  assert.equal(dry.step, wet.step)
  assert.equal(dry.age, wet.age)
  assert.ok(totalSecondaryBranches(wet) > totalSecondaryBranches(dry))

  for (const site of [...dry.spatial.sites, ...wet.spatial.sites]) {
    const count = site.crystal?.branches?.length ?? 0
    assert.ok(count <= CRYSTAL_BRANCH_MAX_COUNT)
    if (count > 0) {
      assert.ok(count >= 1)
      assert.ok(site.crystal.branches.every((branch) => branch.depth === 1))
    }
  }
})

test('moisture branching differences persist through replay', () => {
  const seed = 88
  const steps = 1600
  let wet = setLifeMoisture(createLifeState({ seed }), 0.8)
  wet = runLifeSteps(wet, steps)

  const replayed = replayLife({
    seed,
    history: wet.history,
    environmentHistory: wet.environmentHistory,
    step: wet.step,
    durationSeconds: wet.durationSeconds,
  })

  assert.deepEqual(
    replayed.spatial.sites.map((site) =>
      (site.crystal?.branches ?? []).map((branch) => branch.id),
    ),
    wet.spatial.sites.map((site) =>
      (site.crystal?.branches ?? []).map((branch) => branch.id),
    ),
  )
  assert.equal(totalSecondaryBranches(replayed), totalSecondaryBranches(wet))
})

test('returning moisture to neutral does not remove existing branches', () => {
  const seed = 7319
  let life = setLifeMoisture(createLifeState({ seed }), 0.8)
  life = runLifeSteps(life, 1600)
  const branchesWhileWet = totalSecondaryBranches(life)
  assert.ok(branchesWhileWet > 0)

  life = setLifeMoisture(life, 0.5)
  life = runLifeSteps(life, 120)
  assert.equal(totalSecondaryBranches(life), branchesWhileWet)
})

test('apply moisture from birth rebuilds crystals at current age', () => {
  const seed = 7319
  let life = runLifeSteps(createLifeState({ seed }), 1350)
  const neutralVol = totalCrystalLength(life)

  const wet = applyLifeMoistureFromBirth(life, 0.8)
  const dry = applyLifeMoistureFromBirth(life, 0.2)

  assert.equal(wet.step, life.step)
  assert.equal(dry.step, life.step)
  assert.equal(wet.environment.moisture, 0.8)
  assert.equal(dry.environment.moisture, 0.2)
  assert.ok(totalCrystalLength(wet) > neutralVol)
  assert.ok(totalCrystalLength(dry) < neutralVol)
  assert.ok(totalSecondaryBranches(wet) >= totalSecondaryBranches(dry))
})
