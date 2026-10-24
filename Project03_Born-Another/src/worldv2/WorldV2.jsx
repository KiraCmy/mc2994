import { useCallback, useEffect, useMemo, useState } from 'react'
import SiteHeader from '../SiteHeader.jsx'
import SiteHud from '../SiteHud.jsx'
import { WORLD_V2_SEED } from './worldGeometry.js'
import { replayLife } from './life/lifeEngine.js'
import { useLifeEngine } from './life/useLifeEngine.js'
import { TRANSITION_DURATION, WorldViewport } from './WorldViewport.jsx'
import './worldV2.css'

export default function WorldV2({ modeId, onSelectMode }) {
  const [view, setView] = useState('exterior')
  const [showComparison, setShowComparison] = useState(false)
  const [backgroundStudy, setBackgroundStudy] = useState('dark')
  const {
    life,
    playing,
    togglePlaying,
    restart,
    changeSeed,
    addStimulus,
    seekToAge,
  } = useLifeEngine(WORLD_V2_SEED)
  const [seedDraft, setSeedDraft] = useState(String(WORLD_V2_SEED))
  const transitioning = view === 'entering' || view === 'exiting'
  const interior = view === 'interior' || view === 'exiting'
  const baseline = useMemo(() => {
    if (!import.meta.env.DEV || !showComparison) return null
    return replayLife({
      seed: life.seed,
      history: [],
      environmentHistory: life.environmentHistory,
      step: life.step,
      durationSeconds: life.durationSeconds,
    })
  }, [
    life.durationSeconds,
    life.environmentHistory,
    life.seed,
    life.step,
    showComparison,
  ])
  const growthRegions = life.spatial.sites
    .map(({ region }) => region)
    .sort((a, b) => a - b)
  const baselineRegions = baseline
    ? baseline.spatial.sites.map(({ region }) => region).sort((a, b) => a - b)
    : []
  const locationsChanged =
    baseline !== null &&
    growthRegions.join(',') !== baselineRegions.join(',')

  useEffect(() => {
    if (!transitioning) return undefined
    const destination = view === 'entering' ? 'interior' : 'exterior'
    const timer = window.setTimeout(
      () => setView(destination),
      TRANSITION_DURATION * 1000,
    )
    return () => window.clearTimeout(timer)
  }, [transitioning, view])

  const toggleView = () => {
    if (transitioning) return
    setView(view === 'exterior' ? 'entering' : 'exiting')
  }

  const focusWorldCanvas = useCallback(() => {
    const canvas = document.querySelector('.world-v2__viewport canvas')
    if (!(canvas instanceof HTMLElement)) return
    canvas.tabIndex = 0
    canvas.focus({ preventScroll: true })
  }, [])

  const resetCameraView = useCallback(() => {
    setView('exterior')
  }, [])

  const commitSeed = () => {
    const nextSeed = Math.max(1, Math.floor(Number(seedDraft) || 1))
    setSeedDraft(String(nextSeed))
    if (nextSeed !== life.seed) changeSeed(nextSeed)
  }

  return (
    <main
      className={`world-v2 world-v2--${view} world-v2--background-${backgroundStudy}`}
      data-life-state={life.dead ? 'dead' : playing ? 'running' : 'paused'}
      data-life-step={life.step}
      data-interventions={life.history.length}
      data-growth-sites={life.spatial.sites.length}
      data-stimulus-regions={life.history
        .map(({ region }) => region)
        .join(',')}
      data-growth-regions={growthRegions.join(',')}
      data-baseline-growth-regions={baselineRegions.join(',')}
    >
      <WorldViewport
        view={view}
        life={life}
        onStimulus={addStimulus}
        backgroundStudy={backgroundStudy}
        onCameraReset={resetCameraView}
      />

      <SiteHud className="world-v2__hud">
        <SiteHeader modeId={modeId} onSelectMode={onSelectMode} />
      </SiteHud>

      <section
        className="world-v2__background-study"
        aria-label="Background Study"
      >
        <span>Background Study</span>
        <div>
          {[
            ['light', 'A — Light'],
            ['dark', 'B — Dark'],
            ['atmospheric', 'C — Atmospheric'],
            ['shader', 'D — Shader'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={backgroundStudy === id ? 'is-active' : ''}
              aria-pressed={backgroundStudy === id}
              onClick={() => setBackgroundStudy(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <div className="world-v2__experience">
        <p>
          {life.dead
            ? 'Mineral remnant'
            : interior
              ? 'Inner world'
              : 'Living specimen'}
        </p>
        <button
          type="button"
          onClick={() => {
            toggleView()
            window.setTimeout(focusWorldCanvas, 0)
          }}
          disabled={transitioning}
          aria-label={interior ? 'Exit organism' : 'Enter organism'}
        >
          {view === 'entering'
            ? 'Entering'
            : view === 'exiting'
              ? 'Exiting'
              : interior
                ? 'Exit'
                : 'Enter'}
        </button>
        <span>WASD move · QE elevate · drag look · scroll dolly · R reset</span>
      </div>

      <section className="world-v2__life" aria-label="Life Engine controls">
        <div className="world-v2__life-actions">
          <button type="button" onClick={togglePlaying} disabled={life.dead}>
            {life.dead ? 'Ended' : playing ? 'Pause' : 'Play'}
          </button>
          <button type="button" onClick={restart}>
            Restart
          </button>
          {import.meta.env.DEV ? (
            <button
              type="button"
              onClick={() => setShowComparison((current) => !current)}
              aria-pressed={showComparison}
            >
              {showComparison ? 'Hide Compare' : 'Compare'}
            </button>
          ) : null}
        </div>
        <label>
          Seed
          <input
            type="number"
            min="1"
            step="1"
            value={seedDraft}
            onChange={(event) => setSeedDraft(event.target.value)}
            onBlur={commitSeed}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur()
              }
            }}
          />
        </label>
        <output>Age {life.age.toFixed(3)}</output>
        {life.dead ? (
          <p className="world-v2__life-ended" aria-live="polite">
            Life ended
          </p>
        ) : null}
        {baseline ? (
          <div className="world-v2__comparison" aria-live="polite">
            <span>
              Baseline sites {baselineRegions.join(', ') || 'none'}
            </span>
            <span>
              Stimulated sites {growthRegions.join(', ') || 'none'}
            </span>
            <span>
              {locationsChanged
                ? 'Future growth locations diverged'
                : 'Growth locations match baseline'}
            </span>
            <button type="button" onClick={() => changeSeed(life.seed)}>
              Reset clean trial
            </button>
          </div>
        ) : null}
      </section>

      <section className="world-v2__timeline" aria-label="Life timeline">
        <div className="world-v2__timeline-labels">
          <span>Birth</span>
          <span>Death</span>
        </div>
        <input
          className="world-v2__timeline-range"
          type="range"
          min="0"
          max="1"
          step="0.001"
          value={life.age}
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={Number(life.age.toFixed(3))}
          aria-valuetext={`Age ${life.age.toFixed(3)}`}
          onPointerDown={() => seekToAge(life.age)}
          onChange={(event) => {
            seekToAge(Number(event.target.value))
          }}
        />
      </section>
    </main>
  )
}
