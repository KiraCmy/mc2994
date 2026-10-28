import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLifeEngine } from '../worldv2/life/useLifeEngine.js'
import ExploreLifeScene from './finalForm/ExploreLifeScene.jsx'
import ExploreOriginalScene from './finalForm/ExploreOriginalScene.jsx'
import Exp05LabPanel from './finalForm/Exp05LabPanel.jsx'
import PopulationScene from './finalForm/PopulationScene.jsx'
import { createContactLifeCache } from './finalForm/populationContact.js'
import {
  ORGANISM_TRAIT_LIMITS,
  POPULATION_DEFAULT_COUNT,
  POPULATION_ENV_DEFAULTS,
  POPULATION_MAX,
  STAGE,
} from './finalForm/populationSim.js'
import { EXP05_MORPHOLOGY_TYPE_OPTIONS } from './finalForm/exp05MorphologyTypes.js'
import { usePopulationSim } from './finalForm/usePopulationSim.js'
import {
  EXP05_LIFE_SEED,
  EXP05_OBSERVE_AGE,
} from './finalForm/exploreLifeAdapter.js'
import {
  EXP05_LAB_DEFAULTS,
  normalizeExp05LabParams,
} from './finalForm/exp05LabParams.js'

/**
 * Phase B1 modes:
 * - life-explore (default): Exp05 Life Engine → Explore Specimen/Scatter/Particle
 * - original-explore: Stage A visual reference (local AGE, no Life Engine)
 *
 * World MeshPhysical rollback lives in finalForm/LifeDrivenPrototypeLab.jsx
 * and is not mounted here.
 */
export const EXP05_VISUAL_MODES = {
  /** Several organisms at different life stages floating together. */
  POPULATION: 'population',
  LIFE_EXPLORE: 'life-explore',
  ORIGINAL_EXPLORE: 'original-explore',
}

function ModeSwitcher({ visualMode, onChange }) {
  return (
    <div className="exp05-mode" role="group" aria-label="Visual renderer">
      <p className="exp05-mode__label">Renderer</p>
      <div className="exp05-mode__options">
        <button
          type="button"
          aria-pressed={visualMode === EXP05_VISUAL_MODES.POPULATION}
          onClick={() => onChange(EXP05_VISUAL_MODES.POPULATION)}
        >
          Population
        </button>
        <button
          type="button"
          aria-pressed={visualMode === EXP05_VISUAL_MODES.LIFE_EXPLORE}
          onClick={() => onChange(EXP05_VISUAL_MODES.LIFE_EXPLORE)}
        >
          Life → Explore
        </button>
        <button
          type="button"
          aria-pressed={visualMode === EXP05_VISUAL_MODES.ORIGINAL_EXPLORE}
          onClick={() => onChange(EXP05_VISUAL_MODES.ORIGINAL_EXPLORE)}
        >
          Original Explore
        </button>
      </div>
    </div>
  )
}

/**
 * Phase B1 integrated organism: independent useLifeEngine + Explore visuals.
 */
function LifeExploreLab({ title, description, visualMode, onVisualMode }) {
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
  const [lab, setLab] = useState(() => normalizeExp05LabParams(EXP05_LAB_DEFAULTS))
  const [labOpen, setLabOpen] = useState(true)

  useEffect(() => {
    seekToAge(EXP05_OBSERVE_AGE, { resume: false })
    setPlaying(false)
    return () => setPlaying(false)
  }, [seekToAge, setPlaying])

  const handleReset = useCallback(() => {
    seekToAge(EXP05_OBSERVE_AGE, { resume: false })
  }, [seekToAge])

  const handleSeek = useCallback(
    (age) => {
      seekToAge(age, { resume: false })
    },
    [seekToAge],
  )

  const handleReplaySeed = useCallback(() => {
    changeSeed(EXP05_LIFE_SEED)
    seekToAge(EXP05_OBSERVE_AGE, { resume: false })
  }, [changeSeed, seekToAge])

  const handleLabChange = useCallback((next) => {
    setLab(normalizeExp05LabParams(next))
  }, [])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code !== 'Space' && event.key !== ' ') return
      const target = event.target
      const tag = target?.tagName
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable
      ) {
        return
      }
      event.preventDefault()
      if (life.dead) return
      togglePlaying()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [life.dead, togglePlaying])

  return (
    <>
      <ExploreLifeScene life={life} lab={lab} className="exp05-viewport" />

      <header className="exp05-intro">
        <p className="exp05-intro__eyebrow">Playground · Experiment 04</p>
        <h1 className="exp05-intro__title">{title}</h1>
        <p className="exp05-intro__desc">{description}</p>
      </header>

      <aside className="exp05-panel" aria-label="Life → Explore controls">
        <p className="exp05-panel__label">Final Form Lab</p>
        <ModeSwitcher visualMode={visualMode} onChange={onVisualMode} />
        <p className="exp05-panel__note">
          Body, petals, and particles share the World surface evaluator (Explore
          framing). Scrub AGE for morph + growth-site petals; Moisture / Turbulence
          drive the Life Engine environment (same mechanisms as World).
        </p>

        <label className="exp05-age">
          <span className="exp05-age__labels">
            <span>AGE</span>
            <span>{life.age.toFixed(3)}</span>
          </span>
          <input
            className="exp05-age__range"
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={life.age}
            aria-label="Organism age"
            aria-valuetext={`Age ${life.age.toFixed(3)}`}
            onChange={(event) => handleSeek(Number(event.target.value))}
          />
          <span className="exp05-age__hint">
            {playing ? 'Playing' : 'Paused'} · Space to {playing ? 'pause' : 'play'}
          </span>
        </label>

        <Exp05LabPanel
          lab={lab}
          onChange={handleLabChange}
          open={labOpen}
          onToggle={() => setLabOpen((current) => !current)}
          life={life}
          onMoistureChange={setMoisture}
          onTurbulenceChange={setTurbulence}
        />

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
            <dt>Temperature</dt>
            <dd>{(lab.temperature ?? 0.5).toFixed(2)}</dd>
          </div>
          <div>
            <dt>Moisture</dt>
            <dd>{(life.environment?.moisture ?? 0.5).toFixed(2)}</dd>
          </div>
          <div>
            <dt>Turbulence</dt>
            <dd>{(life.environment?.turbulence ?? 0).toFixed(2)}</dd>
          </div>
          <div>
            <dt>Growth sites</dt>
            <dd>
              {life.outputs?.surface?.spatialGrowthSites?.length ?? 0}
            </dd>
          </div>
          <div>
            <dt>Background</dt>
            <dd>Studies light</dd>
          </div>
        </dl>

        <p className="exp05-panel__hint">
          Scrub AGE or press Space to play / pause. Petals emerge after
          nucleation (~0.25+) and mature per site.
        </p>
      </aside>

      <div className="exp05-chrome">
        <div className="exp05-chrome__actions">
          <button
            type="button"
            onClick={togglePlaying}
            aria-pressed={playing}
            title="Space — play / pause"
          >
            {life.dead ? 'Ended' : playing ? 'Pause' : 'Play'}
          </button>
          <button type="button" onClick={handleReset}>
            Reset
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
            onChange={(event) => handleSeek(Number(event.target.value))}
          />
        </label>
      </div>
    </>
  )
}

/** Stage A reference: Explore stack with local AGE (no Life Engine). */
function OriginalExploreLab({ title, description, visualMode, onVisualMode }) {
  const [age, setAge] = useState(EXP05_OBSERVE_AGE)
  const [api, setApi] = useState(null)

  const handleApiChange = useCallback((next) => {
    setApi(next)
  }, [])

  const handleAgeChange = useCallback((next) => {
    setAge(next)
  }, [])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code !== 'Space' && event.key !== ' ') return
      const target = event.target
      const tag = target?.tagName
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable
      ) {
        return
      }
      if (!api || api.isDead) return
      event.preventDefault()
      api.toggle?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [api])

  const animating = Boolean(api?.animating)

  return (
    <>
      <ExploreOriginalScene
        className="exp05-viewport"
        onAgeChange={handleAgeChange}
        onApiChange={handleApiChange}
      />

      <header className="exp05-intro">
        <p className="exp05-intro__eyebrow">Playground · Experiment 04</p>
        <h1 className="exp05-intro__title">{title}</h1>
        <p className="exp05-intro__desc">{description}</p>
      </header>

      <aside className="exp05-panel" aria-label="Original Explore controls">
        <p className="exp05-panel__label">Final Form Lab</p>
        <ModeSwitcher visualMode={visualMode} onChange={onVisualMode} />
        <p className="exp05-panel__note">
          Visual reference only: local Explore AGE clock (16s Animate), no Life
          Engine. Use to compare B1 Life → Explore at the same Seed / AGE.
        </p>

        <label className="exp05-age">
          <span className="exp05-age__labels">
            <span>AGE</span>
            <span>{age.toFixed(3)}</span>
          </span>
          <input
            className="exp05-age__range"
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={age}
            aria-label="Organism age"
            aria-valuetext={`Age ${age.toFixed(3)}`}
            disabled={!api}
            onChange={(event) => api?.seek?.(Number(event.target.value))}
          />
          <span className="exp05-age__hint">
            {animating ? 'Playing' : 'Paused'} · Space to{' '}
            {animating ? 'pause' : 'play'}
          </span>
        </label>

        <dl className="exp05-panel__readout">
          <div>
            <dt>Seed</dt>
            <dd>{EXP05_LIFE_SEED}</dd>
          </div>
          <div>
            <dt>AGE</dt>
            <dd>{age.toFixed(3)}</dd>
          </div>
          <div>
            <dt>Stack</dt>
            <dd>Explore (local)</dd>
          </div>
          <div>
            <dt>Background</dt>
            <dd>Studies light</dd>
          </div>
        </dl>

        <p className="exp05-panel__hint">
          Scrub AGE or press Space to play / pause · drag orbit · scroll zoom
        </p>
      </aside>

      <div className="exp05-chrome">
        <div className="exp05-chrome__actions">
          <button
            type="button"
            onClick={() => api?.toggle?.()}
            disabled={!api}
            aria-pressed={animating}
            title="Space — play / pause"
          >
            {api?.isDead ? 'Ended' : animating ? 'Pause' : 'Play'}
          </button>
          <button type="button" onClick={() => api?.reset?.()} disabled={!api}>
            Reset
          </button>
        </div>
        <label className="exp05-chrome__timeline">
          <span className="exp05-chrome__timeline-labels">
            <span>AGE</span>
            <span>{age.toFixed(3)}</span>
          </span>
          <input
            className="exp05-chrome__timeline-range"
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={age}
            aria-valuetext={`Age ${age.toFixed(3)}`}
            disabled={!api}
            onChange={(event) => api?.seek?.(Number(event.target.value))}
          />
        </label>
      </div>
    </>
  )
}

const STAGE_LABEL = {
  [STAGE.BUD]: 'Bud',
  [STAGE.YOUNG]: 'Young',
  [STAGE.MATURE]: 'Mature',
  [STAGE.OLD]: 'Old',
}

const MORPH_LABEL = {
  world: 'World',
  segmented: 'Segmented',
  spiral: 'Spiral',
}

/**
 * Population — several Exp05 organisms (different silhouettes and life
 * stages) float in one medium and influence each other: young seek mature
 * bodies, matures keep territory, old drift to the rim; matures stream
 * particles to nearby young (nurture → faster growth); close bodies dent each
 * other's membranes; ended lives dissolve and are re-born as buds.
 */
function PopulationLab({ title, description, visualMode, onVisualMode }) {
  const [count, setCount] = useState(POPULATION_DEFAULT_COUNT)
  const [playing, setPlaying] = useState(true)
  const [timeScale, setTimeScale] = useState(1)
  const [behaviours, setBehaviours] = useState(true)
  const [exchange, setExchange] = useState(true)
  const [lifecycle, setLifecycle] = useState(true)
  const [contact, setContact] = useState(true)
  const [environment, setEnvironment] = useState(() => ({
    ...POPULATION_ENV_DEFAULTS,
  }))
  const [selectedId, setSelectedId] = useState(null)

  const { popRef, snapshot, lives, reset, setTraits } = usePopulationSim({
    count,
    playing,
    timeScale,
    behaviours,
    exchange,
    lifecycle,
    environment,
  })

  const selected =
    snapshot.organisms.find((org) => org.id === selectedId) ?? null

  const setEnv = useCallback((key, value) => {
    setEnvironment((prev) => ({ ...prev, [key]: value }))
  }, [])

  const contactCache = useMemo(() => createContactLifeCache(), [])
  const contactLives = useMemo(
    () => contactCache(snapshot.organisms, lives, contact),
    [contactCache, snapshot, lives, contact],
  )

  const streamsByOrg = useMemo(() => {
    const feeding = {}
    const fedBy = {}
    for (const e of snapshot.exchanges || []) {
      ;(feeding[e.from] ||= []).push(e.to)
      ;(fedBy[e.to] ||= []).push(e.from)
    }
    return { feeding, fedBy }
  }, [snapshot])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code !== 'Space' && event.key !== ' ') return
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      event.preventDefault()
      setPlaying((p) => !p)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const toggles = [
    ['Stage behaviours', behaviours, setBehaviours],
    ['Particle exchange', exchange, setExchange],
    ['Contact deformation', contact, setContact],
    ['Life cycle (re-birth)', lifecycle, setLifecycle],
  ]

  return (
    <>
      <PopulationScene
        popRef={popRef}
        snapshot={snapshot}
        lives={lives}
        contactLives={contactLives}
        showStreams={exchange}
        temperature={environment.temperature}
        selectedId={selectedId}
        onSelect={setSelectedId}
        className="exp05-viewport"
      />

      <header className="exp05-intro">
        <p className="exp05-intro__eyebrow">Playground · Experiment 04</p>
        <h1 className="exp05-intro__title">{title}</h1>
        <p className="exp05-intro__desc">
          {snapshot.organisms.length} organisms at different life stages float
          in one medium. Young bodies seek mature ones and are fed by their
          particle streams; matures keep their distance; old bodies drift to
          the rim, dissolve and are born again.
        </p>
      </header>

      <aside className="exp05-panel" aria-label="Population controls">
        <p className="exp05-panel__label">Final Form Lab · Population</p>
        <ModeSwitcher visualMode={visualMode} onChange={onVisualMode} />

        <label className="exp05-age">
          <span className="exp05-age__labels">
            <span>Organisms</span>
            <span>{count}</span>
          </span>
          <input
            className="exp05-age__range"
            type="range"
            min={3}
            max={POPULATION_MAX}
            step={1}
            value={count}
            aria-label="Organism count"
            onChange={(event) => setCount(Number(event.target.value))}
          />
        </label>

        <label className="exp05-age">
          <span className="exp05-age__labels">
            <span>Time</span>
            <span>{timeScale.toFixed(1)}×</span>
          </span>
          <input
            className="exp05-age__range"
            type="range"
            min={0}
            max={4}
            step={0.1}
            value={timeScale}
            aria-label="Population time scale"
            onChange={(event) => setTimeScale(Number(event.target.value))}
          />
          <span className="exp05-age__hint">
            {playing ? 'Playing' : 'Paused'} · Space to {playing ? 'pause' : 'play'}
          </span>
        </label>

        <div className="exp05-pop-section" role="group" aria-label="Environment">
          <p className="exp05-pop-section__label">Environment (shared medium)</p>
          {[
            ['temperature', 'Temperature', 'metabolism · membrane expand / contract'],
            ['moisture', 'Moisture', 'young growth · nurture reach · Life growth'],
            ['turbulence', 'Turbulence', 'currents · jostling · membrane field'],
          ].map(([key, label, hint]) => (
            <label key={key} className="exp05-age" title={hint}>
              <span className="exp05-age__labels">
                <span>{label}</span>
                <span>{environment[key].toFixed(2)}</span>
              </span>
              <input
                className="exp05-age__range"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={environment[key]}
                aria-label={`Population ${label}`}
                onChange={(event) => setEnv(key, Number(event.target.value))}
              />
              <span className="exp05-age__hint">{hint}</span>
            </label>
          ))}
          <button
            type="button"
            className="exp05-pop-btn"
            onClick={() => setEnvironment({ ...POPULATION_ENV_DEFAULTS })}
          >
            Neutral environment
          </button>
        </div>

        <div className="exp05-pop-toggles" role="group" aria-label="Interactions">
          {toggles.map(([label, value, set]) => (
            <label key={label} className="exp05-pop-toggle">
              <input
                type="checkbox"
                checked={value}
                onChange={() => set((v) => !v)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        <p className="exp05-pop-section__label">
          Organisms — click a row or a body to edit it
        </p>
        <ul className="exp05-pop-roster" aria-label="Organisms">
          {snapshot.organisms.map((org) => {
            const feeding = streamsByOrg.feeding[org.id] || []
            const fedBy = streamsByOrg.fedBy[org.id] || []
            return (
              <li
                key={org.id}
                className={`exp05-pop-row is-${org.stage}${
                  org.id === selectedId ? ' is-selected' : ''
                }`}
                role="button"
                tabIndex={0}
                aria-pressed={org.id === selectedId}
                onClick={() =>
                  setSelectedId((cur) => (cur === org.id ? null : org.id))
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedId((cur) => (cur === org.id ? null : org.id))
                  }
                }}
              >
                <strong>{org.id.toUpperCase()}</strong>
                <span>{MORPH_LABEL[org.morphologyType] || org.morphologyType}</span>
                <span className="exp05-pop-row__stage">
                  {STAGE_LABEL[org.stage]}
                </span>
                <span className="exp05-pop-row__age">
                  <i style={{ width: `${Math.round(org.age * 100)}%` }} />
                </span>
                <em>{org.age.toFixed(2)}</em>
                {feeding.length || fedBy.length || org.contacts.length ? (
                  <span className="exp05-pop-row__note">
                    {feeding.length ? `feeding ${feeding.map((id) => id.toUpperCase()).join(', ')}` : ''}
                    {fedBy.length ? `fed by ${fedBy.map((id) => id.toUpperCase()).join(', ')}` : ''}
                    {org.contacts.length
                      ? `${feeding.length || fedBy.length ? ' · ' : ''}touching ${org.contacts.map((c) => c.id.toUpperCase()).join(', ')}`
                      : ''}
                  </span>
                ) : null}
                {org.generation > 0 || org.frozen ? (
                  <span className="exp05-pop-row__gen">
                    {org.generation > 0 ? `gen ${org.generation + 1}` : ''}
                    {org.frozen ? `${org.generation > 0 ? ' · ' : ''}growth frozen` : ''}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>

        {selected ? (
          <div className="exp05-pop-editor" aria-label={`Edit ${selected.id}`}>
            <div className="exp05-pop-editor__head">
              <strong>
                {selected.id.toUpperCase()} · {STAGE_LABEL[selected.stage]}
              </strong>
              <button
                type="button"
                className="exp05-pop-btn"
                onClick={() => setSelectedId(null)}
              >
                Done
              </button>
            </div>

            <div className="exp05-pop-editor__shapes" role="group" aria-label="Morphology">
              {EXP05_MORPHOLOGY_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={selected.morphologyType === opt.id}
                  onClick={() => setTraits(selected.id, { morphologyType: opt.id })}
                >
                  {MORPH_LABEL[opt.id] || opt.label}
                </button>
              ))}
            </div>

            {[
              ['lobe', 'Complexity', ORGANISM_TRAIT_LIMITS.lobe, 0.01],
              ['sculpt', 'Sculptural', ORGANISM_TRAIT_LIMITS.sculpt, 0.01],
              ['age', 'AGE (stage)', ORGANISM_TRAIT_LIMITS.age, 0.005],
            ].map(([key, label, [min, max], step]) => (
              <label key={key} className="exp05-age">
                <span className="exp05-age__labels">
                  <span>{label}</span>
                  <span>{Number(selected[key]).toFixed(2)}</span>
                </span>
                <input
                  className="exp05-age__range"
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={selected[key]}
                  aria-label={`${selected.id} ${label}`}
                  onChange={(event) =>
                    setTraits(selected.id, { [key]: Number(event.target.value) })
                  }
                />
              </label>
            ))}

            <label className="exp05-pop-toggle">
              <input
                type="checkbox"
                checked={selected.frozen}
                onChange={() => setTraits(selected.id, { frozen: !selected.frozen })}
              />
              <span>Freeze growth (hold AGE)</span>
            </label>
            <button
              type="button"
              className="exp05-pop-btn"
              onClick={() => setTraits(selected.id, { reseed: true })}
            >
              New individual (reseed)
            </button>
          </div>
        ) : null}

        <dl className="exp05-panel__readout">
          <div>
            <dt>Time</dt>
            <dd>{snapshot.time.toFixed(0)}s</dd>
          </div>
          <div>
            <dt>Nurture streams</dt>
            <dd>{snapshot.exchanges.length}</dd>
          </div>
          <div>
            <dt>Re-births</dt>
            <dd>{snapshot.births}</dd>
          </div>
        </dl>

        <p className="exp05-panel__hint">
          Drag to orbit · scroll to zoom. White mote streams = a mature body
          feeding a young one (the young ages faster).
        </p>
      </aside>

      <div className="exp05-chrome">
        <div className="exp05-chrome__actions">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-pressed={playing}
          >
            {playing ? 'Pause' : 'Play'}
          </button>
          <button type="button" onClick={reset}>
            Reset
          </button>
        </div>
      </div>
    </>
  )
}

/**
 * Experiment 04 — Final Form Lab (Phase B1)
 * (Playground tab id `04`; internal CSS still uses exp05-*)
 * One Life Engine instance → Explore visual stack. Only one Canvas mounted.
 */
export default function Experiment05({ title, description }) {
  const [visualMode, setVisualMode] = useState(EXP05_VISUAL_MODES.POPULATION)

  return (
    <article className="playground-experiment playground-experiment--exp05">
      <div className="exp05-immerse">
        {visualMode === EXP05_VISUAL_MODES.POPULATION ? (
          <PopulationLab
            title={title}
            description={description}
            visualMode={visualMode}
            onVisualMode={setVisualMode}
          />
        ) : visualMode === EXP05_VISUAL_MODES.LIFE_EXPLORE ? (
          <LifeExploreLab
            title={title}
            description={description}
            visualMode={visualMode}
            onVisualMode={setVisualMode}
          />
        ) : (
          <OriginalExploreLab
            title={title}
            description={description}
            visualMode={visualMode}
            onVisualMode={setVisualMode}
          />
        )}
      </div>
    </article>
  )
}
