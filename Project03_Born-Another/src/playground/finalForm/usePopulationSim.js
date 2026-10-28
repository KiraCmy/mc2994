/**
 * Experiment 04 Population — React binding for populationSim.
 *
 * - Positions advance every animation frame in a ref (no React re-render);
 *   the scene reads `popRef` inside useFrame.
 * - React state is refreshed at a low rate for the panel and for each
 *   organism's Life snapshot. Life snapshots follow the organism's AGE via the
 *   Life Engine (replay on (re)birth, incremental steps afterwards), at most
 *   two bodies per tick so CPU membrane re-morphs are staggered.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  replayLife,
  runLifeSteps,
  setLifeTurbulence,
} from '../../worldv2/life/lifeEngine.js'
import {
  createPopulation,
  POPULATION_DEFAULT_COUNT,
  POPULATION_ENV_DEFAULTS,
  setOrganismTraits,
  setPopulationEnvironment,
  setPopulationFlags,
  stepPopulation,
} from './populationSim.js'

/** Re-sync a body's Life when its AGE moved by at least this much. */
const LIFE_AGE_EPSILON = 0.004
const UI_INTERVAL = 0.2
const LIVES_PER_TICK = 2

/**
 * Life snapshot for (seed, AGE) grown from birth under the medium's Moisture
 * (same "from-birth rebuild" contract as the single-organism lab), with the
 * current Turbulence applied as the immediate, reversible membrane field.
 */
function lifeAtAge(seed, age, env) {
  const moisture = env?.moisture ?? POPULATION_ENV_DEFAULTS.moisture
  const base = replayLife({
    seed,
    history: [],
    environmentHistory: [{ step: 0, moisture, turbulence: 0 }],
    step: 0,
  })
  const step = Math.round(Math.min(0.999, Math.max(0, age)) * base.totalSteps)
  const grown = step > 0 ? runLifeSteps(base, step) : base
  return withTurbulence(grown, env)
}

/** Moisture used for Life replays, quantised so slider drags don't thrash. */
function lifeEnvironment(env) {
  const moisture = env?.moisture ?? POPULATION_ENV_DEFAULTS.moisture
  return { ...env, moisture: Math.round(moisture * 20) / 20 }
}

function withTurbulence(life, env) {
  const turbulence = env?.turbulence ?? POPULATION_ENV_DEFAULTS.turbulence
  if (Math.abs((life?.environment?.turbulence ?? 0) - turbulence) < 1e-4) return life
  return setLifeTurbulence(life, turbulence)
}

function advanceLife(life, age) {
  const target = Math.round(Math.min(0.999, Math.max(0, age)) * life.totalSteps)
  if (target <= life.step) return life
  return runLifeSteps(life, target - life.step)
}

/**
 * @param {{
 *   count?: number,
 *   playing?: boolean,
 *   timeScale?: number,
 *   behaviours?: boolean,
 *   exchange?: boolean,
 *   lifecycle?: boolean,
 *   environment?: { temperature: number, moisture: number, turbulence: number },
 * }} opts
 */
export function usePopulationSim({
  count = POPULATION_DEFAULT_COUNT,
  playing = true,
  timeScale = 1,
  behaviours = true,
  exchange = true,
  lifecycle = true,
  environment = POPULATION_ENV_DEFAULTS,
} = {}) {
  const popRef = useRef(null)
  const optsRef = useRef(null)
  optsRef.current = {
    playing,
    timeScale,
    behaviours,
    exchange,
    lifecycle,
    environment,
  }

  const build = useCallback(
    (n) =>
      setPopulationEnvironment(
        setPopulationFlags(createPopulation({ count: n, seed: 1 }), {
          behaviours: optsRef.current.behaviours,
          exchange: optsRef.current.exchange,
          lifecycle: optsRef.current.lifecycle,
        }),
        optsRef.current.environment,
      ),
    [],
  )

  if (popRef.current == null) popRef.current = build(count)

  /* id → { seed, life } */
  const livesRef = useRef(new Map())
  const initialLives = useMemo(() => {
    const map = {}
    for (const org of popRef.current.organisms) {
      const env = lifeEnvironment(optsRef.current.environment)
      const life = lifeAtAge(org.seed, org.age, env)
      livesRef.current.set(org.id, { seed: org.seed, moisture: env.moisture, life })
      map[org.id] = life
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [snapshot, setSnapshot] = useState(() => popRef.current)
  const [lives, setLives] = useState(initialLives)

  /* Rebuild on count change. */
  const firstCount = useRef(true)
  useEffect(() => {
    if (firstCount.current) {
      firstCount.current = false
      return
    }
    const next = build(count)
    popRef.current = next
    const map = {}
    livesRef.current = new Map()
    for (const org of next.organisms) {
      const env = lifeEnvironment(optsRef.current.environment)
      const life = lifeAtAge(org.seed, org.age, env)
      livesRef.current.set(org.id, { seed: org.seed, moisture: env.moisture, life })
      map[org.id] = life
    }
    setLives(map)
    setSnapshot(next)
  }, [count, build])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let uiAccum = 0
    let cursor = 0

    const tick = (now) => {
      const elapsed = Math.min(0.1, (now - last) / 1000)
      last = now
      const o = optsRef.current
      let pop = popRef.current
      if (
        pop.behaviours !== o.behaviours ||
        pop.exchange !== o.exchange ||
        pop.lifecycle !== o.lifecycle
      ) {
        pop = setPopulationFlags(pop, o)
      }
      const rawEnv = o.environment
      if (
        pop.environment.temperature !== rawEnv.temperature ||
        pop.environment.moisture !== rawEnv.moisture ||
        pop.environment.turbulence !== rawEnv.turbulence
      ) {
        pop = setPopulationEnvironment(pop, rawEnv)
      }
      const env = lifeEnvironment(rawEnv)
      if (o.playing && o.timeScale > 0) {
        pop = stepPopulation(pop, elapsed * o.timeScale, 6)
      }
      popRef.current = pop

      uiAccum += elapsed
      if (uiAccum >= UI_INTERVAL) {
        uiAccum = 0
        /* Staggered Life sync: rebirths first, then the stalest AGE. */
        const updates = {}
        const orgs = pop.organisms
        let budget = LIVES_PER_TICK
        for (let k = 0; k < orgs.length && budget > 0; k += 1) {
          const org = orgs[(cursor + k) % orgs.length]
          const entry = livesRef.current.get(org.id)
          if (
            !entry ||
            entry.seed !== org.seed ||
            entry.moisture !== env.moisture ||
            entry.life.age > org.age + 1e-6
          ) {
            /* (Re)birth, reseed, AGE moved back, or Moisture changed. */
            const life = lifeAtAge(org.seed, org.age, env)
            livesRef.current.set(org.id, { seed: org.seed, moisture: env.moisture, life })
            updates[org.id] = life
            budget -= 1
          } else if (org.age - entry.life.age >= LIFE_AGE_EPSILON) {
            const life = withTurbulence(advanceLife(entry.life, org.age), env)
            livesRef.current.set(org.id, { ...entry, life })
            updates[org.id] = life
            budget -= 1
          }
        }
        /* Turbulence is immediate + cheap: apply to every body this tick. */
        for (const org of orgs) {
          const entry = livesRef.current.get(org.id)
          if (!entry || updates[org.id]) continue
          const life = withTurbulence(entry.life, env)
          if (life !== entry.life) {
            livesRef.current.set(org.id, { ...entry, life })
            updates[org.id] = life
          }
        }
        cursor = (cursor + 1) % Math.max(1, orgs.length)
        if (Object.keys(updates).length > 0) {
          setLives((prev) => ({ ...prev, ...updates }))
        }
        setSnapshot(pop)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const reset = useCallback(() => {
    const next = build(popRef.current?.organisms.length ?? count)
    popRef.current = next
    const map = {}
    livesRef.current = new Map()
    for (const org of next.organisms) {
      const env = lifeEnvironment(optsRef.current.environment)
      const life = lifeAtAge(org.seed, org.age, env)
      livesRef.current.set(org.id, { seed: org.seed, moisture: env.moisture, life })
      map[org.id] = life
    }
    setLives(map)
    setSnapshot(next)
  }, [build, count])

  /** Panel edits for one organism (shape / AGE / freeze / reseed). */
  const setTraits = useCallback((id, patch) => {
    const next = setOrganismTraits(popRef.current, id, patch)
    popRef.current = next
    const org = next.organisms.find((o) => o.id === id)
    const entry = livesRef.current.get(id)
    const env = lifeEnvironment(optsRef.current.environment)
    if (
      org &&
      (!entry ||
        entry.seed !== org.seed ||
        Math.abs(entry.life.age - org.age) > LIFE_AGE_EPSILON)
    ) {
      /* AGE / seed edits re-grow this body immediately (not staggered). */
      const life =
        entry && entry.seed === org.seed && org.age > entry.life.age
          ? withTurbulence(advanceLife(entry.life, org.age), env)
          : lifeAtAge(org.seed, org.age, env)
      livesRef.current.set(id, { seed: org.seed, moisture: env.moisture, life })
      setLives((prev) => ({ ...prev, [id]: life }))
    }
    setSnapshot(next)
  }, [])

  return { popRef, snapshot, lives, reset, setTraits }
}
