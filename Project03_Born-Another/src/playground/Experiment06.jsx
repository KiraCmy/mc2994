import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLifeEngine } from '../worldv2/life/useLifeEngine.js'
import CrystalLifeScene from './crystalForm/CrystalLifeScene.jsx'
import {
  CRYSTAL_DEFAULTS,
  CRYSTAL_PRESETS,
  crystallizationState,
  crystallizationTarget,
  rimeAmount,
  stepCrystallization,
} from './crystalForm/crystallization.js'
import {
  EXP05_LIFE_SEED,
  EXP05_OBSERVE_AGE,
} from './finalForm/exploreLifeAdapter.js'
import {
  EXP05_LAB_DEFAULTS,
  normalizeExp05LabParams,
} from './finalForm/exp05LabParams.js'
import './crystalForm/exp06.css'

const LAYER_LABELS = [
  ['crystal', 'Crystal lattice'],
  ['rime', 'Rime bloom'],
  ['shards', 'Shard shedding'],
  ['motes', 'Nucleation motes'],
  ['petals', 'Petals (Final Form)'],
  ['orbit', 'Slow orbit'],
]

function EnvSlider({ label, hint, value, onChange }) {
  return (
    <label className="exp05-lab__row">
      <span className="exp05-lab__row-head">
        <span>{label}</span>
        <span className="exp05-lab__value">{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        aria-valuetext={`${label} ${value.toFixed(2)}`}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="exp05-lab__hint">{hint}</span>
    </label>
  )
}

/**
 * Experiment 06 — Crystal Form Lab
 * The Final Form organism crystallizes in response to the shared medium:
 * cold nucleates, moisture feeds rime + lattice mass, turbulence fractures.
 */
export default function Experiment06({ title, description }) {
  const {
    life,
    playing,
    togglePlaying,
    seekToAge,
    setPlaying,
    changeSeed,
    setMoisture,
    setTurbulence,
  } = useLifeEngine(EXP05_LIFE_SEED)

  const [temperature, setTemperature] = useState(CRYSTAL_DEFAULTS.temperature)
  const [manual, setManual] = useState(false)
  const [manualLevel, setManualLevel] = useState(CRYSTAL_DEFAULTS.level)
  const [activePreset, setActivePreset] = useState(null)
  const [layers, setLayers] = useState({
    crystal: true,
    rime: true,
    shards: true,
    motes: true,
    petals: true,
    orbit: true,
  })
  const [readout, setReadout] = useState({
    level: CRYSTAL_DEFAULTS.level,
    target: 0,
    rate: 0,
  })

  const moisture = life.environment?.moisture ?? 0.5
  const turbulence = life.environment?.turbulence ?? 0

  /* Per-frame crystallization state (read by the scene in useFrame). */
  const crystalRef = useRef({ level: CRYSTAL_DEFAULTS.level, target: 0, rate: 0 })
  const inputsRef = useRef({})
  inputsRef.current = { temperature, moisture, turbulence, manual, manualLevel }

  useEffect(() => {
    seekToAge(EXP05_OBSERVE_AGE, { resume: false })
    setPlaying(false)
    setMoisture(CRYSTAL_DEFAULTS.moisture)
    setTurbulence(CRYSTAL_DEFAULTS.turbulence)
    return () => setPlaying(false)
    // Mount-only: park at observe AGE in a cold, moist medium.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let frame = 0
    let previous = performance.now()
    let lastUi = 0
    const tick = (now) => {
      const dt = Math.min(0.05, (now - previous) / 1000)
      previous = now
      const input = inputsRef.current
      const state = crystalRef.current
      const target = input.manual
        ? input.manualLevel
        : crystallizationTarget(input)
      const prev = state.level
      state.level = input.manual
        ? prev + (target - prev) * (1 - Math.exp(-6 * dt))
        : stepCrystallization(prev, target, { turbulence: input.turbulence, dt })
      state.target = target
      state.rate = dt > 0 ? (state.level - prev) / dt : 0
      if (now - lastUi > 120) {
        lastUi = now
        setReadout({ level: state.level, target, rate: state.rate })
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code !== 'Space' && event.key !== ' ') return
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || event.target?.isContentEditable) {
        return
      }
      event.preventDefault()
      if (life.dead) return
      togglePlaying()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [life.dead, togglePlaying])

  const lab = useMemo(
    () => normalizeExp05LabParams({ ...EXP05_LAB_DEFAULTS, temperature }),
    [temperature],
  )
  /* Quantized so the membrane prop only changes in small steps. */
  const crystalLevel = Math.round(readout.level * 50) / 50

  const applyPreset = useCallback(
    (preset) => {
      setActivePreset(preset.id)
      setTemperature(preset.temperature)
      setMoisture(preset.moisture)
      setTurbulence(preset.turbulence)
    },
    [setMoisture, setTurbulence],
  )

  const handleResetFluid = useCallback(() => {
    crystalRef.current.level = 0
    crystalRef.current.rate = 0
    setManualLevel(0)
  }, [])

  const handleReplaySeed = useCallback(() => {
    changeSeed(EXP05_LIFE_SEED)
    seekToAge(EXP05_OBSERVE_AGE, { resume: false })
  }, [changeSeed, seekToAge])

  const stateLabel = crystallizationState(readout.level, readout.rate, turbulence)
  const rimePct = Math.round(rimeAmount(readout.level, moisture) * 100)
  const markerLevel = manual ? manualLevel : readout.target

  return (
    <article className="playground-experiment playground-experiment--exp05 playground-experiment--exp06">
      <div className="exp05-immerse">
        <CrystalLifeScene
          life={life}
          lab={lab}
          crystalRef={crystalRef}
          crystalLevel={crystalLevel}
          layers={layers}
          className="exp05-viewport"
        />

        <header className="exp05-intro">
          <p className="exp05-intro__eyebrow">Playground · Experiment 06</p>
          <h1 className="exp05-intro__title">{title}</h1>
          <p className="exp05-intro__desc">{description}</p>

          <div className="exp06-readout" aria-live="polite">
            <span className="exp06-readout__label">Crystallization</span>
            <div className="exp06-readout__big">
              <span className="exp06-readout__value">{readout.level.toFixed(2)}</span>
              <span className="exp06-readout__state">{stateLabel}</span>
            </div>
            <div className="exp06-meter" aria-hidden="true">
              <span className="exp06-meter__fill" style={{ width: `${readout.level * 100}%` }} />
              <span className="exp06-meter__target" style={{ left: `${markerLevel * 100}%` }} />
            </div>
            <div className="exp06-meter__key">
              <span>Fluid</span>
              <span>{manual ? 'Set' : 'Target'} {markerLevel.toFixed(2)}</span>
              <span>Lattice</span>
            </div>
          </div>
        </header>

        <aside className="exp05-panel" aria-label="Crystal Form Lab controls">
          <p className="exp05-panel__label">Crystal Form Lab · Single body</p>
          <p className="exp05-panel__note">
            The Final Form organism (same body, petals, particles and surface
            evaluator) grows a crystal lattice at its own Life Engine growth
            sites. Temperature is immediate; Moisture rebuilds the Life from
            birth at the current AGE.
          </p>

          <section className="exp05-pop-section">
            <p className="exp05-pop-section__label">Environment (shared medium)</p>
            <EnvSlider
              label="Temperature"
              hint="cold → nucleation · warm → thaw · membrane contracts"
              value={temperature}
              onChange={(v) => {
                setActivePreset(null)
                setTemperature(v)
              }}
            />
            <EnvSlider
              label="Moisture"
              hint="feeds rime bloom · crystal mass"
              value={moisture}
              onChange={(v) => {
                setActivePreset(null)
                setMoisture(v)
              }}
            />
            <EnvSlider
              label="Turbulence"
              hint="fractures the lattice · sheds shards"
              value={turbulence}
              onChange={(v) => {
                setActivePreset(null)
                setTurbulence(v)
              }}
            />
            <div className="exp05-mode" role="group" aria-label="Environment presets">
              <div className="exp05-mode__options">
                {CRYSTAL_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={activePreset === preset.id}
                    onClick={() => applyPreset(preset)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="exp05-pop-section">
            <p className="exp05-pop-section__label">Crystallization</p>
            <div className="exp05-pop-toggles">
              <label className="exp05-pop-toggle">
                <input
                  type="checkbox"
                  checked={manual}
                  onChange={() => {
                    setManual((v) => {
                      if (!v) setManualLevel(Number(crystalRef.current.level.toFixed(2)))
                      return !v
                    })
                  }}
                />
                <span>Set by hand (ignore environment)</span>
              </label>
            </div>
            <label className="exp05-lab__row">
              <span className="exp05-lab__row-head">
                <span>Level</span>
                <span className="exp05-lab__value">{manualLevel.toFixed(2)}</span>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={manualLevel}
                disabled={!manual}
                aria-valuetext={`Crystallization ${manualLevel.toFixed(2)}`}
                onChange={(event) => setManualLevel(Number(event.target.value))}
              />
            </label>
            <button type="button" className="exp05-pop-btn" onClick={handleResetFluid}>
              Reset to fluid
            </button>
          </section>

          <section className="exp05-pop-section">
            <p className="exp05-pop-section__label">Layers</p>
            <div className="exp05-pop-toggles" role="group" aria-label="Layers">
              {LAYER_LABELS.map(([key, label]) => (
                <label key={key} className="exp05-pop-toggle">
                  <input
                    type="checkbox"
                    checked={layers[key]}
                    onChange={() => setLayers((current) => ({ ...current, [key]: !current[key] }))}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </section>

          <dl className="exp05-panel__readout">
            <div>
              <dt>Life seed</dt>
              <dd>{life.seed}</dd>
            </div>
            <div>
              <dt>AGE</dt>
              <dd>{life.age.toFixed(3)}</dd>
            </div>
            <div>
              <dt>Nucleation sites</dt>
              <dd>{life.outputs?.surface?.spatialGrowthSites?.length ?? 0}</dd>
            </div>
            <div>
              <dt>Rime cover</dt>
              <dd>{rimePct}%</dd>
            </div>
          </dl>
        </aside>

        <div className="exp05-chrome">
          <div className="exp05-chrome__actions">
            <button type="button" onClick={togglePlaying} aria-pressed={playing} title="Space — play / pause AGE">
              {life.dead ? 'Ended' : playing ? 'Pause' : 'Play'}
            </button>
            <button type="button" onClick={() => seekToAge(EXP05_OBSERVE_AGE, { resume: false })}>
              Reset AGE
            </button>
            <button type="button" onClick={handleReplaySeed} title="Re-seed and park at observe AGE">
              Replay seed
            </button>
          </div>
          <label className="exp05-chrome__timeline">
            <span className="exp05-chrome__timeline-labels">
              <span>AGE</span>
              <span>{life.age.toFixed(3)}</span>
            </span>
            <input
              className="exp05-chrome__timeline-range"
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={life.age}
              aria-valuetext={`Age ${life.age.toFixed(3)}`}
              onChange={(event) => seekToAge(Number(event.target.value), { resume: false })}
            />
          </label>
        </div>
      </div>
    </article>
  )
}
