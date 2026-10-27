/**
 * Growth-focus helpers for Experiment 03.
 *
 * Visual form (crystals today; filaments / mycelium later) stays behind this
 * seam so agent behavior can target "sites" without knowing mesh/shader details.
 *
 * Membrane freeze: Study 01 composites a snapshot of form morph / deformations
 * at a fixed AGE onto a live Life Engine sample so crystal growth can scrub
 * independently. Life Engine itself is unchanged.
 */

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0))
}

function directionDot(a, b) {
  if (!a || !b) return -1
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function copyDeformation(entry) {
  return {
    ...entry,
    direction: entry.direction ? [...entry.direction] : [0, 1, 0],
  }
}

/**
 * List observable secondary-growth sites from a Life Engine snapshot.
 * Crystal path uses spatialGrowthSites; swap mapping when forms change.
 */
export function listGrowthSites(life) {
  const sites = life?.outputs?.surface?.spatialGrowthSites ?? []
  return sites.map((site) => {
    const length = Number(site.crystal?.length) || 0
    const branches = site.crystal?.branches?.length ?? 0
    return {
      id: site.id,
      form: 'crystal',
      label: `Site ${String(site.id + 1).padStart(2, '0')}`,
      metric: length,
      metricLabel: 'length',
      branches,
      direction: site.direction ? [...site.direction] : [0, 1, 0],
    }
  })
}

/**
 * Prefer the most developed primary crystal; stable fallback to earliest id.
 * @deprecated Prefer selectStableGrowthCluster + locked IDs for Study 01.
 */
export function selectPrimaryGrowthSiteId(life) {
  const sites = listGrowthSites(life)
  if (!sites.length) return null
  let best = sites[0]
  for (let i = 1; i < sites.length; i += 1) {
    const site = sites[i]
    if (site.metric > best.metric + 1e-6) best = site
    else if (
      Math.abs(site.metric - best.metric) <= 1e-6 &&
      site.id < best.id
    ) {
      best = site
    }
  }
  return best.id
}

/**
 * One-shot local cluster picker for microscope framing.
 * Chooses a seed with the densest nearby growth, then locks neighboring site IDs
 * within an angular cone. Call once at membrane freeze AGE and keep the IDs.
 *
 * @returns {{ siteIds: number[], anchorSiteId: number | null, direction: number[] | null }}
 */
export function selectStableGrowthCluster(
  life,
  { maxSites = 5, minDot = 0.62, preferCount = 4 } = {},
) {
  const sites = listGrowthSites(life)
  if (!sites.length) {
    return { siteIds: [], anchorSiteId: null, direction: null }
  }

  let seed = sites[0]
  let bestScore = -Infinity
  for (const candidate of sites) {
    const nearby = sites.filter(
      (site) => directionDot(candidate.direction, site.direction) >= minDot,
    )
    /* Prefer patches that show ~3–5 clusters in one frontal frame. */
    const countScore =
      1 - Math.abs(nearby.length - preferCount) / Math.max(preferCount, 1)
    const score =
      nearby.length * 10 +
      countScore * 18 +
      candidate.metric * 3 -
      candidate.id * 0.01
    if (score > bestScore) {
      bestScore = score
      seed = candidate
    }
  }

  const clustered = sites
    .filter((site) => directionDot(seed.direction, site.direction) >= minDot)
    .sort((a, b) => {
      if (b.metric !== a.metric) return b.metric - a.metric
      return a.id - b.id
    })

  const picked = []
  const seen = new Set()
  const push = (site) => {
    if (!site || seen.has(site.id)) return
    seen.add(site.id)
    picked.push(site)
  }
  push(seed)
  for (const site of clustered) {
    if (picked.length >= maxSites) break
    push(site)
  }

  /* Fill toward preferCount with nearest angular neighbors if the cone is thin. */
  if (picked.length < Math.min(preferCount, sites.length)) {
    const ranked = [...sites].sort((a, b) => {
      const da = directionDot(seed.direction, a.direction)
      const db = directionDot(seed.direction, b.direction)
      if (db !== da) return db - da
      return a.id - b.id
    })
    for (const site of ranked) {
      if (picked.length >= Math.min(maxSites, preferCount)) break
      push(site)
    }
  }

  const siteIds = picked.map((site) => site.id).sort((a, b) => a - b)
  /* Mean outward normal → frontal membrane view for the whole patch. */
  let mx = 0
  let my = 0
  let mz = 0
  for (const site of picked) {
    mx += site.direction[0]
    my += site.direction[1]
    mz += site.direction[2]
  }
  const mLen = Math.hypot(mx, my, mz) || 1
  return {
    siteIds,
    anchorSiteId: seed.id,
    direction: [mx / mLen, my / mLen, mz / mLen],
  }
}

export function describeGrowthFocus(life, siteIds, anchorSiteId = null) {
  const sites = listGrowthSites(life)
  const idSet = new Set(
    Array.isArray(siteIds) ? siteIds : siteIds != null ? [siteIds] : [],
  )
  const locked = sites.filter((site) => idSet.has(site.id))
  const anchor =
    locked.find((site) => site.id === anchorSiteId) ??
    locked[0] ??
    null

  if (!anchor) {
    return {
      id: anchorSiteId,
      form: 'crystal',
      label: idSet.size
        ? 'Locked sites (not present at this growth time)'
        : 'Awaiting nucleation',
      metric: 0,
      metricLabel: 'length',
      count: 0,
      lockedIds: [...idSet].sort((a, b) => a - b),
      presentIds: [],
    }
  }

  const metric =
    locked.reduce((sum, site) => sum + site.metric, 0) /
    Math.max(1, locked.length)

  return {
    id: anchor.id,
    form: anchor.form,
    label: `Cluster · ${locked.length} site${locked.length === 1 ? '' : 's'}`,
    metric,
    metricLabel: 'mean length',
    count: locked.length,
    lockedIds: [...idSet].sort((a, b) => a - b),
    presentIds: locked.map((site) => site.id).sort((a, b) => a - b),
  }
}

/**
 * Fixed membrane reference AGE for Study 01 baseline.
 * Morph + local deformations are sampled here and held while growth time scrubs.
 */
export const MEMBRANE_FREEZE_AGE = 0.45

/** @deprecated Use MEMBRANE_FREEZE_AGE — same observation park point. */
export const CRYSTAL_STUDY_OBSERVE_AGE = MEMBRANE_FREEZE_AGE

export function clampObserveAge(age) {
  return clamp01(age)
}

/**
 * Snapshot only the membrane-driving fields from a Life Engine sample.
 * Crystal sites stay on the live growth-time life.
 */
export function captureMembraneFreeze(life) {
  if (!life?.outputs?.form) return null
  return {
    age: life.age,
    dead: Boolean(life.dead),
    variables: {
      growth: life.variables.growth,
      decay: life.variables.decay,
    },
    outputs: {
      form: {
        scale: life.outputs.form.scale,
        vitality: life.outputs.form.vitality,
        integrity: life.outputs.form.integrity,
        localDeformations: (life.outputs.form.localDeformations ?? []).map(
          copyDeformation,
        ),
      },
    },
  }
}

/**
 * Display composite: frozen membrane form + live crystal growth surface.
 * Does not mutate Life Engine state. World / Exp01–02 omit this path.
 */
export function composeFrozenMembraneLife(growthLife, freeze) {
  if (!growthLife) return growthLife
  if (!freeze?.outputs?.form) return growthLife
  return {
    ...growthLife,
    dead: false,
    variables: {
      ...growthLife.variables,
      growth: freeze.variables.growth,
      decay: freeze.variables.decay,
    },
    outputs: {
      ...growthLife.outputs,
      form: freeze.outputs.form,
    },
  }
}
