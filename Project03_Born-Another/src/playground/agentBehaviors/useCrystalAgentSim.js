/**
 * Exp03 Study 01 — React binding for crystalAgentSim (fixed-DT, deterministic).
 * Moisture / playing are applied inside the tick via refs so they cannot race
 * against stepCrystalAgentSim and rewind or drop updates.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createCrystalAgentSim,
  crystalAgentGrowthMap,
  meanCrystalAgentProgress,
  moistureGrowthFactor,
  resetCrystalAgentSim,
  scrubCrystalAgentProgress,
  stepCrystalAgentSim,
} from './crystalAgentSim.js'
import { CRYSTAL_AGENT_DEFAULTS } from './crystalAgentTypes.js'
import { planSingleBioCrystalPieces } from './singleBioCrystalPlan.js'

function clamp01(v) {
  return Math.min(1, Math.max(0, Number(v) || 0))
}

/**
 * @param {{
 *   agentSeed: number,
 *   moisture: number,
 *   playing?: boolean,
 * }} opts
 */
export function useCrystalAgentSim({
  agentSeed = 1,
  moisture = CRYSTAL_AGENT_DEFAULTS.moisture,
  playing = true,
} = {}) {
  const planPieces = useMemo(() => {
    const { plan } = planSingleBioCrystalPieces(agentSeed)
    return plan
  }, [agentSeed])

  const moistureRef = useRef(clamp01(moisture))
  const playingRef = useRef(Boolean(playing))
  moistureRef.current = clamp01(moisture)
  playingRef.current = Boolean(playing)

  const simRef = useRef(null)
  if (simRef.current == null) {
    simRef.current = createCrystalAgentSim({
      seed: agentSeed,
      planPieces,
      moisture: moistureRef.current,
    })
    simRef.current.playing = playingRef.current
  }

  const [sim, setSim] = useState(() => simRef.current)

  /* Recreate when seed / plan changes. */
  useEffect(() => {
    const next = createCrystalAgentSim({
      seed: agentSeed,
      planPieces,
      moisture: moistureRef.current,
    })
    next.playing = playingRef.current
    simRef.current = next
    setSim(next)
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
      const moistureChanged = current.moisture !== nextMoisture
      const playingChanged = current.playing !== nextPlaying

      if (moistureChanged || playingChanged) {
        current = {
          ...current,
          moisture: nextMoisture,
          playing: nextPlaying,
        }
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

  return {
    sim,
    simRef,
    planPieces,
    growthByPieceId,
    getGrowthMap,
    diagnostics,
    meanProgress,
    scrubProgress,
    reset,
  }
}
