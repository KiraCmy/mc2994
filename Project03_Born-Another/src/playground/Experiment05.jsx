import { useCallback, useEffect, useState } from 'react'
import { useLifeEngine } from '../worldv2/life/useLifeEngine.js'
import ExploreLifeScene from './finalForm/ExploreLifeScene.jsx'
import ExploreOriginalScene from './finalForm/ExploreOriginalScene.jsx'
import Exp05LabPanel from './finalForm/Exp05LabPanel.jsx'
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
        <p className="exp05-intro__eyebrow">Playground · Experiment 05</p>
        <h1 className="exp05-intro__title">{title}</h1>
        <p className="exp05-intro__desc">{description}</p>
      </header>

      <aside className="exp05-panel" aria-label="Life → Explore controls">
        <p className="exp05-panel__label">Final Form Lab</p>
        <ModeSwitcher visualMode={visualMode} onChange={onVisualMode} />
        <p className="exp05-panel__note">
          Body, petals, and particles share the World surface evaluator (Explore
          framing). Scrub AGE for morph + growth-site petals; lab knobs tune
          density and morph strength.
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
        <p className="exp05-intro__eyebrow">Playground · Experiment 05</p>
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

/**
 * Experiment 05 — Final Form Lab (Phase B1)
 * One Life Engine instance → Explore visual stack. Only one Canvas mounted.
 */
export default function Experiment05({ title, description }) {
  const [visualMode, setVisualMode] = useState(EXP05_VISUAL_MODES.LIFE_EXPLORE)

  return (
    <article className="playground-experiment playground-experiment--exp05">
      <div className="exp05-immerse">
        {visualMode === EXP05_VISUAL_MODES.LIFE_EXPLORE ? (
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
