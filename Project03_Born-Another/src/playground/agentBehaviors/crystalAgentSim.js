/**
 * Exp03 Crystal Agent simulation — pure, deterministic, geometry-agnostic.
 * Primary nodes are agents with FSM; children emerge progressively.
 */
import {
  CRYSTAL_AGENT_DEFAULTS,
  CRYSTAL_AGENT_DT,
  CRYSTAL_AGENT_STATES,
} from './crystalAgentTypes.js'

/** Cluster id used when plan pieces carry no clusterId (single cluster). */
export const DEFAULT_CLUSTER_ID = 'c0'

function clamp01(v) {
  return Math.min(1, Math.max(0, Number(v) || 0))
}

/** Deterministic [0,1) from mixed string / number keys. */
export function agentHash01(...keys) {
  let h = 2166136261 >>> 0
  for (const key of keys) {
    if (typeof key === 'string') {
      for (let i = 0; i < key.length; i += 1) {
        h ^= Math.imul(key.charCodeAt(i), 16777619)
        h = Math.imul(h ^ (h >>> 13), 2246822507)
      }
    } else {
      h ^= Math.imul(Math.floor(Number(key) || 0) + 1, 16777619)
      h = Math.imul(h ^ (h >>> 13), 2246822507)
    }
    h = Math.imul(h ^ (h >>> 16), 3266489909)
  }
  return (h >>> 0) / 4294967296
}

function pushTransition(agent, time, from, to, reason) {
  if (from === to) return
  agent.state = to
  agent.transitions.push({
    t: Number(time.toFixed(3)),
    from,
    to,
    reason,
  })
  if (agent.transitions.length > 12) {
    agent.transitions.splice(0, agent.transitions.length - 12)
  }
}

/**
 * Build child growth slots from a static hierarchy plan.
 * @param {Array<{ id: string, role: string, parentId?: string|null }>} planPieces
 */
/** Cluster a plan piece belongs to (single-cluster plans → 'c0'). */
export function pieceClusterId(piece) {
  return piece?.clusterId ?? DEFAULT_CLUSTER_ID
}

export function collectPrimaryAgentBlueprints(planPieces, seed = 1) {
  const pieces = Array.isArray(planPieces) ? planPieces : []
  const primaries = pieces.filter((p) => p.role === 'primary')
  const byParent = new Map()
  for (const piece of pieces) {
    if (!piece.parentId) continue
    if (!byParent.has(piece.parentId)) byParent.set(piece.parentId, [])
    byParent.get(piece.parentId).push(piece)
  }

  /*
   * Root micros (no parentId) are distributed across the primaries of the
   * *same* cluster — a cluster's root carpet never grows from another
   * cluster's agent.
   */
  const rootMicrosByCluster = new Map()
  for (const piece of pieces) {
    if (piece.role !== 'micro' || piece.parentId) continue
    const cid = pieceClusterId(piece)
    if (!rootMicrosByCluster.has(cid)) rootMicrosByCluster.set(cid, [])
    rootMicrosByCluster.get(cid).push(piece)
  }
  const primariesByCluster = new Map()
  for (const primary of primaries) {
    const cid = pieceClusterId(primary)
    if (!primariesByCluster.has(cid)) primariesByCluster.set(cid, [])
    primariesByCluster.get(cid).push(primary)
  }

  return primaries.map((primary, index) => {
    const clusterId = pieceClusterId(primary)
    const clusterPrimaries = primariesByCluster.get(clusterId) || [primary]
    const localIndex = clusterPrimaries.indexOf(primary)
    const rootMicros = rootMicrosByCluster.get(clusterId) || []
    const u = agentHash01(seed, primary.id, 11)
    const v = agentHash01(seed, primary.id, 29)
    const w = agentHash01(seed, primary.id, 47)

    /* Depth-first: secondaries first, then their tertiaries; micros last. */
    const direct = (byParent.get(primary.id) || []).slice()
    const orderedChildren = []
    const secondaries = direct.filter((c) => c.role === 'secondary')
    const micros = direct.filter((c) => c.role === 'micro')
    const other = direct.filter(
      (c) => c.role !== 'secondary' && c.role !== 'micro',
    )
    for (const sec of secondaries) {
      orderedChildren.push(sec)
      const grands = byParent.get(sec.id) || []
      for (const g of grands) orderedChildren.push(g)
    }
    for (const o of other) orderedChildren.push(o)
    for (const m of micros) orderedChildren.push(m)
    for (let i = 0; i < rootMicros.length; i += 1) {
      if (i % Math.max(1, clusterPrimaries.length) === localIndex) {
        orderedChildren.push(rootMicros[i])
      }
    }

    return {
      id: primary.id,
      index,
      clusterId,
      localIndex,
      primaryPieceId: primary.id,
      wakeAt: 0.15 + u * 0.85,
      baseRate: 0.085 + v * 0.11,
      branchThreshold: 0.32 + w * 0.2,
      stressGain: 0.35 + u * 0.25,
      childIds: orderedChildren.map((c) => c.id),
      childRoles: orderedChildren.map((c) => c.role),
    }
  })
}

function createAgentFromBlueprint(bp, seed) {
  const children = bp.childIds.map((id, i) => {
    const role = bp.childRoles[i]
    const u = agentHash01(seed, id, 7)
    return {
      id,
      role,
      progress: 0,
      /** Parent primary progress required before this child can emerge. */
      unlockAt: Math.min(0.94, bp.branchThreshold + i * (0.055 + u * 0.035)),
      rate: 0.12 + u * 0.14,
      unlocked: false,
    }
  })

  return {
    id: bp.id,
    index: bp.index,
    clusterId: bp.clusterId ?? DEFAULT_CLUSTER_ID,
    localIndex: bp.localIndex ?? bp.index,
    primaryPieceId: bp.primaryPieceId,
    state: CRYSTAL_AGENT_STATES.DORMANT,
    progress: 0,
    stress: 0,
    wakeAt: bp.wakeAt,
    baseRate: bp.baseRate,
    branchThreshold: bp.branchThreshold,
    stressGain: bp.stressGain,
    children,
    nextChildIndex: 0,
    transitions: [],
    moistureSeen: CRYSTAL_AGENT_DEFAULTS.moisture,
    /** Instantaneous primary progress/sec after moisture factor (diagnostics). */
    growthRate: 0,
    growthMul: moistureGrowthFactor(CRYSTAL_AGENT_DEFAULTS.moisture),
  }
}

function sanitizeOffsets(offsets) {
  /** @type {Record<string, number>} */
  const out = {}
  if (!offsets || typeof offsets !== 'object') return out
  for (const [key, value] of Object.entries(offsets)) {
    const n = Number(value)
    if (Number.isFinite(n)) out[key] = Math.min(1, Math.max(-1, n))
  }
  return out
}

/**
 * Local moisture an agent experiences: global level + its cluster's field
 * offset (see crystalMoistureField). No offsets → global (single-cluster).
 */
export function localMoistureForCluster(sim, clusterId) {
  const offset = Number(sim?.moistureOffsets?.[clusterId]) || 0
  return clamp01(clamp01(sim?.moisture) + offset)
}

/* -------------------------------------------------------------------------- */
/* Step 04 — neighbour perception + resource competition                      */
/* -------------------------------------------------------------------------- */
/*
 * Clusters perceive neighbours within COMPETITION_RADIUS (angle between seats
 * on the membrane). Every neighbour drains moisture from the shared patch in
 * proportion to its biomass (maturity × size) and closeness:
 *
 *   drain_i = strength · K · Σ_j  w_ij · biomass_j · asym_ij
 *   asym_ij = 2 · b_j / (b_i + b_j)        (size-asymmetric, like canopy
 *                                            shading: big starves small)
 *   effective_i = local_i − drain_i
 *
 * Big mature clusters therefore starve small close neighbours (stress →
 * collapse → decay); a decaying cluster's biomass falls, releasing moisture
 * back to the patch. strength = 0 → clusters are independent (Step 03).
 */
export const COMPETITION_DEFAULTS = Object.freeze({
  strength: 0.8,
  /** Perception radius (rad on the membrane, radius ≈ 1.4). */
  radius: 0.5,
  /** Moisture one adjacent, equal-size, fully grown neighbour drains. */
  drainPerNeighbor: 0.34,
  /** Seconds a fully decayed cluster lies fallow before it can re-seed. */
  reseedDelay: 6,
  /** Cluster scale that counts as biomass weight 1. */
  referenceScale: 1.3,
})

function smoothstep01(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

function angleBetweenDirs(a, b) {
  const la = Math.hypot(a[0], a[1], a[2]) || 1
  const lb = Math.hypot(b[0], b[1], b[2]) || 1
  const dot = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb)
  return Math.acos(Math.min(1, Math.max(-1, dot)))
}

/**
 * Neighbour graph from cluster seats.
 * @param {Array<{ id: string, direction: number[], scale?: number }>} clusters
 * @returns {Record<string, Array<{ id: string, weight: number, angle: number }>>}
 */
export function buildClusterNeighborGraph(
  clusters,
  radius = COMPETITION_DEFAULTS.radius,
) {
  /** @type {Record<string, Array<{ id: string, weight: number, angle: number }>>} */
  const graph = {}
  const list = (clusters || []).filter((c) => c?.id && c?.direction)
  for (const c of list) graph[c.id] = []
  for (let i = 0; i < list.length; i += 1) {
    for (let j = 0; j < list.length; j += 1) {
      if (i === j) continue
      const angle = angleBetweenDirs(list[i].direction, list[j].direction)
      const weight = 1 - smoothstep01(0, radius, angle)
      if (weight <= 0.001) continue
      graph[list[i].id].push({
        id: list[j].id,
        weight: Number(weight.toFixed(4)),
        angle: Number(angle.toFixed(4)),
      })
    }
  }
  return graph
}

/**
 * Biomass per cluster: maturity of its agents (primary 70 % + emerged
 * children 30 %) × relative cluster size.
 */
export function clusterBiomass(sim) {
  /** @type {Record<string, { sum: number, n: number }>} */
  const acc = {}
  for (const agent of sim?.agents || []) {
    const cid = agent.clusterId ?? DEFAULT_CLUSTER_ID
    const kids = agent.children || []
    const childMean =
      kids.length > 0
        ? kids.reduce((s, c) => s + (c.unlocked ? clamp01(c.progress) : 0), 0) /
          kids.length
        : clamp01(agent.progress)
    const m = clamp01(agent.progress) * 0.7 + childMean * 0.3
    if (!acc[cid]) acc[cid] = { sum: 0, n: 0 }
    acc[cid].sum += m
    acc[cid].n += 1
  }
  /** @type {Record<string, number>} */
  const out = {}
  const ref = COMPETITION_DEFAULTS.referenceScale
  for (const [cid, { sum, n }] of Object.entries(acc)) {
    const size = (Number(sim?.clusterScales?.[cid]) || ref) / ref
    out[cid] = n > 0 ? (sum / n) * size : 0
  }
  return out
}

/**
 * Moisture drain on every cluster from its perceived neighbours.
 * @returns {Record<string, { drain: number, biomass: number,
 *   sources: Record<string, number> }>}
 */
export function computeClusterCompetition(sim) {
  const strength = clamp01(sim?.competition ?? 0)
  const graph = sim?.neighbors || {}
  const biomass = clusterBiomass(sim)
  const k = COMPETITION_DEFAULTS.drainPerNeighbor
  /** @type {Record<string, { drain: number, biomass: number, sources: Record<string, number> }>} */
  const out = {}
  const ids = new Set([...Object.keys(graph), ...Object.keys(biomass)])
  for (const cid of ids) {
    const sources = {}
    let drain = 0
    if (strength > 0) {
      const own = biomass[cid] || 0
      for (const n of graph[cid] || []) {
        const theirs = biomass[n.id] || 0
        const asym = Math.min(2, (2 * theirs) / (own + theirs + 0.05))
        const amount = strength * k * n.weight * theirs * asym
        if (amount <= 1e-5) continue
        sources[n.id] = Number(amount.toFixed(4))
        drain += amount
      }
    }
    out[cid] = {
      drain: Math.min(1, Number(drain.toFixed(4))),
      biomass: Number((biomass[cid] || 0).toFixed(4)),
      sources,
    }
  }
  return out
}

/** Moisture a cluster actually receives: field-local minus neighbour drain. */
export function effectiveMoistureForCluster(sim, clusterId) {
  const drain = Number(sim?.competitionState?.[clusterId]?.drain) || 0
  return clamp01(localMoistureForCluster(sim, clusterId) - drain)
}

/** What an agent experiences (field + competition). */
export function agentLocalMoisture(sim, agent) {
  return effectiveMoistureForCluster(
    sim,
    agent?.clusterId ?? DEFAULT_CLUSTER_ID,
  )
}

function clusterMeta(clusters) {
  const list = Array.isArray(clusters) ? clusters : []
  /** @type {Record<string, number>} */
  const clusterScales = {}
  for (const c of list) {
    if (c?.id) clusterScales[c.id] = Number(c.scale) || COMPETITION_DEFAULTS.referenceScale
  }
  return {
    clusterScales,
    neighbors: buildClusterNeighborGraph(list),
  }
}

/**
 * @param {{
 *   seed: number,
 *   planPieces: object[],
 *   moisture?: number,
 *   moistureOffsets?: Record<string, number>,
 * }} opts
 */
export function createCrystalAgentSim({
  seed = 1,
  planPieces = [],
  moisture = CRYSTAL_AGENT_DEFAULTS.moisture,
  moistureOffsets = null,
  /** [{ id, direction, scale }] — enables neighbour perception. */
  clusters = null,
  /** 0 = independent clusters; 1 = full competition. */
  competition = 0,
} = {}) {
  const blueprints = collectPrimaryAgentBlueprints(planPieces, seed)
  const multi = Array.isArray(clusters) && clusters.length > 0
  const reseedDelay = multi ? COMPETITION_DEFAULTS.reseedDelay : 0
  const sim = {
    reseedDelay,
    seed: seed | 0,
    time: 0,
    step: 0,
    moisture: clamp01(moisture),
    moistureOffsets: sanitizeOffsets(moistureOffsets),
    competition: clamp01(competition),
    ...clusterMeta(clusters),
    playing: true,
    blueprints,
    agents: blueprints.map((bp) => ({
      ...createAgentFromBlueprint(bp, seed),
      reseedDelay,
    })),
  }
  sim.competitionState = computeClusterCompetition(sim)
  return sim
}

export function resetCrystalAgentSim(
  sim,
  { moisture, moistureOffsets, competition } = {},
) {
  if (!sim) return sim
  const seed = sim.seed
  const blueprints = sim.blueprints || []
  const next = {
    seed,
    time: 0,
    step: 0,
    moisture: clamp01(moisture ?? sim.moisture),
    moistureOffsets: sanitizeOffsets(moistureOffsets ?? sim.moistureOffsets),
    competition: clamp01(competition ?? sim.competition ?? 0),
    clusterScales: sim.clusterScales || {},
    neighbors: sim.neighbors || {},
    reseedDelay: sim.reseedDelay || 0,
    playing: sim.playing,
    blueprints,
    agents: blueprints.map((bp) => ({
      ...createAgentFromBlueprint(bp, seed),
      reseedDelay: sim.reseedDelay || 0,
    })),
  }
  next.competitionState = computeClusterCompetition(next)
  return next
}

/** Change competition strength (0..1) without resetting growth. */
export function setCrystalAgentCompetition(sim, competition) {
  if (!sim) return sim
  const next = { ...sim, competition: clamp01(competition) }
  next.competitionState = computeClusterCompetition(next)
  return next
}

/** Replace the per-cluster moisture field offsets (e.g. contrast change). */
export function setCrystalAgentMoistureOffsets(sim, moistureOffsets) {
  if (!sim) return sim
  return { ...sim, moistureOffsets: sanitizeOffsets(moistureOffsets) }
}

export function setCrystalAgentMoisture(sim, moisture) {
  if (!sim) return sim
  return { ...sim, moisture: clamp01(moisture) }
}

export function setCrystalAgentPlaying(sim, playing) {
  if (!sim) return sim
  return { ...sim, playing: Boolean(playing) }
}

/**
 * Moisture → growth rate multiplier (NOT inverted).
 * 0.0 → 0.35 (slow) · 0.5 → 1.025 · 1.0 → 1.70 (fast)
 */
export function moistureGrowthFactor(moisture) {
  const m = clamp01(moisture)
  return 0.35 + m * 1.35
}

function stepAgent(agent, moisture, dt, time) {
  const {
    moistureStress,
    moistureComfort,
    moistureCritical,
    moistureWake,
  } = CRYSTAL_AGENT_DEFAULTS

  agent.moistureSeen = moisture
  const from = agent.state
  let state = agent.state

  /* —— Transitions (environment + local progress; not AGE) —— */
  if (state === CRYSTAL_AGENT_STATES.DORMANT) {
    if (time >= agent.wakeAt) {
      if (moisture < moistureStress) {
        pushTransition(
          agent,
          time,
          from,
          CRYSTAL_AGENT_STATES.STRESSED,
          'wake-dry',
        )
        state = CRYSTAL_AGENT_STATES.STRESSED
      } else if (moisture >= moistureWake) {
        pushTransition(agent, time, from, CRYSTAL_AGENT_STATES.GROWING, 'wake')
        state = CRYSTAL_AGENT_STATES.GROWING
      }
    }
  } else if (
    state === CRYSTAL_AGENT_STATES.GROWING ||
    state === CRYSTAL_AGENT_STATES.BRANCHING
  ) {
    if (moisture < moistureStress) {
      pushTransition(
        agent,
        time,
        from,
        CRYSTAL_AGENT_STATES.STRESSED,
        'low-moisture',
      )
      state = CRYSTAL_AGENT_STATES.STRESSED
    } else if (
      state === CRYSTAL_AGENT_STATES.GROWING &&
      agent.nextChildIndex < agent.children.length &&
      agent.progress >=
        agent.children[agent.nextChildIndex].unlockAt
    ) {
      pushTransition(
        agent,
        time,
        from,
        CRYSTAL_AGENT_STATES.BRANCHING,
        `unlock-child-${agent.nextChildIndex}`,
      )
      state = CRYSTAL_AGENT_STATES.BRANCHING
    }
  } else if (state === CRYSTAL_AGENT_STATES.STRESSED) {
    if (moisture < moistureCritical) {
      agent.stress = Math.min(1, agent.stress + dt * agent.stressGain * 1.8)
    } else {
      agent.stress = Math.min(1, agent.stress + dt * agent.stressGain * 0.45)
    }
    /* Decay only after stress accumulates — dry stalls; it does not skip to empty. */
    if (agent.stress >= 1) {
      pushTransition(
        agent,
        time,
        from,
        CRYSTAL_AGENT_STATES.DECAYING,
        'stress-collapse',
      )
      state = CRYSTAL_AGENT_STATES.DECAYING
    } else if (moisture >= moistureComfort) {
      agent.stress = Math.max(0, agent.stress - dt * 0.55)
      if (agent.stress < 0.35) {
        pushTransition(
          agent,
          time,
          from,
          CRYSTAL_AGENT_STATES.GROWING,
          'moisture-recovery',
        )
        state = CRYSTAL_AGENT_STATES.GROWING
      }
    }
  } else if (state === CRYSTAL_AGENT_STATES.DECAYING) {
    const empty =
      agent.progress <= 0 && agent.children.every((c) => c.progress <= 0)
    /* Multi-cluster: a fully decayed site lies fallow, then re-seeds. */
    if (agent.reseedDelay > 0 && empty) {
      agent.fallowFor = (agent.fallowFor || 0) + dt
    }
    if (agent.reseedDelay > 0 && empty && agent.fallowFor >= agent.reseedDelay) {
      agent.stress = 0
      agent.fallowFor = 0
      agent.wakeAt = time + 0.5
      agent.nextChildIndex = 0
      for (const child of agent.children) {
        child.unlocked = false
        child.progress = 0
      }
      pushTransition(agent, time, from, CRYSTAL_AGENT_STATES.DORMANT, 'reseed')
      state = CRYSTAL_AGENT_STATES.DORMANT
    } else if (moisture >= moistureComfort + 0.15) {
      /* High moisture can always restart — even from progress 0. */
      agent.stress = Math.max(0, agent.stress - dt * 0.45)
      if (agent.stress < 0.5) {
        pushTransition(
          agent,
          time,
          from,
          CRYSTAL_AGENT_STATES.GROWING,
          'regrowth',
        )
        state = CRYSTAL_AGENT_STATES.GROWING
      }
    }
  }

  /* —— Continuous dynamics —— */
  const growthMul = moistureGrowthFactor(moisture)
  agent.growthMul = growthMul
  const progressBefore = agent.progress

  if (state === CRYSTAL_AGENT_STATES.GROWING) {
    agent.progress = Math.min(
      1,
      agent.progress + dt * agent.baseRate * growthMul,
    )
    agent.stress = Math.max(0, agent.stress - dt * 0.15)
  } else if (state === CRYSTAL_AGENT_STATES.BRANCHING) {
    agent.progress = Math.min(
      1,
      agent.progress + dt * agent.baseRate * growthMul * 0.85,
    )
    const child = agent.children[agent.nextChildIndex]
    if (child && !child.unlocked) {
      child.unlocked = true
    }
    if (child) {
      child.progress = Math.min(
        1,
        child.progress + dt * child.rate * growthMul,
      )
      if (child.progress >= 0.2) {
        agent.nextChildIndex = Math.min(
          agent.children.length,
          agent.nextChildIndex + 1,
        )
        pushTransition(
          agent,
          time,
          CRYSTAL_AGENT_STATES.BRANCHING,
          CRYSTAL_AGENT_STATES.GROWING,
          'branch-committed',
        )
        state = CRYSTAL_AGENT_STATES.GROWING
      }
    } else {
      pushTransition(
        agent,
        time,
        CRYSTAL_AGENT_STATES.BRANCHING,
        CRYSTAL_AGENT_STATES.GROWING,
        'no-pending-child',
      )
      state = CRYSTAL_AGENT_STATES.GROWING
    }
  } else if (state === CRYSTAL_AGENT_STATES.STRESSED) {
    agent.progress = Math.min(
      1,
      agent.progress + dt * agent.baseRate * growthMul * 0.25,
    )
  } else if (state === CRYSTAL_AGENT_STATES.DECAYING) {
    agent.progress = Math.max(0, agent.progress - dt * 0.06)
    for (const child of agent.children) {
      if (child.progress > 0) {
        child.progress = Math.max(0, child.progress - dt * 0.08)
      }
    }
  } else {
    agent.growthRate = 0
  }

  agent.growthRate = dt > 0 ? (agent.progress - progressBefore) / dt : 0

  /* Continue emerging already-unlocked children (skip the active BRANCHING child). */
  if (
    state === CRYSTAL_AGENT_STATES.GROWING ||
    state === CRYSTAL_AGENT_STATES.BRANCHING ||
    state === CRYSTAL_AGENT_STATES.STRESSED
  ) {
    const activeId =
      state === CRYSTAL_AGENT_STATES.BRANCHING
        ? agent.children[agent.nextChildIndex]?.id
        : null
    for (const child of agent.children) {
      if (!child.unlocked) continue
      if (child.progress >= 1) continue
      if (child.id === activeId) continue
      const slow =
        state === CRYSTAL_AGENT_STATES.STRESSED ? 0.35 : 1
      child.progress = Math.min(
        1,
        child.progress + dt * child.rate * growthMul * 0.7 * slow,
      )
    }
  }

  agent.state = state
  return agent
}

/**
 * Advance simulation by wall-clock seconds (internally fixed DT).
 * Returns a new sim object (shallow-immutable agents cloned).
 */
export function stepCrystalAgentSim(sim, elapsedSeconds = CRYSTAL_AGENT_DT) {
  if (!sim?.playing) return sim
  const dt = CRYSTAL_AGENT_DT
  let remaining = Math.max(0, Number(elapsedSeconds) || 0)
  /* Cap catch-up to avoid spiral after tab blur. */
  remaining = Math.min(remaining, dt * 4)

  let time = sim.time
  let step = sim.step
  let agents = sim.agents.map((agent) => ({
    ...agent,
    children: agent.children.map((c) => ({ ...c })),
    transitions: agent.transitions.slice(),
  }))

  let competitionState = sim.competitionState || {}
  while (remaining >= dt - 1e-9) {
    time += dt
    step += 1
    /* Agents perceive neighbours' current biomass before acting. */
    competitionState = computeClusterCompetition({ ...sim, agents })
    const view = { ...sim, competitionState }
    agents = agents.map((agent) =>
      stepAgent(agent, agentLocalMoisture(view, agent), dt, time),
    )
    remaining -= dt
  }

  return {
    ...sim,
    time,
    step,
    agents,
    competitionState: computeClusterCompetition({ ...sim, agents }),
  }
}

/**
 * Flatten agent progress → pieceId → growth 0..1 for rendering.
 */
export function crystalAgentGrowthMap(sim) {
  /** @type {Record<string, number>} */
  const map = {}
  if (!sim?.agents) return map
  for (const agent of sim.agents) {
    map[agent.primaryPieceId] = clamp01(agent.progress)
    for (const child of agent.children) {
      map[child.id] = child.unlocked ? clamp01(child.progress) : 0
    }
  }
  return map
}

/** Mean primary progress 0..1 (inspector scrub readout). */
export function meanCrystalAgentProgress(sim) {
  const agents = sim?.agents
  if (!agents?.length) return 0
  return (
    agents.reduce((sum, agent) => sum + clamp01(agent.progress), 0) /
    agents.length
  )
}

/**
 * Moisture gates how much of a scrubbed maturity is expressed.
 * Dry → small / stressed / few branches. Wet → fuller primary + more branching.
 */
function moistureFormationGates(moisture) {
  const m = clamp01(moisture)
  const { moistureStress, moistureComfort, moistureCritical } =
    CRYSTAL_AGENT_DEFAULTS
  return {
    /** Primary scale factor for scrubbed maturity. 0→0.22 · 0.5→0.72 · 1→1 */
    primaryExpress: 0.22 + m * 0.78,
    /** Branch unlock / fill factor. Dry suppresses secondary/tertiary. */
    branchExpress:
      m < moistureCritical
        ? 0.05
        : m < moistureStress
          ? 0.12 + m * 0.55
          : m < moistureComfort
            ? 0.4 + m * 0.55
            : 0.65 + m * 0.35,
    stressed: m < moistureStress,
    critical: m < moistureCritical,
    growthMul: moistureGrowthFactor(m),
  }
}

/**
 * Instant formation scrub 0..1 — sets primary + child growth without waiting.
 * Moisture changes the expressed morphology (scale + branching), not just a label.
 */
/** Seconds of live simulation that Progress 0→1 spans in multi-cluster mode. */
export const MULTI_CLUSTER_SCRUB_HORIZON = 45

/**
 * Multi-cluster scrub = deterministic fast-forward of the real simulation.
 * Competition, collapse and re-seeding are history-dependent, so a static
 * estimate cannot show them; replaying from t=0 with the current inputs makes
 * "Progress 100 %" identical to letting the colony run for the horizon.
 */
function fastForwardScrub(sim, amount) {
  const t = clamp01(amount)
  let next = resetCrystalAgentSim(sim)
  next.playing = true
  /*
   * Count whole fixed steps (never loop on time: a sub-DT remainder would not
   * advance stepCrystalAgentSim and the loop would never exit).
   */
  const totalSteps = Math.round((t * MULTI_CLUSTER_SCRUB_HORIZON) / CRYSTAL_AGENT_DT)
  const perCall = 4
  let done = 0
  while (done < totalSteps) {
    const n = Math.min(perCall, totalSteps - done)
    const before = next.step
    next = stepCrystalAgentSim(next, CRYSTAL_AGENT_DT * n + 1e-9)
    const advanced = next.step - before
    if (advanced <= 0) break /* safety: never spin */
    done += advanced
  }
  return { ...next, playing: sim.playing, scrubAmount: t }
}

export function scrubCrystalAgentProgress(sim, amount) {
  if (!sim) return sim
  if (sim.reseedDelay > 0) return fastForwardScrub(sim, amount)
  /*
   * Single cluster: two passes — express the formation without competition,
   * measure biomass, then re-express under the drain neighbours would cause.
   */
  const free = scrubPass({ ...sim, competitionState: {} }, amount)
  if (!(clamp01(sim.competition) > 0)) {
    return { ...free, competitionState: computeClusterCompetition(free) }
  }
  const competitionState = computeClusterCompetition(free)
  const contested = scrubPass({ ...sim, competitionState }, amount)
  return {
    ...contested,
    competitionState: computeClusterCompetition(contested),
  }
}

function scrubPass(sim, amount) {
  if (!sim) return sim
  const t = clamp01(amount)
  const seed = sim.seed
  const blueprints = sim.blueprints || []
  const moisture = clamp01(sim.moisture)

  const agents = blueprints.map((bp) => {
    const agent = createAgentFromBlueprint(bp, seed)
    agent.reseedDelay = sim.reseedDelay || 0
    /* Each cluster expresses the scrub under its own local moisture. */
    const local = agentLocalMoisture(sim, agent)
    const gates = moistureFormationGates(local)
    const stagger = agentHash01(seed, bp.id, 3) * 0.18
    const localT =
      t <= stagger ? 0 : clamp01((t - stagger) / Math.max(1e-6, 1 - stagger))

    agent.moistureSeen = local
    agent.growthMul = gates.growthMul
    agent.growthRate = 0
    agent.transitions = []
    agent.stress = gates.critical ? 1 : gates.stressed ? 0.55 + (1 - local) * 0.35 : 0

    if (localT <= 0) {
      agent.state = gates.stressed
        ? CRYSTAL_AGENT_STATES.STRESSED
        : CRYSTAL_AGENT_STATES.DORMANT
      agent.progress = 0
      agent.nextChildIndex = 0
      return agent
    }

    agent.progress = clamp01(localT * gates.primaryExpress)

    if (gates.critical && agent.progress < 0.08) {
      agent.state = CRYSTAL_AGENT_STATES.DECAYING
      agent.progress = clamp01(agent.progress * 0.35)
      agent.nextChildIndex = 0
      return agent
    }

    if (gates.stressed) {
      agent.state = CRYSTAL_AGENT_STATES.STRESSED
    } else {
      agent.state = CRYSTAL_AGENT_STATES.GROWING
    }

    let nextChildIndex = 0
    const branchMaturity = localT * gates.branchExpress

    for (let i = 0; i < agent.children.length; i += 1) {
      const child = agent.children[i]
      if (branchMaturity < child.unlockAt) break
      child.unlocked = true
      const span = Math.max(0.12, 1 - child.unlockAt)
      child.progress = clamp01(
        ((branchMaturity - child.unlockAt) / span) * gates.branchExpress,
      )
      nextChildIndex = i + 1
      if (!gates.stressed) {
        agent.state = CRYSTAL_AGENT_STATES.BRANCHING
      }
    }

    agent.nextChildIndex = Math.min(agent.children.length, nextChildIndex)
    if (
      !gates.stressed &&
      (agent.nextChildIndex >= agent.children.length ||
        (agent.children[agent.nextChildIndex] &&
          branchMaturity < agent.children[agent.nextChildIndex].unlockAt))
    ) {
      if (agent.nextChildIndex > 0 || agent.progress >= 0.999) {
        agent.state = CRYSTAL_AGENT_STATES.GROWING
      }
    }

    return agent
  })

  return {
    ...sim,
    moisture,
    time: Number((t * 18).toFixed(3)),
    step: Math.round(t * 18 * 30),
    agents,
    scrubAmount: t,
  }
}

/**
 * Visual vitality per crystal piece, 0..1 (1 = clear healthy glass,
 * → 0 = ashen / calcified). Combines the owning agent's FSM state with the
 * moisture it actually receives, so starved clusters dull before they die.
 * @returns {Record<string, number>}
 */
export function crystalAgentVitalityMap(sim) {
  /** @type {Record<string, number>} */
  const map = {}
  if (!sim?.agents) return map
  for (const agent of sim.agents) {
    const m = agentLocalMoisture(sim, agent)
    const supply = 0.55 + 0.45 * smoothstep01(0.12, 0.5, m)
    let state = 1
    if (agent.state === CRYSTAL_AGENT_STATES.STRESSED) {
      state = Math.max(0.3, 0.8 - 0.5 * clamp01(agent.stress))
    } else if (agent.state === CRYSTAL_AGENT_STATES.DECAYING) {
      state = 0.12
    }
    const v = Number((state * supply).toFixed(3))
    map[agent.primaryPieceId] = v
    for (const child of agent.children) map[child.id] = v
  }
  return map
}
