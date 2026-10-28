/**
 * Exp03 Crystal Agent simulation — pure, deterministic, geometry-agnostic.
 * Primary nodes are agents with FSM; children emerge progressively.
 */
import {
  CRYSTAL_AGENT_DEFAULTS,
  CRYSTAL_AGENT_DT,
  CRYSTAL_AGENT_STATES,
} from './crystalAgentTypes.js'

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
export function collectPrimaryAgentBlueprints(planPieces, seed = 1) {
  const pieces = Array.isArray(planPieces) ? planPieces : []
  const primaries = pieces.filter((p) => p.role === 'primary')
  const byParent = new Map()
  for (const piece of pieces) {
    if (!piece.parentId) continue
    if (!byParent.has(piece.parentId)) byParent.set(piece.parentId, [])
    byParent.get(piece.parentId).push(piece)
  }

  /* Root micros (no parentId) are distributed across primaries. */
  const rootMicros = pieces.filter((p) => p.role === 'micro' && !p.parentId)

  return primaries.map((primary, index) => {
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
      if (i % Math.max(1, primaries.length) === index) {
        orderedChildren.push(rootMicros[i])
      }
    }

    return {
      id: primary.id,
      index,
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

/**
 * @param {{ seed: number, planPieces: object[], moisture?: number }} opts
 */
export function createCrystalAgentSim({
  seed = 1,
  planPieces = [],
  moisture = CRYSTAL_AGENT_DEFAULTS.moisture,
} = {}) {
  const blueprints = collectPrimaryAgentBlueprints(planPieces, seed)
  return {
    seed: seed | 0,
    time: 0,
    step: 0,
    moisture: clamp01(moisture),
    playing: true,
    blueprints,
    agents: blueprints.map((bp) => createAgentFromBlueprint(bp, seed)),
  }
}

export function resetCrystalAgentSim(sim, { moisture } = {}) {
  if (!sim) return sim
  const seed = sim.seed
  const blueprints = sim.blueprints || []
  return {
    seed,
    time: 0,
    step: 0,
    moisture: clamp01(moisture ?? sim.moisture),
    playing: sim.playing,
    blueprints,
    agents: blueprints.map((bp) => createAgentFromBlueprint(bp, seed)),
  }
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
    /* High moisture can always restart — even from progress 0. */
    if (moisture >= moistureComfort + 0.15) {
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

  while (remaining >= dt - 1e-9) {
    time += dt
    step += 1
    agents = agents.map((agent) =>
      stepAgent(agent, sim.moisture, dt, time),
    )
    remaining -= dt
  }

  return {
    ...sim,
    time,
    step,
    agents,
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
export function scrubCrystalAgentProgress(sim, amount) {
  if (!sim) return sim
  const t = clamp01(amount)
  const seed = sim.seed
  const blueprints = sim.blueprints || []
  const moisture = clamp01(sim.moisture)
  const gates = moistureFormationGates(moisture)

  const agents = blueprints.map((bp) => {
    const agent = createAgentFromBlueprint(bp, seed)
    const stagger = agentHash01(seed, bp.id, 3) * 0.18
    const localT =
      t <= stagger ? 0 : clamp01((t - stagger) / Math.max(1e-6, 1 - stagger))

    agent.moistureSeen = moisture
    agent.growthMul = gates.growthMul
    agent.growthRate = 0
    agent.transitions = []
    agent.stress = gates.critical ? 1 : gates.stressed ? 0.55 + (1 - moisture) * 0.35 : 0

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
