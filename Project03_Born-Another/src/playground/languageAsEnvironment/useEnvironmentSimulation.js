import { useCallback, useEffect, useRef, useState } from 'react'
import {
  applyEnvironmentImpulse,
  createSimulationState,
  DEFAULT_TUNING,
  environmentTargets,
  environmentTrend,
  resetSimulationState,
  resolveTuning,
  stepEnvironment,
} from './environmentSimulation.js'
import { parseEnvironmentalLanguage } from './parseEnvironmentalLanguage.js'

const HISTORY_CAP = 12
const GRAPH_SAMPLES = 90
const GRAPH_INTERVAL_MS = 100

function emptyGraph() {
  return {
    temperature: [],
    moisture: [],
    disturbance: [],
  }
}

function pushGraphSample(prev, values) {
  const next = {
    temperature: [...prev.temperature, values.temperature],
    moisture: [...prev.moisture, values.moisture],
    disturbance: [...prev.disturbance, values.disturbance],
  }
  for (const key of Object.keys(next)) {
    if (next[key].length > GRAPH_SAMPLES) {
      next[key] = next[key].slice(-GRAPH_SAMPLES)
    }
  }
  return next
}

/**
 * Owns env simulation rAF + language submit/history for Experiment 01.
 * Does not touch Life Engine / WorldViewport.
 */
export function useEnvironmentSimulation() {
  const [sim, setSim] = useState(() => createSimulationState())
  const [tuning, setTuning] = useState(() => ({ ...DEFAULT_TUNING }))
  const [history, setHistory] = useState([])
  const [lastParse, setLastParse] = useState(null)
  const [graph, setGraph] = useState(emptyGraph)

  const tuningRef = useRef(tuning)
  const simRef = useRef(sim)
  tuningRef.current = tuning
  simRef.current = sim

  useEffect(() => {
    let frame = 0
    let previous = performance.now()
    let sampleAccum = 0

    const tick = (now) => {
      const dt = Math.min(0.05, Math.max(0, (now - previous) / 1000))
      previous = now
      const params = resolveTuning(tuningRef.current)
      const next = stepEnvironment(simRef.current, dt, params)
      simRef.current = next
      setSim(next)

      sampleAccum += dt * 1000
      if (sampleAccum >= GRAPH_INTERVAL_MS) {
        sampleAccum = 0
        setGraph((prev) => pushGraphSample(prev, next.values))
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const submitLanguage = useCallback((text) => {
    const parsed = parseEnvironmentalLanguage(text)
    setLastParse(parsed)
    if (parsed.applied) {
      const params = resolveTuning(tuningRef.current)
      const next = applyEnvironmentImpulse(
        simRef.current,
        parsed.impulses,
        params,
      )
      simRef.current = next
      setSim(next)
    }
    const line = parsed.text.trim()
    if (line) {
      setHistory((current) => {
        const entry = [
          ...current,
          {
            text: line,
            unsupported: parsed.unsupported,
            applied: parsed.applied,
            intent: parsed.intentLabel,
          },
        ]
        return entry.length > HISTORY_CAP ? entry.slice(-HISTORY_CAP) : entry
      })
    }
    return parsed
  }, [])

  const resetEnvironment = useCallback(() => {
    const next = resetSimulationState()
    simRef.current = next
    setSim(next)
    setLastParse(null)
    setGraph(emptyGraph())
  }, [])

  const updateTuning = useCallback((key, value) => {
    setTuning((current) =>
      resolveTuning({
        ...current,
        [key]: value,
      }),
    )
  }, [])

  const targets = environmentTargets(sim)
  const trends = {
    temperature: environmentTrend(sim, 'temperature'),
    moisture: environmentTrend(sim, 'moisture'),
    disturbance: environmentTrend(sim, 'disturbance'),
  }

  return {
    environment: sim.values,
    influence: sim.influence,
    targets,
    trends,
    tuning,
    updateTuning,
    graph,
    history,
    lastParse,
    submitLanguage,
    resetEnvironment,
  }
}
