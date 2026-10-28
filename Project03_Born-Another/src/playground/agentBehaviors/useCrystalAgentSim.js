/**
 * Exp03 Study 01 — React binding for crystalAgentSim (fixed-DT, deterministic).
 * Moisture / playing are applied inside the tick via refs so they cannot race
 * against stepCrystalAgentSim and rewind or drop updates.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  COMPETITION_DEFAULTS,
  createCrystalAgentSim,
  crystalAgentGrowthMap,
  crystalAgentVitalityMap,
  effectiveMoistureForCluster,
  meanCrystalAgentProgress,
  moistureGrowthFactor,
  localMoistureForCluster,
  resetCrystalAgentSim,
  scrubCrystalAgentProgress,
  setCrystalAgentCompetition,
  stepCrystalAgentSim,
} from './crystalAgentSim.js'
import { CRYSTAL_AGENT_DEFAULTS } from './crystalAgentTypes.js'
import {
  createMoistureField,
  MOISTURE_FIELD_DEFAULTS,
  moistureOffsetsForClusters,
} from './crystalMoistureField.js'
import {
  flattenClusterPieces,
  MULTI_CLUSTER_DEFAULT_COUNT,
  planMultiBioCrystalClusters,
} from './multiBioCrystalPlan.js'

function clamp01(v) {
  return Math.min(1, Math.max(0, Number(v) || 0))
}

function sameOffsets(a, b) {
  const ka = Object.keys(a || {})
  const kb = Object.keys(b || {})
  if (ka.length !== kb.length) return false
  return ka.every((k) => a[k] === b?.[k])
}

/**
 * @param {{
 *   agentSeed: number,
 *   moisture: number,
 *   playing?: boolean,
 *   clusterCount?: number,
 *   fieldContrast?: number,
 *   competition?: number,
 * }} opts
 */
export function useCrystalAgentSim({
  agentSeed = 1,
  moisture = CRYSTAL_AGENT_DEFAULTS.moisture,
  playing = true,
  clusterCount = MULTI_CLUSTER_DEFAULT_COUNT,
  fieldContrast = MOISTURE_FIELD_DEFAULTS.contrast,
  competition = COMPETITION_DEFAULTS.strength,
} = {}) {
  /* Several clusters on the membrane patch; each primary is still one agent. */
  const clusters = useMemo(
    () => planMultiBioCrystalClusters(agentSeed, { count: clusterCount }),
    [agentSeed, clusterCount],
  )
  const planPieces = useMemo(() => flattenClusterPieces(clusters), [clusters])

  /* Local moisture field: global slider ± seeded wet-pocket offset per cluster. */
  const moistureField = useMemo(
    () => createMoistureField({ seed: agentSeed, contrast: fieldContrast }),
    [agentSeed, fieldContrast],
  )
  const moistureOffsets = useMemo(
    () => moistureOffsetsForClusters(moistureField, clusters),
    [moistureField, clusters],
  )

  const moistureRef = useRef(clamp01(moisture))
  const playingRef = useRef(Boolean(playing))
  const offsetsRef = useRef(moistureOffsets)
  const competitionRef = useRef(clamp01(competition))
  moistureRef.current = clamp01(moisture)
  playingRef.current = Boolean(playing)
  offsetsRef.current = moistureOffsets
  competitionRef.current = clamp01(competition)

  const simRef = useRef(null)
  if (simRef.current == null) {
    simRef.current = createCrystalAgentSim({
      seed: agentSeed,
      planPieces,
      moisture: moistureRef.current,
      moistureOffsets: offsetsRef.current,
      clusters,
      competition: competitionRef.current,
    })
    simRef.current.playing = playingRef.current
  }

  const [sim, setSim] = useState(() => simRef.current)

  /* Recreate when seed / plan (cluster count) changes. */
  useEffect(() => {
    const next = createCrystalAgentSim({
      seed: agentSeed,
      planPieces,
      moisture: moistureRef.current,
      moistureOffsets: offsetsRef.current,
      clusters,
      competition: competitionRef.current,
    })
    next.playing = playingRef.current
    simRef.current = next
    setSim(next)
    // clusters and planPieces change together (planPieces derives from clusters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentSeed, planPieces])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let uiAccum = 0

    const tick = (now) => {
      const elapsed = Math.min(0.1, (now - last) / 1000)
      last = now
      let current = simRef.current
      if (!current) {
        raf = requestAnimationFrame(tick)
        return
      }

      const nextMoisture = moistureRef.current
      const nextPlaying = playingRef.current
      const nextOffsets = offsetsRef.current
      const nextCompetition = competitionRef.current
      const moistureChanged =
        current.moisture !== nextMoisture ||
        !sameOffsets(current.moistureOffsets, nextOffsets) ||
        current.competition !== nextCompetition
      const playingChanged = current.playing !== nextPlaying

      if (moistureChanged || playingChanged) {
        current = setCrystalAgentCompetition(
          {
            ...current,
            moisture: nextMoisture,
            moistureOffsets: { ...nextOffsets },
            playing: nextPlaying,
          },
          nextCompetition,
        )
        /*
         * While paused (typical after Progress scrub), re-express formation
         * under the new moisture so dry/wet is immediately visible.
         */
        if (moistureChanged && !nextPlaying) {
          const amount = Number.isFinite(current.scrubAmount)
            ? current.scrubAmount
            : meanCrystalAgentProgress(current)
          current = scrubCrystalAgentProgress(current, amount)
        }
        simRef.current = current
        setSim(current)
      }

      if (current.playing) {
        const next = stepCrystalAgentSim(current, elapsed)
        /* Live play leaves scrub snapshot so moisture edits can re-apply it. */
        simRef.current = next
        uiAccum += elapsed
        if (uiAccum >= 1 / 12) {
          uiAccum = 0
          setSim(next)
        }
      } else if (!moistureChanged && !playingChanged) {
        uiAccum += elapsed
        if (uiAccum >= 1 / 8) {
          uiAccum = 0
          setSim(current)
        }
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const reset = useCallback(() => {
    if (!simRef.current) return
    const next = resetCrystalAgentSim(simRef.current, {
      moisture: moistureRef.current,
      moistureOffsets: offsetsRef.current,
      competition: competitionRef.current,
    })
    next.playing = playingRef.current
    delete next.scrubAmount
    simRef.current = next
    setSim(next)
  }, [])

  /** Jump formation maturity 0..1 without waiting for live growth. */
  const scrubProgress = useCallback((amount) => {
    if (!simRef.current) return
    const withMoisture = {
      ...simRef.current,
      moisture: moistureRef.current,
      moistureOffsets: { ...offsetsRef.current },
      competition: competitionRef.current,
    }
    const next = scrubCrystalAgentProgress(withMoisture, amount)
    next.playing = playingRef.current
    simRef.current = next
    setSim(next)
  }, [])

  const growthByPieceId = useMemo(() => crystalAgentGrowthMap(sim), [sim])

  const getGrowthMap = useCallback(() => {
    return crystalAgentGrowthMap(simRef.current)
  }, [])

  const getVitalityMap = useCallback(() => {
    return crystalAgentVitalityMap(simRef.current)
  }, [])

  /* Slider shows scrub position when set; otherwise live mean progress. */
  const meanProgress = useMemo(() => {
    if (Number.isFinite(sim?.scrubAmount)) return clamp01(sim.scrubAmount)
    return meanCrystalAgentProgress(sim)
  }, [sim])

  const diagnostics = useMemo(() => {
    const agents = sim?.agents || []
    const meanRate =
      agents.length > 0
        ? agents.reduce((s, a) => s + (a.growthRate || 0), 0) / agents.length
        : 0
    const unlockedScales = agents.flatMap((a) =>
      a.children.filter((c) => c.unlocked).map((c) => c.progress),
    )
    const meanBranchScale =
      unlockedScales.length > 0
        ? unlockedScales.reduce((s, v) => s + v, 0) / unlockedScales.length
        : 0
    return {
      moistureMul: moistureGrowthFactor(sim?.moisture ?? moisture),
      meanProgress,
      meanGrowthRate: meanRate,
      meanRenderScale: meanProgress,
      meanBranchScale,
      mapKeys: Object.keys(crystalAgentGrowthMap(sim)).length,
    }
  }, [sim, moisture, meanProgress])

  /* Per-cluster readout for the inspector (local moisture, mean progress…). */
  const clusterSummaries = useMemo(() => {
    const agents = sim?.agents || []
    return clusters.map((cluster) => {
      const own = agents.filter((a) => a.clusterId === cluster.id)
      const meanOf = (key) =>
        own.length > 0
          ? own.reduce((s, a) => s + (Number(a[key]) || 0), 0) / own.length
          : 0
      const stateCounts = {}
      for (const a of own) stateCounts[a.state] = (stateCounts[a.state] || 0) + 1
      const dominantState =
        Object.entries(stateCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
      return {
        id: cluster.id,
        index: cluster.index,
        agentCount: own.length,
        moistureOffset: sim?.moistureOffsets?.[cluster.id] ?? 0,
        /* Field-only moisture vs what is left after neighbours drain it. */
        fieldMoisture: localMoistureForCluster(sim, cluster.id),
        localMoisture: effectiveMoistureForCluster(sim, cluster.id),
        drain: sim?.competitionState?.[cluster.id]?.drain ?? 0,
        biomass: sim?.competitionState?.[cluster.id]?.biomass ?? 0,
        drainedBy: Object.entries(sim?.competitionState?.[cluster.id]?.sources || {})
          .filter(([, amount]) => amount >= 0.015)
          .sort((a, b) => b[1] - a[1])
          .map(([id]) => id),
        meanProgress: meanOf('progress'),
        meanStress: meanOf('stress'),
        dominantState,
      }
    })
  }, [sim, clusters])

  return {
    sim,
    simRef,
    clusters,
    clusterSummaries,
    moistureField,
    planPieces,
    growthByPieceId,
    getGrowthMap,
    getVitalityMap,
    competitionState: sim?.competitionState ?? null,
    diagnostics,
    meanProgress,
    scrubProgress,
    reset,
  }
}
