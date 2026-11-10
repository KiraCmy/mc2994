/**
 * Exp07 kin — React binding for the Exp04 population sim, habitat edition.
 *
 * Same contract as finalForm/usePopulationSim (positions in a ref every frame,
 * Life snapshots synced at a low, staggered rate), with two habitat changes:
 *  - livelier motion (KIN_SIM_OPTIONS);
 *  - every body ages on its own clock (kinTempo: lifespan per individual and
 *    per generation). The sim's own ageing is held (frozen) and replaced by
 *    ageKin; the sim still handles dissolve → re-birth at end of life.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { replayLife, runLifeSteps, setLifeTurbulence } from '../../worldv2/life/lifeEngine.js'
import {
  createPopulation,
  POPULATION_DT,
  POPULATION_ENV_DEFAULTS,
  setPopulationEnvironment,
  stageForAge,
  stepPopulation,
} from '../finalForm/populationSim.js'
import { ageKin, KIN_HOLD_AGE, KIN_SIM_OPTIONS } from './habitatKin.js'

const LIFE_AGE_EPSILON = 0.01
const UI_INTERVAL = 0.2
const LIVES_PER_TICK = 2

function withTurbulence(life, env) {
  const turbulence = env?.turbulence ?? POPULATION_ENV_DEFAULTS.turbulence
  if (Math.abs((life?.environment?.turbulence ?? 0) - turbulence) < 1e-4) return life
  return setLifeTurbulence(life, turbulence)
}

function lifeEnvironment(env) {
  const moisture = env?.moisture ?? POPULATION_ENV_DEFAULTS.moisture
  return { ...env, moisture: Math.round(moisture * 20) / 20 }
}

function lifeAtAge(seed, age, env) {
  const moisture = env?.moisture ?? POPULATION_ENV_DEFAULTS.moisture
  const base = replayLife({
    seed,
    history: [],
    environmentHistory: [{ step: 0, moisture, turbulence: 0 }],
    step: 0,
  })
  const step = Math.round(Math.min(0.999, Math.max(0, age)) * base.totalSteps)
  return withTurbulence(step > 0 ? runLifeSteps(base, step) : base, env)
}

function advanceLife(life, age) {
  const target = Math.round(Math.min(0.999, Math.max(0, age)) * life.totalSteps)
  if (target <= life.step) return life
  return runLifeSteps(life, target - life.step)
}

function buildPopulation(count, environment, initialAges = null) {
  const pop = setPopulationEnvironment(createPopulation({ count, seed: 1, options: KIN_SIM_OPTIONS }), environment)
  /* AGE is driven per individual by ageKin, not by the shared sim rate. */
  return {
    ...pop,
    organisms: pop.organisms.map((o) => {
      const age = initialAges?.[o.id]
      return Number.isFinite(age) ? { ...o, age, stage: stageForAge(age), frozen: true } : { ...o, frozen: true }
    }),
  }
}

/**
 * `controlRef.current` (optional): { hold: Set<id>, release: Set<id> } —
 * a held life stops just before its end (so its death can be witnessed);
 * a released one ends now and is born again by the sim.
 */
export function useHabitatKin({ count = 6, playing = true, environment = POPULATION_ENV_DEFAULTS, controlRef = null, initialAges = null } = {}) {
  const optsRef = useRef(null)
  optsRef.current = { playing, environment }
  const popRef = useRef(null)
  if (popRef.current == null) popRef.current = buildPopulation(count, environment, initialAges)

  const livesRef = useRef(new Map())
  const initialLives = useMemo(() => {
    const map = {}
    const env = lifeEnvironment(optsRef.current.environment)
    for (const org of popRef.current.organisms) {
      const life = lifeAtAge(org.seed, org.age, env)
      livesRef.current.set(org.id, { seed: org.seed, moisture: env.moisture, life })
      map[org.id] = life
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [snapshot, setSnapshot] = useState(() => popRef.current)
  const [lives, setLives] = useState(initialLives)

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let uiAccum = 0
    let ageAccum = 0
    let cursor = 0
    const tick = (now) => {
      const elapsed = Math.min(0.1, (now - last) / 1000)
      last = now
      const o = optsRef.current
      let pop = popRef.current
      const rawEnv = o.environment
      if (
        pop.environment.temperature !== rawEnv.temperature ||
        pop.environment.moisture !== rawEnv.moisture ||
        pop.environment.turbulence !== rawEnv.turbulence
      ) {
        pop = setPopulationEnvironment(pop, rawEnv)
      }
      /* The viewer dragged a life's growth bar: put it at that age (back to
         life if it had ended). */
      const ageControl = controlRef?.current?.setAge
      if (ageControl?.size) {
        for (const org of pop.organisms) {
          if (!ageControl.has(org.id)) continue
          const a = Math.max(0, Math.min(KIN_HOLD_AGE - 1e-3, Number(ageControl.get(org.id)) || 0))
          org.age = a
          org.ended = false
          org.stage = stageForAge(a)
        }
        ageControl.clear()
      }
      if (o.playing) {
        const before = pop.step
        pop = stepPopulation(pop, elapsed + ageAccum, 6)
        const steps = pop.step - before
        ageAccum = Math.min(POPULATION_DT, elapsed + ageAccum - steps * POPULATION_DT)
        if (steps > 0) {
          const dt = steps * POPULATION_DT
          const control = controlRef?.current
          for (const org of pop.organisms) {
            if (control?.release?.has(org.id) || (org.ended && !control?.hold?.has(org.id))) {
              /* End now: the sim dissolves it and a new bud is born. */
              control?.release?.delete(org.id)
              org.ended = false
              org.age = 1
            } else if (!org.ended) {
              ageKin(org, dt, pop.environment)
              if (control?.hold?.has(org.id) && org.age >= KIN_HOLD_AGE) {
                org.age = KIN_HOLD_AGE
                org.ended = true
              }
            }
            org.stage = stageForAge(org.age)
          }
        }
      }
      popRef.current = pop

      uiAccum += elapsed
      if (uiAccum >= UI_INTERVAL) {
        uiAccum = 0
        const env = lifeEnvironment(rawEnv)
        const updates = {}
        const orgs = pop.organisms
        let budget = LIVES_PER_TICK
        for (let k = 0; k < orgs.length && budget > 0; k += 1) {
          const org = orgs[(cursor + k) % orgs.length]
          const entry = livesRef.current.get(org.id)
          if (!entry || entry.seed !== org.seed || entry.moisture !== env.moisture || entry.life.age > org.age + 1e-6) {
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
        if (Object.keys(updates).length > 0) setLives((prev) => ({ ...prev, ...updates }))
        setSnapshot(pop)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return { popRef, snapshot, lives }
}
