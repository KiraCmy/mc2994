import assert from 'node:assert/strict'
import test from 'node:test'
import {
  agentLocalMoisture,
  createCrystalAgentSim,
  crystalAgentGrowthMap,
  scrubCrystalAgentProgress,
  stepCrystalAgentSim,
} from './crystalAgentSim.js'
import { CRYSTAL_AGENT_DT, CRYSTAL_AGENT_STATES } from './crystalAgentTypes.js'
import {
  createMoistureField,
  moistureOffsetsForClusters,
  sampleLocalMoisture,
  sampleMoistureOffset,
} from './crystalMoistureField.js'
import {
  flattenClusterPieces,
  MULTI_CLUSTER_MAX,
  planMultiBioCrystalClusters,
} from './multiBioCrystalPlan.js'

function angleBetween(a, b) {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  return Math.acos(Math.min(1, Math.max(-1, dot)))
}

function run(sim, seconds) {
  let s = sim
  const steps = Math.round(seconds / CRYSTAL_AGENT_DT)
  for (let i = 0; i < steps; i += 1) s = stepCrystalAgentSim(s, CRYSTAL_AGENT_DT)
  return s
}

test('multi-cluster plan: count clamps, ids unique, clusters spaced apart', () => {
  assert.equal(planMultiBioCrystalClusters(3, { count: 0 }).length, 1)
  assert.equal(planMultiBioCrystalClusters(3, { count: 99 }).length, MULTI_CLUSTER_MAX)

  const clusters = planMultiBioCrystalClusters(3, { count: 5 })
  const pieces = flattenClusterPieces(clusters)
  const ids = pieces.map((p) => p.id)
  assert.equal(new Set(ids).size, ids.length, 'piece ids must be unique')

  for (const c of clusters) {
    assert.ok(c.plan.some((p) => p.role === 'primary'), `${c.id} has primaries`)
    assert.ok(pieces.filter((p) => p.clusterId === c.id).length === c.plan.length)
  }
  for (let i = 0; i < clusters.length; i += 1) {
    for (let j = i + 1; j < clusters.length; j += 1) {
      const ang = angleBetween(clusters[i].direction, clusters[j].direction)
      assert.ok(ang > 0.18, `clusters ${i},${j} too close (${ang.toFixed(3)} rad)`)
    }
  }
})

test('multi-cluster plan is deterministic per seed', () => {
  const a = planMultiBioCrystalClusters(17, { count: 4 })
  const b = planMultiBioCrystalClusters(17, { count: 4 })
  assert.deepEqual(
    flattenClusterPieces(a).map((p) => [p.id, p.length.toFixed(6)]),
    flattenClusterPieces(b).map((p) => [p.id, p.length.toFixed(6)]),
  )
})

test('satellite clusters thin their root micro carpet', () => {
  const [hero, satellite] = planMultiBioCrystalClusters(5, { count: 2 })
  const rootMicros = (c) => c.plan.filter((p) => p.role === 'micro' && !p.parentId).length
  assert.ok(rootMicros(satellite) < rootMicros(hero))
  assert.ok(rootMicros(satellite) > 0)
})

test('agents never adopt another cluster\'s pieces', () => {
  const clusters = planMultiBioCrystalClusters(8, { count: 5 })
  const pieces = flattenClusterPieces(clusters)
  const clusterOf = new Map(pieces.map((p) => [p.id, p.clusterId]))
  const sim = createCrystalAgentSim({ seed: 8, planPieces: pieces })
  assert.ok(sim.agents.length >= clusters.length * 2)
  for (const agent of sim.agents) {
    assert.equal(clusterOf.get(agent.primaryPieceId), agent.clusterId)
    for (const child of agent.children) {
      assert.equal(clusterOf.get(child.id), agent.clusterId, `${child.id} crossed clusters`)
    }
  }
  /* Every crystal piece is owned by exactly one agent (render map complete). */
  const map = crystalAgentGrowthMap(sim)
  const crystalIds = pieces.filter((p) => p.kind === 'crystal').map((p) => p.id)
  for (const id of crystalIds) assert.ok(id in map, `${id} missing from growth map`)
})

test('moisture field: zero contrast is uniform; offsets stay within ±contrast', () => {
  const clusters = planMultiBioCrystalClusters(21, { count: 5 })
  const flat = createMoistureField({ seed: 21, contrast: 0 })
  for (const c of clusters) {
    assert.equal(sampleMoistureOffset(flat, c.direction), 0)
    assert.equal(sampleLocalMoisture(flat, c.direction, 0.4), 0.4)
  }
  const field = createMoistureField({ seed: 21, contrast: 0.25 })
  const offsets = Object.values(moistureOffsetsForClusters(field, clusters))
  for (const o of offsets) assert.ok(Math.abs(o) <= 0.25 + 1e-9)
  /* The patch is not uniform: some spread between wettest and driest cluster. */
  assert.ok(Math.max(...offsets) - Math.min(...offsets) > 0.1)
  assert.ok(sampleMoistureOffset(field, field.wetDirection) > 0.24)
})

test('same global moisture → different local fates across clusters', () => {
  const seed = 21
  const clusters = planMultiBioCrystalClusters(seed, { count: 5 })
  const field = createMoistureField({ seed, contrast: 0.3 })
  const offsets = moistureOffsetsForClusters(field, clusters)
  const sim0 = createCrystalAgentSim({
    seed,
    planPieces: flattenClusterPieces(clusters),
    moisture: 0.4,
    moistureOffsets: offsets,
  })
  const sim = run(sim0, 20)

  const wettest = Object.entries(offsets).sort((a, b) => b[1] - a[1])[0][0]
  const driest = Object.entries(offsets).sort((a, b) => a[1] - b[1])[0][0]
  const mean = (cid, key) => {
    const list = sim.agents.filter((a) => a.clusterId === cid)
    return list.reduce((s, a) => s + a[key], 0) / list.length
  }
  assert.ok(agentLocalMoisture(sim, sim.agents.find((a) => a.clusterId === wettest)) >
    agentLocalMoisture(sim, sim.agents.find((a) => a.clusterId === driest)))
  assert.ok(mean(wettest, 'progress') > mean(driest, 'progress'),
    'wet cluster should out-grow dry cluster')
  assert.ok(
    sim.agents.some((a) => a.clusterId === driest && a.state === CRYSTAL_AGENT_STATES.STRESSED) ||
      mean(driest, 'stress') > mean(wettest, 'stress'),
    'dry cluster should be more stressed',
  )
})

test('scrub expresses each cluster under its own local moisture', () => {
  const seed = 4
  const clusters = planMultiBioCrystalClusters(seed, { count: 5 })
  const field = createMoistureField({ seed, contrast: 0.3 })
  const offsets = moistureOffsetsForClusters(field, clusters)
  const sim = scrubCrystalAgentProgress(
    createCrystalAgentSim({
      seed,
      planPieces: flattenClusterPieces(clusters),
      moisture: 0.45,
      moistureOffsets: offsets,
    }),
    0.8,
  )
  for (const agent of sim.agents) {
    assert.equal(agent.moistureSeen, agentLocalMoisture(sim, agent))
  }
  const seen = new Set(sim.agents.map((a) => a.moistureSeen.toFixed(3)))
  assert.ok(seen.size > 1, 'clusters should see different moisture')
})
