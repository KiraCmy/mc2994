import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addLifeStimulus,
  createLifeState,
  LIFE_FIXED_TIMESTEP,
  replayLife,
  runLifeSteps,
} from './lifeEngine.js'

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0))
}

export function useLifeEngine(initialSeed) {
  const [life, setLife] = useState(() => createLifeState({ seed: initialSeed }))
  const [playing, setPlaying] = useState(true)
  const playingRef = useRef(playing)
  const accumulator = useRef(0)
  playingRef.current = playing

  useEffect(() => {
    let frame = 0
    let previous = performance.now()

    const tick = (now) => {
      const elapsed = Math.min(0.25, Math.max(0, (now - previous) / 1000))
      previous = now
      if (playingRef.current) {
        accumulator.current += elapsed
        const steps = Math.floor(accumulator.current / LIFE_FIXED_TIMESTEP)
        if (steps > 0) {
          accumulator.current -= steps * LIFE_FIXED_TIMESTEP
          setLife((current) => runLifeSteps(current, steps))
        }
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (life.dead) setPlaying(false)
  }, [life.dead])

  const togglePlaying = useCallback(() => {
    setPlaying((current) => {
      if (!current && life.dead) return false
      return !current
    })
  }, [life.dead])

  const restart = useCallback(() => {
    accumulator.current = 0
    setLife((current) =>
      replayLife({
        seed: current.seed,
        history: current.history,
        durationSeconds: current.durationSeconds,
        step: 0,
      }),
    )
    setPlaying(true)
  }, [])

  const changeSeed = useCallback((seed) => {
    accumulator.current = 0
    setLife(createLifeState({ seed }))
    setPlaying(true)
  }, [])

  const addStimulus = useCallback((direction) => {
    setLife((current) => addLifeStimulus(current, direction))
  }, [])

  /** Deterministic scrub: Seed + history + target AGE → exact state. */
  const seekToAge = useCallback((age, { resume = false } = {}) => {
    accumulator.current = 0
    const target = clamp01(age)
    setLife((current) => {
      const step = Math.round(target * current.totalSteps)
      return replayLife({
        seed: current.seed,
        history: current.history,
        durationSeconds: current.durationSeconds,
        step,
      })
    })
    setPlaying(resume)
  }, [])

  return {
    life,
    playing,
    togglePlaying,
    restart,
    changeSeed,
    addStimulus,
    seekToAge,
  }
}
