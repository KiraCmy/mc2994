import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
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
/** UI / graph publish rate — keep sim in a ref; do not setState every rAF. */
const UI_INTERVAL_MS = 100
const UI_VALUE_EPS = 0.002

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

function valuesChanged(a, b) {
  if (!a || !b) return true
  return (
    Math.abs(a.temperature - b.temperature) > UI_VALUE_EPS ||
    Math.abs(a.moisture - b.moisture) > UI_VALUE_EPS ||
    Math.abs(a.disturbance - b.disturbance) > UI_VALUE_EPS ||
    Math.abs((a.influenceT ?? 0) - (b.influenceT ?? 0)) > UI_VALUE_EPS ||
    Math.abs((a.influenceM ?? 0) - (b.influenceM ?? 0)) > UI_VALUE_EPS ||
    Math.abs((a.influenceD ?? 0) - (b.influenceD ?? 0)) > UI_VALUE_EPS
  )
}

function publishSnapshot(state) {
  return {
    temperature: state.values.temperature,
    moisture: state.values.moisture,
    disturbance: state.values.disturbance,
    influenceT: state.influence.temperature,
    influenceM: state.influence.moisture,
    influenceD: state.influence.disturbance,
  }
}

/**
 * Owns env simulation rAF + language submit/history for Experiment 01.
 * Simulation steps every frame in a ref; React state publishes ~10 Hz so the
 * WebGL viewports are not reconciled every rAF (was the Playground stutter).
 * Life Engine sync (Moisture / Disturbance→Turbulence) lives in Experiment01.
 */
export function useEnvironmentSimulation() {
  const [sim, setSim] = useState(() => createSimulationState())
  const [tuning, setTuning] = useState(() => ({ ...DEFAULT_TUNING }))
  const [history, setHistory] = useState([])
  const [lastParse, setLastParse] = useState(null)
  const [graph, setGraph] = useState(emptyGraph)

  const tuningRef = useRef(tuning)
  const simRef = useRef(sim)
  const publishedRef = useRef(publishSnapshot(sim))
  tuningRef.current = tuning

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

      sampleAccum += dt * 1000
      if (sampleAccum >= UI_INTERVAL_MS) {
        sampleAccum = 0
        const snap = publishSnapshot(next)
        const changed = valuesChanged(publishedRef.current, snap)
        if (!changed) {
          // Env calm: skip React — avoids perpetual 10 Hz canvas reconciles.
        } else {
          publishedRef.current = snap
          // Low-priority UI publish — keeps R3F frames from hitching.
          startTransition(() => {
            setGraph((prev) => pushGraphSample(prev, next.values))
            setSim(next)
          })
        }
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
      publishedRef.current = publishSnapshot(next)
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
    publishedRef.current = publishSnapshot(next)
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
    /** Live sim (values + influence); updated every rAF without React. */
    environmentRef: simRef,
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
