import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildClusterNeighborGraph,
  computeClusterCompetition,
  createCrystalAgentSim,
  crystalAgentVitalityMap,
  effectiveMoistureForCluster,
  localMoistureForCluster,
  MULTI_CLUSTER_SCRUB_HORIZON,
  scrubCrystalAgentProgress,
  stepCrystalAgentSim,
} from './crystalAgentSim.js'
import { CRYSTAL_AGENT_DT, CRYSTAL_AGENT_STATES } from './crystalAgentTypes.js'
import {
  createMoistureField,
  moistureOffsetsForClusters,
} from './crystalMoistureField.js'
import {
  flattenClusterPieces,
  planMultiBioCrystalClusters,
} from './multiBioCrystalPlan.js'

const SEED = 884731

function makeSim({ seed = SEED, competition = 0.8, moisture = 0.62, count = 5 } = {}) {
  const clusters = planMultiBioCrystalClusters(seed, { count })
  const offsets = moistureOffsetsForClusters(createMoistureField({ seed }), clusters)
  return {
    clusters,
    sim: createCrystalAgentSim({
      seed,
      planPieces: flattenClusterPieces(clusters),
      moisture,
      moistureOffsets: offsets,
      clusters,
      competition,
    }),
  }
}

function run(sim, seconds) {
  let s = sim
  const steps = Math.round(seconds / CRYSTAL_AGENT_DT)
  for (let i = 0; i < steps; i += 1) s = stepCrystalAgentSim(s, CRYSTAL_AGENT_DT)
  return s
}

function clusterProgress(sim, cid) {
  const list = sim.agents.filter((a) => a.clusterId === cid)
  return list.reduce((s, a) => s + a.progress, 0) / list.length
}

test('neighbour graph is symmetric and only links nearby clusters', () => {
  const clusters = planMultiBioCrystalClusters(SEED)
  const graph = buildClusterNeighborGraph(clusters)
  for (const [a, list] of Object.entries(graph)) {
    for (const n of list) {
      assert.ok(n.weight > 0 && n.weight <= 1)
      const back = graph[n.id].find((m) => m.id === a)
      assert.ok(back, `${a}→${n.id} must be mutual`)
      assert.equal(back.weight, n.weight)
    }
  }
  /* The hero sits in the middle → perceives every satellite. */
  assert.equal(graph.c0.length, clusters.length - 1)
})

test('competition 0 → no drain; effective moisture equals the field', () => {
  const { sim: s0, clusters } = makeSim({ competition: 0 })
  const sim = run(s0, 20)
  for (const c of clusters) {
    assert.equal(sim.competitionState[c.id].drain, 0)
    assert.equal(effectiveMoistureForCluster(sim, c.id), localMoistureForCluster(sim, c.id))
  }
})

test('size-asymmetric: a big mature cluster drains a small one more than vice versa', () => {
  const { sim: s0 } = makeSim()
  const sim = run(s0, 15)
  const comp = computeClusterCompetition(sim)
  const heroOnSmall = comp.c1.sources.c0 ?? 0
  const smallOnHero = comp.c0.sources.c1 ?? 0
  assert.ok(heroOnSmall > smallOnHero * 2, `${heroOnSmall} vs ${smallOnHero}`)
})

test('A/B: without competition all clusters thrive; with it, neighbours of the hero are suppressed', () => {
  const free = run(makeSim({ competition: 0 }).sim, 45)
  const contested = run(makeSim({ competition: 0.8 }).sim, 45)
  const ids = ['c0', 'c1', 'c2', 'c3', 'c4']
  for (const id of ids) {
    assert.ok(clusterProgress(free, id) > 0.95, `${id} should thrive alone`)
  }
  const suppressed = ids.filter((id) => clusterProgress(contested, id) < 0.2)
  assert.ok(suppressed.length >= 2, `expected ≥2 suppressed, got ${suppressed}`)
  /* Somebody still wins the patch. */
  assert.ok(ids.some((id) => clusterProgress(contested, id) > 0.95))
})

test('fully decayed sites re-seed (lie fallow → dormant) in multi-cluster sims', () => {
  const sim = run(makeSim({ competition: 1, moisture: 0.5 }).sim, 60)
  const reseeds = sim.agents.flatMap((a) => a.transitions).filter((t) => t.reason === 'reseed')
  assert.ok(reseeds.length > 0, 'expected at least one reseed transition')
})

test('starved clusters lose vitality; thriving ones stay clear', () => {
  const sim = run(makeSim({ competition: 0.8 }).sim, 30)
  const vit = crystalAgentVitalityMap(sim)
  /* Most-starved agent of the cluster (dormant empty sites carry no glass). */
  const byCluster = (cid) =>
    Math.min(
      ...sim.agents
        .filter((a) => a.clusterId === cid)
        .map((a) => vit[a.primaryPieceId]),
    )
  const ranked = ['c0', 'c1', 'c2', 'c3', 'c4']
    .map((id) => ({ id, p: clusterProgress(sim, id) }))
    .sort((a, b) => a.p - b.p)
  const thriving = ranked.filter((r) => r.p > 0.95).map((r) => byCluster(r.id))
  assert.ok(Math.max(...thriving) > 0.9, 'least-drained winner stays clear')
  assert.ok(byCluster(ranked[0].id) < 0.5, 'starved cluster clouds over')
  /* Drained-but-alive winners read dimmer than the undrained one. */
  assert.ok(Math.min(...thriving) < Math.max(...thriving))
  for (const v of Object.values(vit)) assert.ok(v >= 0 && v <= 1)
})

test('scrub applies neighbour drain (contested formation is smaller)', () => {
  const free = scrubCrystalAgentProgress(makeSim({ competition: 0 }).sim, 1)
  const contested = scrubCrystalAgentProgress(makeSim({ competition: 0.8 }).sim, 1)
  const total = (s) => s.agents.reduce((sum, a) => sum + a.progress, 0)
  assert.ok(total(contested) < total(free))
  assert.ok(Object.values(contested.competitionState).some((c) => c.drain > 0.05))
})

test('multi-cluster scrub to 100 % equals running the colony for the horizon', () => {
  const { sim: s0 } = makeSim({ competition: 0.8 })
  const scrubbed = scrubCrystalAgentProgress(s0, 1)
  const live = run(s0, MULTI_CLUSTER_SCRUB_HORIZON)
  const fp = (s) => s.agents.map((a) => [a.id, a.state, a.progress.toFixed(3)].join(':'))
  assert.deepEqual(fp(scrubbed), fp(live))
  assert.equal(scrubbed.scrubAmount, 1)
  /* Mid-scrub is an earlier point of the same history. */
  const half = scrubCrystalAgentProgress(s0, 0.5)
  assert.ok(Math.abs(half.time - MULTI_CLUSTER_SCRUB_HORIZON / 2) < 0.05)
  assert.ok(
    half.agents.some((a) => a.state === CRYSTAL_AGENT_STATES.STRESSED ||
      a.state === CRYSTAL_AGENT_STATES.DECAYING),
  )
})

test('multi-cluster scrub terminates for any slider value (no sub-step spin)', () => {
  const { sim: s0 } = makeSim({ competition: 0.8 })
  for (const amount of [0, 0.001, 0.013, 0.333, 0.5, 0.77, 0.99, 0.999, 1]) {
    const out = scrubCrystalAgentProgress(s0, amount)
    const expected = Math.round((amount * MULTI_CLUSTER_SCRUB_HORIZON) / CRYSTAL_AGENT_DT)
    assert.equal(out.step, expected, `amount ${amount}`)
  }
})
