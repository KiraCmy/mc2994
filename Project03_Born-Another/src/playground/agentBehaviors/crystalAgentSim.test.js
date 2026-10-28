import assert from 'node:assert/strict'
import test from 'node:test'
import {
  agentHash01,
  collectPrimaryAgentBlueprints,
  createCrystalAgentSim,
  crystalAgentGrowthMap,
  meanCrystalAgentProgress,
  moistureGrowthFactor,
  resetCrystalAgentSim,
  scrubCrystalAgentProgress,
  setCrystalAgentMoisture,
  stepCrystalAgentSim,
} from './crystalAgentSim.js'
import { CRYSTAL_AGENT_DT, CRYSTAL_AGENT_STATES } from './crystalAgentTypes.js'
import { planSingleBioCrystalPieces } from './singleBioCrystalPlan.js'

function fingerprint(sim) {
  return sim.agents.map((a) => ({
    id: a.id,
    state: a.state,
    progress: Number(a.progress.toFixed(5)),
    nextChildIndex: a.nextChildIndex,
    children: a.children.map((c) => ({
      id: c.id,
      unlocked: c.unlocked,
      progress: Number(c.progress.toFixed(5)),
    })),
    transitions: a.transitions.map((t) => `${t.t}:${t.from}>${t.to}:${t.reason}`),
  }))
}

test('agentHash01 is deterministic and distinguishes string ids', () => {
  assert.equal(agentHash01(3, 'p-0-0', 11), agentHash01(3, 'p-0-0', 11))
  assert.notEqual(agentHash01(3, 'p-0-0', 11), agentHash01(3, 'p-0-1', 11))
})

test('blueprints preserve primary → secondary → tertiary hierarchy', () => {
  const { plan } = planSingleBioCrystalPieces(7)
  const bps = collectPrimaryAgentBlueprints(plan, 7)
  assert.ok(bps.length >= 1)
  const primaryIds = new Set(plan.filter((p) => p.role === 'primary').map((p) => p.id))
  for (const bp of bps) {
    assert.ok(primaryIds.has(bp.primaryPieceId))
    assert.ok(bp.childIds.length > 0)
    const roles = bp.childRoles
    const firstSec = roles.indexOf('secondary')
    const firstTer = roles.indexOf('tertiary')
    if (firstSec >= 0 && firstTer >= 0) {
      assert.ok(firstSec < firstTer)
    }
  }
})

test('same seed + moisture history reproduces growth sequence', () => {
  const { plan } = planSingleBioCrystalPieces(11)
  const run = (moistureSchedule) => {
    let sim = createCrystalAgentSim({
      seed: 11,
      planPieces: plan,
      moisture: moistureSchedule[0],
    })
    for (let i = 0; i < moistureSchedule.length; i += 1) {
      sim = setCrystalAgentMoisture(sim, moistureSchedule[i])
      sim = stepCrystalAgentSim(sim, CRYSTAL_AGENT_DT * 4)
    }
    return fingerprint(sim)
  }

  const schedule = [0.55, 0.55, 0.7, 0.7, 0.4, 0.4, 0.2, 0.55]
  assert.deepEqual(run(schedule), run(schedule))
})

test('reset with same seed restores initial dormant agents', () => {
  const { plan } = planSingleBioCrystalPieces(5)
  let sim = createCrystalAgentSim({ seed: 5, planPieces: plan, moisture: 0.6 })
  for (let i = 0; i < 60; i += 1) {
    sim = stepCrystalAgentSim(sim, CRYSTAL_AGENT_DT)
  }
  assert.ok(sim.agents.some((a) => a.progress > 0.05))
  sim = resetCrystalAgentSim(sim)
  assert.equal(sim.time, 0)
  assert.equal(sim.step, 0)
  for (const agent of sim.agents) {
    assert.equal(agent.state, CRYSTAL_AGENT_STATES.DORMANT)
    assert.equal(agent.progress, 0)
    assert.equal(agent.children.every((c) => !c.unlocked && c.progress === 0), true)
  }
})

test('agents grow at different rates and secondaries unlock over time', () => {
  const { plan } = planSingleBioCrystalPieces(9)
  let sim = createCrystalAgentSim({ seed: 9, planPieces: plan, moisture: 0.75 })
  for (let i = 0; i < 180; i += 1) {
    sim = stepCrystalAgentSim(sim, CRYSTAL_AGENT_DT)
  }
  const progresses = sim.agents.map((a) => a.progress)
  assert.ok(progresses.some((p) => p > 0.2))
  assert.ok(Math.max(...progresses) - Math.min(...progresses) > 0.02)

  const anySecondary = sim.agents.some((a) =>
    a.children.some((c) => c.role === 'secondary' && c.unlocked && c.progress > 0.05),
  )
  assert.equal(anySecondary, true)

  const map = crystalAgentGrowthMap(sim)
  for (const agent of sim.agents) {
    assert.equal(map[agent.primaryPieceId], agent.progress)
  }
})

test('scrubCrystalAgentProgress jumps formation maturity instantly', () => {
  const { plan } = planSingleBioCrystalPieces(42)
  let sim = createCrystalAgentSim({ seed: 42, planPieces: plan, moisture: 1 })
  assert.equal(meanCrystalAgentProgress(sim), 0)

  sim = scrubCrystalAgentProgress(sim, 1)
  assert.ok(meanCrystalAgentProgress(sim) > 0.9)
  const map = crystalAgentGrowthMap(sim)
  assert.ok(Object.values(map).some((v) => v > 0.9))
  assert.ok(
    sim.agents.some((a) => a.children.some((c) => c.unlocked && c.progress > 0)),
  )

  sim = scrubCrystalAgentProgress(sim, 0)
  assert.equal(meanCrystalAgentProgress(sim), 0)
})

test('same Progress scrub: wet expresses more growth/branches than dry', () => {
  const { plan } = planSingleBioCrystalPieces(42)
  const dry = scrubCrystalAgentProgress(
    createCrystalAgentSim({ seed: 42, planPieces: plan, moisture: 0 }),
    1,
  )
  const mid = scrubCrystalAgentProgress(
    createCrystalAgentSim({ seed: 42, planPieces: plan, moisture: 0.5 }),
    1,
  )
  const wet = scrubCrystalAgentProgress(
    createCrystalAgentSim({ seed: 42, planPieces: plan, moisture: 1 }),
    1,
  )

  const sum = (sim) =>
    sim.agents.reduce(
      (s, a) =>
        s +
        a.progress +
        a.children.reduce((cs, c) => cs + (c.unlocked ? c.progress : 0), 0),
      0,
    )
  const branches = (sim) =>
    sim.agents.reduce(
      (s, a) => s + a.children.filter((c) => c.unlocked).length,
      0,
    )

  assert.ok(sum(dry) < sum(mid))
  assert.ok(sum(mid) <= sum(wet) + 1e-9)
  assert.ok(branches(dry) < branches(wet))
  assert.ok(
    dry.agents.every(
      (a) =>
        a.state === CRYSTAL_AGENT_STATES.STRESSED ||
        a.state === CRYSTAL_AGENT_STATES.DECAYING,
    ),
  )
})

test('moistureGrowthFactor increases with moisture (not inverted)', () => {
  assert.ok(moistureGrowthFactor(0) < moistureGrowthFactor(0.5))
  assert.ok(moistureGrowthFactor(0.5) < moistureGrowthFactor(1))
  assert.ok(Math.abs(moistureGrowthFactor(0.5) - 1.025) < 1e-9)
})

test('low moisture drives stress / slows growth vs wet', () => {
  const { plan } = planSingleBioCrystalPieces(13)

  let dry = createCrystalAgentSim({ seed: 13, planPieces: plan, moisture: 0.18 })
  let wet = createCrystalAgentSim({ seed: 13, planPieces: plan, moisture: 0.85 })
  for (let i = 0; i < 120; i += 1) {
    dry = stepCrystalAgentSim(dry, CRYSTAL_AGENT_DT)
    wet = stepCrystalAgentSim(wet, CRYSTAL_AGENT_DT)
  }

  const dryProg = dry.agents.reduce((s, a) => s + a.progress, 0)
  const wetProg = wet.agents.reduce((s, a) => s + a.progress, 0)
  assert.ok(wetProg > dryProg)

  const stressedOrDecaying = dry.agents.some(
    (a) =>
      a.state === CRYSTAL_AGENT_STATES.STRESSED ||
      a.state === CRYSTAL_AGENT_STATES.DECAYING ||
      a.stress > 0.2,
  )
  assert.equal(stressedOrDecaying, true)
})

test('same seed + elapsed time: moisture 0 < 0.5 < 1.0 primary progress', () => {
  const seed = 42
  const seconds = 5
  const { plan } = planSingleBioCrystalPieces(seed)
  const steps = Math.round(seconds / CRYSTAL_AGENT_DT)

  const run = (moisture) => {
    let sim = createCrystalAgentSim({ seed, planPieces: plan, moisture })
    for (let i = 0; i < steps; i += 1) {
      sim = stepCrystalAgentSim(sim, CRYSTAL_AGENT_DT)
    }
    const primarySum = sim.agents.reduce((s, a) => s + a.progress, 0)
    const map = crystalAgentGrowthMap(sim)
    const meanScale =
      Object.values(map).reduce((s, v) => s + v, 0) /
      Math.max(1, Object.keys(map).length)
    const meanRate =
      sim.agents.reduce((s, a) => s + (a.growthRate || 0), 0) /
      Math.max(1, sim.agents.length)
    return {
      moisture,
      mul: moistureGrowthFactor(moisture),
      primarySum,
      meanScale,
      meanRate,
      states: sim.agents.map((a) => a.state),
      unlocked: sim.agents.reduce(
        (s, a) => s + a.children.filter((c) => c.unlocked).length,
        0,
      ),
    }
  }

  const m0 = run(0)
  const m05 = run(0.5)
  const m1 = run(1)

  assert.ok(
    m0.states.every(
      (s) =>
        s === CRYSTAL_AGENT_STATES.STRESSED ||
        s === CRYSTAL_AGENT_STATES.DECAYING ||
        s === CRYSTAL_AGENT_STATES.DORMANT,
    ),
  )
  assert.ok(m0.primarySum < m05.primarySum)
  assert.ok(m05.primarySum < m1.primarySum)
  assert.ok(m0.meanScale < m05.meanScale)
  assert.ok(m05.meanScale <= m1.meanScale + 1e-9)
  assert.ok(m1.unlocked >= m05.unlocked)
  assert.ok(m05.unlocked > m0.unlocked)
})
