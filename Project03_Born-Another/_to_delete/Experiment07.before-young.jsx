import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLifeEngine } from '../worldv2/life/useLifeEngine.js'
import HabitatScene from './finalHabitat/HabitatScene.jsx'
import FossilReveal from './finalHabitat/FossilReveal.jsx'
import { fossilForBody, fossilForSpecies } from './finalHabitat/habitatFossil.js'
import { ENTRANCE_LINES, HERO_HOME, INITIAL_SPECIES, pickHome, speciesFor } from './finalHabitat/worldOpening.js'
import { freshRemainsPoints } from './finalHabitat/Remains.jsx'
import ArchiveDrawer from './finalHabitat/ArchiveDrawer.jsx'
import { createSpecimen, loadArchive, removeSpecimen, saveSpecimen } from './finalHabitat/archive.js'
import { createLifeLog, lifeEntry, logWords, sampleLife, SAMPLE_EVERY, setStage, summarizeLife } from './finalHabitat/lifeLog.js'
import {
  CRYSTAL_PRESETS,
  crystallizationState,
  crystallizationTarget,
  stepCrystallization,
} from './crystalForm/crystallization.js'
import { interpretExpression } from './languageAsEnvironment/interpretClient.js'
import {
  composeEnvironment,
  effectFromInterpretation,
  influenceAt,
  influenceLabels,
  pruneEffects,
} from './languageAsEnvironment/languageInfluence.js'
import { EXP05_LIFE_SEED } from './finalForm/exploreLifeAdapter.js'
import { kinCrystalLevel } from './finalHabitat/habitatKin.js'
import './finalHabitat/habitat.css'

const START_AGE = 0.64
const START_ENV = { temperature: 0.38, moisture: 0.68, turbulence: 0.12 }
const HISTORY = 56
/** Real-time ageing of the hero: START_AGE → end of life in ~2.5 minutes. */
const HERO_AGE_RATE = (1 - START_AGE) / 150
/** World Final opens held, then grows through the rest of its life in ~50s. */
const OPENING_HOLD_MS = 2200
const OPENING_GROW_RATE = (1 - START_AGE) / 50
/** World Final: the hero is met mid-life and ends ~2.5 min after arrival. */
const WORLD_START_AGE = 0.42
const WORLD_AGE_RATE = (1 - WORLD_START_AGE) / 150
/** An unwitnessed hero rests as a husk this long, then a new life begins. */
const UNWITNESSED_REBIRTH_MS = 8000
/** A new life starts young. */
const REBORN_AGE = 0.2
/** Seconds after death until the remains are identified. */
const REVEAL_AFTER = 6.5

function clamp01(v) {
  return Math.min(1, Math.max(0, Number(v) || 0))
}

/**
 * One environment slider. `influence` is how far the language effects have
 * moved it from its manual base: shown as a cyan span (base → current) on
 * the track and a signed delta beside the value.
 */
function EnvRow({ id, label, value, onChange, influence = 0 }) {
  const moved = Math.abs(influence) >= 0.01
  const base = Math.min(1, Math.max(0, value - influence))
  const from = Math.min(base, value) * 100
  const span = Math.abs(value - base) * 100
  return (
    <label className={`exp07-env__row${moved ? ' is-moved' : ''}`} htmlFor={id}>
      <span className="exp07-env__head">
        <span>{label}</span>
        <span className="exp07-env__value">
          {moved ? (
            <em className="exp07-env__delta" title={`Your words moved it from ${base.toFixed(2)}`}>
              {influence > 0 ? '+' : '−'}
              {Math.abs(influence).toFixed(2)}
            </em>
          ) : null}
          {value.toFixed(2)}
        </span>
      </span>
      <span className="exp07-env__track">
        {moved ? (
          <span className="exp07-env__influence" aria-hidden="true" style={{ left: `${from}%`, width: `${span}%` }}>
            <i style={{ left: base < value ? '0%' : '100%' }} />
          </span>
        ) : null}
      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        aria-valuetext={`${label} ${value.toFixed(2)}${moved ? `, moved ${influence > 0 ? 'up' : 'down'} ${Math.abs(influence).toFixed(2)} by your words` : ''}`}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      </span>
    </label>
  )
}

function LifeGraph({ history, state }) {
  const w = 200
  const h = 44
  const points = history.map((v, i) => [
    (i / Math.max(1, HISTORY - 1)) * w,
    h - 6 - v * (h - 12),
  ])
  const d = points
    .map(([x, y], i) => {
      if (i === 0) return `M${x.toFixed(1)} ${y.toFixed(1)}`
      const [px, py] = points[i - 1]
      const cx = ((px + x) / 2).toFixed(1)
      return `Q${px.toFixed(1)} ${py.toFixed(1)} ${cx} ${((py + y) / 2).toFixed(1)}`
    })
    .join(' ')
  const last = points[points.length - 1] ?? [0, h - 6]
  return (
    <div className="exp07-life">
      <div className="exp07-life__head">
        <span>Life</span>
        <span>{state}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`Crystallization over the last minute, now ${state}`}>
        <path d={`${d} L${last[0].toFixed(1)} ${h} L0 ${h} Z`} className="exp07-life__area" />
        <path d={d} className="exp07-life__line" />
        <circle cx={last[0]} cy={last[1]} r="2.6" className="exp07-life__dot" />
      </svg>
    </div>
  )
}

/**
 * Experiment 07 — Final Habitat
 * The reference environment: the Final Form organism resting on a misty
 * forest floor, crystallizing as part of its form. Language, sliders and
 * presets all write the same shared medium.
 */
function createWorld() {
  return {
    phase: 'descent',
    focusId: null,
    hoverId: null,
    bodies: new Map(),
    kinInfo: new Map(),
    kinControl: null,
    dimming: { id: null, dusk: 0 },
    opening: { t: 0, skip: false, skipping: null, haze: 1, depth: 1, veil: 1 },
  }
}

/** A few slow specks — the sense of sinking, not a particle system. */
const ENTRANCE_MOTES = Object.freeze([
  [7, 18, 2], [16, 22, 6], [24, 16, 1], [33, 20, 9],
  [41, 17, 4], [49, 24, 0], [58, 19, 7], [66, 21, 3],
  [74, 15, 8], [82, 23, 5], [90, 18, 2], [38, 26, 11],
])

function EntranceVeil() {
  return (
    <div className="exp07-entrance" aria-hidden="true">
      <div className="exp07-entrance__wash">
        {ENTRANCE_MOTES.map(([left, duration, delay]) => (
          <span
            key={left}
            className="exp07-entrance__mote"
            style={{ left: `${left}%`, animationDuration: `${duration}s`, animationDelay: `-${delay}s` }}
          />
        ))}
      </div>
      <div className="exp07-entrance__night" />
      {ENTRANCE_LINES.map((line, i) => (
        <p key={line.text} className="exp07-entrance__line" style={{ opacity: `var(--exp07-p${i}, 0)` }}>
          {line.text}
        </p>
      ))}
    </div>
  )
}

/**
 * "Tell it something" field. Keeps its own text state so typing re-renders
 * only this form, not the whole page (the 3D scene sits beside it).
 */
function SayForm({ reply, onSend }) {
  const [message, setMessage] = useState('')
  const onSubmit = (event) => {
    event.preventDefault()
    if (onSend(message)) setMessage('')
  }
  return (
    <form className="exp07-say" onSubmit={onSubmit}>
      {reply ? (
        <p className={`exp07-say__reply is-${reply.tone}`} role="status" title={reply.source}>
          {reply.text}
          {reply.source ? <span className="exp07-say__source">via {reply.source}</span> : null}
        </p>
      ) : null}
      <div className="exp07-say__field">
        <svg className="exp07-say__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />
        </svg>
        <label htmlFor="exp07-say-input" className="exp07-sr">Tell the organism something about its environment</label>
        <input
          id="exp07-say-input"
          type="text"
          autoComplete="off"
          placeholder="Tell it something…"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <button type="submit" aria-label="Send">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12L20 4l-6 16-2.5-6.5L4 12z" />
          </svg>
        </button>
      </div>
    </form>
  )
}

export default function Experiment07({ title, description, autoGrow = false, opening = false, active = true, onRestart = null }) {
  const { life, seekToAge, setPlaying, setMoisture, setMoistureAtStep, setTurbulence, changeSeed } = useLifeEngine(EXP05_LIFE_SEED)
  const vignetteRef = useRef(null)
  const [revealed, setRevealed] = useState(false)
  const [lingering, setLingering] = useState(false)
  const dead = Boolean(life.dead)
  const articleRef = useRef(null)
  const [temperature, setTemperature] = useState(START_ENV.temperature)
  const [running, setRunning] = useState(opening || !autoGrow)
  /* World Final opening experience: descent → discovery → encounter → focus.
     Per-frame state lives in worldRef; React hears phase / focus / hover. */
  const worldRef = useRef(null)
  if (opening && !worldRef.current) {
    worldRef.current = createWorld()
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      worldRef.current.opening.reduced = true
    }
  }
  if (worldRef.current && !worldRef.current.anchors) worldRef.current.anchors = new Map([['hero', HERO_HOME]])
  const [phase, setPhase] = useState(opening ? 'descent' : 'lab')
  const [focusId, setFocusId] = useState(null)
  const [hovering, setHovering] = useState(false)
  const [kinView, setKinView] = useState(null)
  /* World Final lineage of the hero slot: each new life is born somewhere
     new, possibly as another species. */
  const [heroLine, setHeroLine] = useState({ generation: 0, home: HERO_HOME, species: INITIAL_SPECIES.hero })
  /* The viewer's archive of kept remains (this browser). */
  const [archive, setArchive] = useState(() => loadArchive())
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [savedKey, setSavedKey] = useState(null)
  /* World Final: each life's story while it lives (for its archive record). */
  const logRef = useRef(null)
  if (!logRef.current) logRef.current = createLifeLog()
  const focusKin = Boolean(focusId && focusId !== 'hero')
  const focusKinRef = useRef(focusKin)
  focusKinRef.current = focusKin
  const runTouchedRef = useRef(false)
  const [reply, setReply] = useState(null)
  const [layersOpen, setLayersOpen] = useState(false)
  const [layers, setLayers] = useState({
    crystals: true,
    petals: true,
    frost: true,
    fibres: true,
    outcrops: true,
    veils: true,
    splashes: true,
    flora: true,
    kin: true,
    bloom: true,
  })
  const [readout, setReadout] = useState({ level: 0.42, rate: 0, target: 0 })
  const [history, setHistory] = useState(() => Array(HISTORY).fill(0.42))
  const [fullscreen, setFullscreen] = useState(false)

  const moisture = life.environment?.moisture ?? 0.5
  const turbulence = life.environment?.turbulence ?? 0

  const crystalRef = useRef({ level: 0.42, rate: 0, target: 0 })
  const envRef = useRef({ temperature, moisture, turbulence })
  envRef.current = { temperature, moisture, turbulence }
  /* Manual base of the water, and the live language effects on top of it. */
  const baseEnvRef = useRef({ ...START_ENV })
  const effectsRef = useRef([])
  /* How far the words currently move each channel (for the sliders). */
  const [langInfluence, setLangInfluence] = useState({ temperature: 0, moisture: 0, turbulence: 0 })
  const timeRef = useRef(0)
  /* Hidden (another page is open): the world pauses exactly as it is. */
  const runningRef = useRef(running)
  runningRef.current = running && active
  const activeRef = useRef(active)
  activeRef.current = active
  const [confirmRestart, setConfirmRestart] = useState(false)
  useEffect(() => {
    if (!confirmRestart) return undefined
    const id = window.setTimeout(() => setConfirmRestart(false), 3500)
    return () => window.clearTimeout(id)
  }, [confirmRestart])
  const ageRateRef = useRef(HERO_AGE_RATE)
  ageRateRef.current = opening ? WORLD_AGE_RATE : autoGrow ? OPENING_GROW_RATE : HERO_AGE_RATE

  /* World Final: hold the opening pose, then grow without a slider drag.
     A click on Real time (or Space) before then keeps the user's choice. */
  useEffect(() => {
    if (!autoGrow || opening) return undefined
    const id = window.setTimeout(() => {
      if (!runTouchedRef.current) setRunning(true)
    }, OPENING_HOLD_MS)
    return () => window.clearTimeout(id)
  }, [autoGrow, opening])

  useEffect(() => {
    seekToAge(opening ? WORLD_START_AGE : START_AGE, { resume: false })
    setPlaying(false)
    setMoisture(START_ENV.moisture)
    setTurbulence(START_ENV.turbulence)
    return () => setPlaying(false)
    // Mount-only: park the organism at the reference AGE and medium.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* Crystallization follows the medium in real time. */
  useEffect(() => {
    let frame = 0
    let previous = performance.now()
    let lastUi = 0
    let lastSample = 0
    const tick = (now) => {
      const dt = runningRef.current ? Math.min(0.05, (now - previous) / 1000) : 0
      previous = now
      const state = crystalRef.current
      const env = envRef.current
      const target = crystallizationTarget(env)
      const prev = state.level
      state.level = stepCrystallization(prev, target, { turbulence: env.turbulence, moisture: env.moisture, dt })
      state.target = target
      state.rate = dt > 0 ? (state.level - prev) / dt : 0
      if (now - lastUi > 150) {
        lastUi = now
        setReadout({ level: state.level, rate: state.rate, target })
      }
      if (runningRef.current && now - lastSample > 600 && !focusKinRef.current) {
        lastSample = now
        setHistory((h) => h.slice(1).concat(state.level))
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  /* The hero lives in real time: AGE advances while Real time is on, and the
     life ends (withers → husk) when it reaches 1. Synced to the engine at a
     low rate (each sync replays the life deterministically). */
  const heroAgeRef = useRef(opening ? WORLD_START_AGE : START_AGE)
  const deadRef = useRef(dead)
  deadRef.current = dead
  /* Which life is which in the log: a slot, its generation and its seed. */
  const heroKeyRef = useRef('')
  heroKeyRef.current = `hero-${heroLine.generation}-${life.seed}`
  const lifeKeyFor = useCallback((id) => {
    if (!id || id === 'hero') return heroKeyRef.current
    const info = worldRef.current?.kinInfo.get(id)
    return info ? `${id}-${info.generation}-${info.seed}` : id
  }, [])
  useEffect(() => {
    const age = life.age
    /* Follow a slider jump. Ignore the tiny step a replay quantizes backwards,
       or the clock stalls on the same hundredth. */
    if (Math.abs(age - heroAgeRef.current) > 0.02 || age > heroAgeRef.current) {
      heroAgeRef.current = age
    }
  }, [life.age])
  useEffect(() => {
    let frame = 0
    let previous = performance.now()
    let lastSeek = 0
    let sought = heroAgeRef.current
    const tick = (now) => {
      const dt = Math.min(0.1, (now - previous) / 1000)
      previous = now
      /* (World Final: the hero's clock starts once we have arrived.) */
      if (runningRef.current && !deadRef.current && worldRef.current?.phase !== 'descent') {
        heroAgeRef.current = Math.min(1, heroAgeRef.current + dt * ageRateRef.current)
        const next = heroAgeRef.current
        if ((next - sought >= 0.004 && now - lastSeek > 700) || (next >= 1 && sought < 1)) {
          sought = next
          lastSeek = now
          seekToAge(next, { resume: false })
        }
      } else {
        sought = heroAgeRef.current
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [seekToAge])

  /* The life being witnessed: the hero in the lab; the focused one in World Final. */
  const witnessDead = opening ? (focusId === 'hero' ? dead : Boolean(kinView?.ended)) : dead

  /* Death → after the habitat fades, identify the remains. */
  useEffect(() => {
    if (opening && focusKin) return undefined
    if (!dead || (opening && focusId !== 'hero')) {
      setRevealed(false)
      setLingering(false)
      return undefined
    }
    const id = window.setTimeout(() => setRevealed(true), REVEAL_AFTER * 1000)
    return () => window.clearTimeout(id)
  }, [dead, opening, focusId, focusKin])

  /* A focused kin's end: reveal once the world has dimmed around it. */
  useEffect(() => {
    if (!opening || !focusKin) return
    if (!kinView?.ended) {
      setRevealed(false)
      setLingering(false)
    } else if (kinView.deathT >= REVEAL_AFTER) {
      setRevealed(true)
    }
  }, [opening, focusKin, kinView])

  const bornAnotherHero = useCallback(() => {
    const seed = 1000 + Math.floor(Math.random() * 98000)
    const w = worldRef.current
    if (w) {
      /* What is left settles on the seabed; a new life is born elsewhere. */
      w.capture?.('hero')
      setHeroLine((line) => {
        const generation = line.generation + 1
        const occupied = [...(w.anchors?.entries() ?? [])].filter(([id]) => id !== 'hero').map(([, a]) => a)
        occupied.push(...freshRemainsPoints(worldRef), line.home)
        const home = pickHome('hero', generation, seed, occupied)
        w.anchors?.set('hero', home)
        return { generation, home, species: speciesFor('hero', generation, seed) }
      })
    }
    changeSeed(seed)
    seekToAge(REBORN_AGE, { resume: false })
    setMoisture(moisture)
    setTurbulence(turbulence)
    heroAgeRef.current = REBORN_AGE
  }, [changeSeed, seekToAge, setMoisture, setTurbulence, moisture, turbulence])

  const bornAnother = useCallback(() => {
    if (opening && focusKin) {
      /* Its remains settle on the seabed; a new life is born elsewhere. */
      worldRef.current?.settle?.(focusId)
    } else {
      bornAnotherHero()
    }
    setRevealed(false)
    setLingering(false)
  }, [opening, focusKin, focusId, bornAnotherHero])

  /* World Final: a hero that dies unwitnessed rests as a husk, then is born again. */
  useEffect(() => {
    if (!opening || !dead || focusId === 'hero') return undefined
    const id = window.setTimeout(bornAnotherHero, UNWITNESSED_REBIRTH_MS)
    return () => window.clearTimeout(id)
  }, [opening, dead, focusId, bornAnotherHero])

  /* World Final interactions (called from inside the canvas). */
  const selectLife = useCallback((id) => {
    const w = worldRef.current
    if (!w || w.phase === 'descent' || w.focusId === id) return
    w.focusId = id
    setFocusId(id)
    setRevealed(false)
    setLingering(false)
  }, [])
  const exitFocus = useCallback(() => {
    const w = worldRef.current
    if (!w || !w.focusId) return
    w.focusId = null
    setFocusId(null)
    setRevealed(false)
    setLingering(false)
  }, [])
  if (worldRef.current) {
    const w = worldRef.current
    w.select = selectLife
    w.exitFocus = exitFocus
    w.onPhase = setPhase
    w.setHover = (id) => {
      if (w.phase === 'descent') return
      w.hoverId = id
      setHovering(true)
    }
    w.clearHover = (id) => {
      if (w.hoverId !== id) return
      w.hoverId = null
      setHovering(false)
    }
  }

  /* Back on the hero: its graph is the medium's crystallization again. */
  useEffect(() => {
    if (focusId === 'hero') setHistory(Array(HISTORY).fill(crystalRef.current.level))
  }, [focusId])

  /* Focused kin: read its life from the habitat a few times a second. */
  useEffect(() => {
    if (!opening || !focusKin) {
      setKinView(null)
      return undefined
    }
    let lastSample = 0
    const read = () => {
      const info = worldRef.current?.kinInfo.get(focusId)
      if (!info) return
      setKinView({ age: info.age, level: info.level, ended: info.ended, deathT: info.deathT, stage: info.stage })
      const now = performance.now()
      if (now - lastSample > 600) {
        lastSample = now
        setHistory((h) => h.slice(1).concat(info.level))
      }
    }
    const first = worldRef.current?.kinInfo.get(focusId)
    if (first) setHistory(Array(HISTORY).fill(first.level))
    read()
    const id = window.setInterval(read, 250)
    return () => window.clearInterval(id)
  }, [opening, focusKin, focusId])

  /* World Final: once a second, note how every life is doing; while a life
     is observed, keep a picture of it when first seen and when it starts to
     crystallize. */
  useEffect(() => {
    if (!opening) return undefined
    const pending = new Set()
    const capture = (id, key, now, stage) => {
      const tag = `${key}:${stage}`
      if (pending.has(tag)) return
      pending.add(tag)
      worldRef.current?.requestSnapshot?.(id, 240).then((image) => {
        if (image) setStage(logRef.current, key, now, stage, image)
        else pending.delete(tag)
      })
    }
    const tick = () => {
      const w = worldRef.current
      if (!w || w.phase === 'descent') return
      const now = performance.now() / 1000
      const log = logRef.current
      const env = envRef.current
      const entries = [['hero', heroKeyRef.current, crystalRef.current.level, deadRef.current]]
      for (const [id, info] of w.kinInfo) entries.push([id, `${id}-${info.generation}-${info.seed}`, info.level, info.ended])
      for (const [id, key, level, ended] of entries) {
        const watched = w.focusId === id
        const entry = sampleLife(log, key, now, { level, env, watched, ended, dt: SAMPLE_EVERY })
        if (watched && entry.endedAt == null) {
          if (!entry.stages.first && entry.watched >= 3) capture(id, key, now, 'first')
          if (!entry.stages.crystallizing && level >= 0.55) capture(id, key, now, 'crystallizing')
        }
      }
    }
    const id = window.setInterval(tick, SAMPLE_EVERY * 1000)
    return () => window.clearInterval(id)
  }, [opening])

  /* Esc: skip the descent, or return from observing to free exploration. */
  useEffect(() => {
    if (!opening) return undefined
    const onKey = (event) => {
      if (event.key !== 'Escape' || !activeRef.current) return
      const w = worldRef.current
      if (w?.phase === 'descent') w.opening.skip = true
      else exitFocus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [opening, exitFocus])

  useEffect(() => {
    const onKey = (event) => {
      if (event.code !== 'Space' || !activeRef.current) return
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || event.target?.isContentEditable) return
      event.preventDefault()
      runTouchedRef.current = true
      setRunning((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === articleRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    if (!reply) return undefined
    const id = window.setTimeout(() => setReply(null), 6500)
    return () => window.clearTimeout(id)
  }, [reply])

  /* Manual controls (sliders, presets) set the *base* water; language adds a
     bounded, relaxing influence on top (see the loop below). The effective
     value is what the sliders show and what every life receives. */
  const applyEnv = useCallback(
    ({ temperature: t, moisture: m, turbulence: u }) => {
      const infl = influenceAt(effectsRef.current, performance.now() / 1000)
      const base = baseEnvRef.current
      if (Number.isFinite(t)) {
        base.temperature = clamp01(t - infl.temperature)
        setTemperature(clamp01(t))
      }
      if (Number.isFinite(m)) {
        base.moisture = clamp01(m - infl.moisture)
        setMoisture(clamp01(m))
      }
      if (Number.isFinite(u)) {
        base.turbulence = clamp01(u - infl.turbulence)
        setTurbulence(clamp01(u))
      }
    },
    [setMoisture, setTurbulence],
  )
  const setTemperatureManual = useCallback((v) => applyEnv({ temperature: v }), [applyEnv])
  const setMoistureManual = useCallback((v) => applyEnv({ moisture: v }), [applyEnv])
  const setTurbulenceManual = useCallback((v) => applyEnv({ turbulence: v }), [applyEnv])

  /* Language influence → effective water, a few times a second (smooth,
     bounded, and it relaxes back to the base when the words fade). */
  useEffect(() => {
    let wasActive = false
    const tick = () => {
      const now = performance.now() / 1000
      effectsRef.current = pruneEffects(effectsRef.current, now)
      const active = effectsRef.current.length > 0
      if (!active && !wasActive) return
      wasActive = active
      const infl = influenceAt(effectsRef.current, now)
      const env = composeEnvironment(baseEnvRef.current, infl)
      const cur = envRef.current
      const q = (v) => Math.round(v * 100) / 100
      /* What the sliders show as "moved by your words": effective − base. */
      const shown = {
        temperature: q(q(env.temperature) - baseEnvRef.current.temperature),
        moisture: q(q(env.moisture) - baseEnvRef.current.moisture),
        turbulence: q(q(env.turbulence) - baseEnvRef.current.turbulence),
      }
      setLangInfluence((prev) =>
        prev.temperature === shown.temperature && prev.moisture === shown.moisture && prev.turbulence === shown.turbulence ? prev : shown,
      )
      if (Math.abs(q(env.temperature) - cur.temperature) >= 0.01) setTemperature(q(env.temperature))
      if (Math.abs(q(env.moisture) - cur.moisture) >= 0.01) setMoistureAtStep(q(env.moisture))
      if (Math.abs(q(env.turbulence) - cur.turbulence) >= 0.01) setTurbulence(q(env.turbulence))
    }
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [setMoistureAtStep, setTurbulence])

  /* Free language → interpreter (one request per expression; the world keeps
     running meanwhile) → one bounded effect on the water → life history. */
  const handleSend = useCallback(
    (raw) => {
      const text = raw.trim()
      if (!text) {
        setReply({ tone: 'quiet', text: 'Say anything — a memory, a feeling, the weather.' })
        return false
      }
      const saidAt = performance.now() / 1000
      const envBefore = { ...envRef.current }
      /* AGE of every life at this moment, by its log key. */
      const ages = { [heroKeyRef.current]: Math.round(heroAgeRef.current * 1000) / 1000 }
      for (const [id, info] of worldRef.current?.kinInfo ?? []) ages[`${id}-${info.generation}-${info.seed}`] = Math.round(info.age * 1000) / 1000
      setReply({ tone: 'pending', text: 'The water is listening…' })
      interpretExpression(text).then((interp) => {
        const now = performance.now() / 1000
        const effect = effectFromInterpretation(interp, now)
        if (effect.active) effectsRef.current = [...pruneEffects(effectsRef.current, now), effect]
        logWords(logRef.current, saidAt, {
          text,
          applied: effect.active,
          impulses: { temperature: effect.deltas.temperature, moisture: effect.deltas.moisture, disturbance: effect.deltas.turbulence },
          durationSeconds: effect.duration,
          ages,
          envBefore,
          interpretation: {
            temperatureDelta: interp.temperatureDelta,
            moistureDelta: interp.moistureDelta,
            turbulenceDelta: interp.turbulenceDelta,
            intensity: interp.intensity,
            confidence: interp.confidence,
            durationSeconds: interp.durationSeconds,
            emotionalTone: interp.emotionalTone,
            semanticSummary: interp.semanticSummary,
            provider: interp.meta?.provider ?? null,
            model: interp.meta?.model ?? null,
            fallback: interp.meta?.fallback?.reason ?? null,
          },
        })
        const labels = influenceLabels(effect.deltas)
        setReply({
          tone: effect.active ? 'applied' : 'quiet',
          text: `${interp.semanticSummary}${labels.length ? ` ${labels.join(' · ')}` : ' The water stays as it is.'}`,
          source: `${interp.meta?.provider ?? '?'}${interp.meta?.model ? ` / ${interp.meta.model}` : ''}${interp.meta?.fallback ? ` (fallback: ${interp.meta.fallback.reason})` : ''}`,
        })
      })
      return true
    },
    [],
  )

  const toggleFullscreen = useCallback(() => {
    const el = articleRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    else el.requestFullscreen?.().catch(() => {})
  }, [])

  /* The remains being identified, and keeping them in the archive. */
  const revealSpecies = opening ? worldRef.current?.bodies.get(focusId || 'hero')?.species : null
  const revealFossil = opening ? fossilForSpecies(revealSpecies) : fossilForBody('hero')
  useEffect(() => {
    if (!revealed) setSavedKey(null)
  }, [revealed])
  const saveToArchive = async () => {
    const kin = focusKin ? worldRef.current?.kinInfo.get(focusId) : null
    const id = focusKin ? focusId : 'hero'
    const key = lifeKeyFor(id)
    const now = performance.now() / 1000
    if (opening) lifeEntry(logRef.current, key, now)
    const story = opening ? summarizeLife(logRef.current, key, now) : null
    const image = opening ? await (worldRef.current?.requestSnapshot?.(id, 420) ?? null) : null
    const specimen = createSpecimen({
      story,
      image,
      fossil: revealFossil,
      species: revealSpecies,
      seed: kin ? kin.seed : life.seed,
      generation: kin ? kin.generation : heroLine.generation,
      environment: { temperature, moisture, turbulence },
      crystallization: kin ? kin.level : 1,
    })
    const { list } = saveSpecimen(specimen)
    setArchive(list.length ? list : [specimen, ...archive])
    setSavedKey(specimen.key)
  }

  /* The panel reads the life being observed (World Final: the focused one). */
  const view =
    focusKin && kinView
      ? { level: kinView.level, target: kinCrystalLevel(readout.target, kinView.age), age: kinView.age }
      : { level: readout.level, target: readout.target, age: life.age }
  const stateLabel = focusKin && kinView?.ended ? 'Ending' : crystallizationState(view.level, readout.rate, turbulence)
  const worldClass = opening
    ? ` is-world is-${phase}${focusId ? ' is-focused' : ''}${hovering ? ' is-hovering' : ''}`
    : ''
  const sceneLayers = useMemo(() => layers, [layers])

  return (
    <article
      ref={articleRef}
      className={`playground-experiment playground-experiment--exp05 playground-experiment--exp07${witnessDead ? ' is-ending' : ''}${revealed && !lingering ? ' is-revealed' : ''}${worldClass}`}
    >
      <div className="exp07-immerse">
        <HabitatScene
          life={life}
          crystalRef={crystalRef}
          envRef={envRef}
          timeRef={timeRef}
          runningRef={runningRef}
          active={active}
          temperature={temperature}
          moisture={moisture}
          turbulence={turbulence}
          running={running}
          layers={sceneLayers}
          crystalLevel={Math.round(readout.level * 20) / 20}
          overlayRef={vignetteRef}
          world={opening ? worldRef : null}
          heroHome={heroLine.home}
          heroSpecies={heroLine.species}
          archive={opening ? archive : null}
          className="exp07-viewport"
        />
        <div ref={vignetteRef} className="exp07-vignette" aria-hidden="true" />
        <div className="exp07-dusk" aria-hidden="true" />
        {opening && phase === 'descent' ? <EntranceVeil /> : null}
        {revealed && !lingering ? (
          <FossilReveal
            fossil={revealFossil}
            onBornAnother={bornAnother}
            onLinger={() => setLingering(true)}
            onSave={saveToArchive}
            saved={Boolean(savedKey)}
            onOpenArchive={() => setArchiveOpen(true)}
          />
        ) : null}
        {opening && phase !== 'descent' && !(revealed && !lingering) ? (
          <button type="button" className="exp07-archive-toggle" aria-expanded={archiveOpen} onClick={() => setArchiveOpen((v) => !v)}>
            Archive{archive.length ? ` · ${archive.length}` : ''}
          </button>
        ) : null}
        {opening && onRestart && phase !== 'descent' && !(revealed && !lingering) ? (
          <button
            type="button"
            className={`exp07-restart${confirmRestart ? ' is-confirming' : ''}`}
            onClick={() => (confirmRestart ? onRestart() : setConfirmRestart(true))}
          >
            {confirmRestart ? 'Restart? · click again' : 'Restart the world'}
          </button>
        ) : null}
        {archiveOpen ? (
          <ArchiveDrawer
            entries={archive}
            onClose={() => setArchiveOpen(false)}
            onRemove={(key) => setArchive(removeSpecimen(key))}
          />
        ) : null}
        {witnessDead && lingering ? (
          <button type="button" className="exp07-reborn" onClick={bornAnother}>
            Born another
          </button>
        ) : null}

        {opening && phase === 'descent' ? (
          <button
            type="button"
            className="exp07-skip"
            onClick={() => {
              if (worldRef.current) worldRef.current.opening.skip = true
            }}
          >
            Skip descent
          </button>
        ) : null}
        {opening ? <div className="exp07-brackets" aria-hidden="true"><i /><i /><i /><i /></div> : null}
        {opening && focusId && !witnessDead ? (
          <button type="button" className="exp07-unfocus" onClick={exitFocus}>
            Esc · Return to the water
          </button>
        ) : null}

        <header className="exp07-intro">
          <p className="exp07-intro__eyebrow">{opening ? 'World Final' : title}</p>
          <h1 className="exp07-intro__title">{title}</h1>
          <p className="exp07-intro__desc">{description}</p>
        </header>

        <aside className="exp07-panel" aria-label="Final Habitat controls">
          <LifeGraph history={history} state={stateLabel} />

          <section className="exp07-env" aria-labelledby="exp07-env-label">
            <p id="exp07-env-label" className="exp07-panel__label">Environment</p>
            <EnvRow id="exp07-temperature" label="Temperature" value={temperature} onChange={setTemperatureManual} influence={langInfluence.temperature} />
            <EnvRow id="exp07-moisture" label="Moisture" value={moisture} onChange={setMoistureManual} influence={langInfluence.moisture} />
            <EnvRow id="exp07-turbulence" label="Turbulence" value={turbulence} onChange={setTurbulenceManual} influence={langInfluence.turbulence} />
            {Math.abs(langInfluence.temperature) + Math.abs(langInfluence.moisture) + Math.abs(langInfluence.turbulence) >= 0.01 ? (
              <p className="exp07-env__words" role="status">Your words are moving the water</p>
            ) : null}
            <div className="exp07-presets" role="group" aria-label="Environment presets">
              {CRYSTAL_PRESETS.map((p) => (
                <button key={p.id} type="button" onClick={() => applyEnv(p)}>
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          <section className="exp07-crystal" aria-live="polite">
            <p className="exp07-panel__label">Crystallization</p>
            <div className="exp07-crystal__row">
              <span className="exp07-crystal__value">{view.level.toFixed(2)}</span>
              <span className="exp07-crystal__target">→ {view.target.toFixed(2)}</span>
            </div>
            <div className="exp07-crystal__meter" aria-hidden="true">
              <span style={{ width: `${view.level * 100}%` }} />
              <em style={{ left: `${view.target * 100}%` }} />
            </div>
          </section>

          <button
            type="button"
            className="exp07-panel__more"
            aria-expanded={layersOpen}
            onClick={() => setLayersOpen((v) => !v)}
          >
            {layersOpen ? 'Hide layers' : 'Layers'}
          </button>
          {layersOpen ? (
            <div className="exp07-layers" role="group" aria-label="Layers">
              {[
                ['crystals', 'Crystal lattice'],
                ['petals', 'Petals (Final Form)'],
                ['frost', 'Membrane frost'],
                ['fibres', 'Nucleus fibres'],
                ['outcrops', 'Crystal outcrops'],
                ['veils', 'Terrain veils'],
                ['splashes', 'Splash crowns'],
                ['flora', 'Residue'],
                ['kin', 'Kin (other lives)'],
                ['bloom', 'Bloom'],
              ].map(([key, label]) => (
                <label key={key} className="exp07-layers__item">
                  <input
                    type="checkbox"
                    checked={layers[key]}
                    onChange={() => setLayers((c) => ({ ...c, [key]: !c[key] }))}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          ) : null}
        </aside>

        <SayForm reply={reply} onSend={handleSend} />

        <p className="exp07-keys" aria-hidden="true">
          <span>WASD · Explore</span>
          <span>Q / E · Elevation</span>
          <span>Scroll · Zoom</span>
          <span>Drag · Orbit</span>
          <span>Right-drag · Look</span>
        </p>

        <div className="exp07-foot">
          <label className="exp07-age" htmlFor="exp07-age">
            <span>AGE</span>
            <b>{view.age.toFixed(2)}</b>
            <span>/ Growth</span>
            <input
              id="exp07-age"
              type="range"
              min={0}
              max={1}
              step={0.005}
              value={view.age}
              aria-valuetext={`Age ${view.age.toFixed(2)}`}
              onChange={(event) => {
                const age = Number(event.target.value)
                if (focusKin) {
                  /* Another life: move its own clock (the habitat sim applies it next frame). */
                  worldRef.current?.kinControl?.setAge?.set(focusId, age)
                  setKinView((v) => (v ? { ...v, age, ended: false } : v))
                } else {
                  seekToAge(age, { resume: false })
                }
              }}
            />
          </label>
          <div className="exp07-foot__right">
            <button type="button" className="exp07-realtime" aria-pressed={running} onClick={() => { runTouchedRef.current = true; setRunning((v) => !v) }}>
              <span aria-hidden="true">{running ? '❙❙' : '▶'}</span>
              Real time
            </button>
            <button type="button" className="exp07-fullscreen" aria-label={fullscreen ? 'Exit full screen' : 'Full screen'} onClick={toggleFullscreen}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
