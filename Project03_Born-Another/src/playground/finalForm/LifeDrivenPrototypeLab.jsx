/**
 * Rollback / comparison only — World MeshPhysical membrane + FinalForm overlays.
 * Not mounted by Experiment 05 Phase B1 (Explore Life path is the active renderer).
 * Re-import from Experiment05 if needed for visual A/B against the white-out path.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { WorldViewport } from '../../worldv2/WorldViewport.jsx'
import { useLifeEngine } from '../../worldv2/life/useLifeEngine.js'
import { WORLD_V2_SEED } from '../../worldv2/worldGeometry.js'
import '../../worldv2/worldV2.css'
import FinalFormGrit from './FinalFormGrit.jsx'
import FinalFormPetals from './FinalFormPetals.jsx'

const LIFE_SEED = WORLD_V2_SEED

export default function LifeDrivenPrototypeLab({
  title,
  description,
  modeSwitcher = null,
}) {
  const [theme, setTheme] = useState('light')
  const [showCrystals, setShowCrystals] = useState(false)
  const [showPetals, setShowPetals] = useState(true)
  const [showGrit, setShowGrit] = useState(true)
  const sharedOrbitRef = useRef({
    theta: 0.38,
    phi: 1.05,
    radius: 5.2,
    revision: 0,
  })

  const {
    life,
    playing,
    togglePlaying,
    restart,
    seekToAge,
    setPlaying,
    addStimulus,
  } = useLifeEngine(LIFE_SEED)

  useEffect(() => {
    seekToAge(0.42, { resume: false })
    setPlaying(false)
    return () => setPlaying(false)
  }, [seekToAge, setPlaying])

  const handleRestart = useCallback(() => {
    restart({ clearEnvironment: true })
    seekToAge(0.42, { resume: false })
  }, [restart, seekToAge])

  const handleSeek = useCallback(
    (age) => {
      seekToAge(age, { resume: false })
    },
    [seekToAge],
  )

  const organismOverlay = useCallback(
    ({ world, life: overlayLife }) => (
      <>
        {showPetals ? (
          <FinalFormPetals world={world} life={overlayLife} />
        ) : null}
        {showGrit ? <FinalFormGrit world={world} life={overlayLife} /> : null}
      </>
    ),
    [showPetals, showGrit],
  )

  const siteCount = life.outputs?.surface?.spatialGrowthSites?.length ?? 0
  const seamless = theme === 'light'
  const backgroundStudy = theme === 'dark' ? 'dark' : 'light'

  return (
    <>
      <WorldViewport
        className="exp05-viewport"
        view="exterior"
        life={life}
        onStimulus={addStimulus}
        backgroundStudy={backgroundStudy}
        seamlessPageBackground={seamless}
        sharedOrbitRef={sharedOrbitRef}
        autoRotate={false}
        exteriorControlMode="inspect"
        appearancePreset="final-form"
        showSpatialCrystals={showCrystals}
        organismOverlay={organismOverlay}
        breathAmplitude={0.0012}
        orbitRadiusMin={3.2}
        orbitRadiusMax={14}
        cameraPosition={[2.2, 1.45, 4.8]}
      />

      <header className="exp05-intro">
        <p className="exp05-intro__eyebrow">Playground · Experiment 04</p>
        <h1 className="exp05-intro__title">{title}</h1>
        <p className="exp05-intro__desc">{description}</p>
      </header>

      <aside className="exp05-panel" aria-label="Life-Driven Prototype controls">
        <p className="exp05-panel__label">Final Form Lab</p>
        {modeSwitcher}
        <p className="exp05-panel__note">
          Rollback path: World Life Engine with MeshPhysical membrane + Final
          Form overlays (known white-out). Not used in Phase B1.
        </p>

        <dl className="exp05-panel__readout">
          <div>
            <dt>Seed</dt>
            <dd>{LIFE_SEED}</dd>
          </div>
          <div>
            <dt>AGE</dt>
            <dd>{life.age.toFixed(3)}</dd>
          </div>
          <div>
            <dt>Growth sites</dt>
            <dd>{siteCount}</dd>
          </div>
          <div>
            <dt>Background</dt>
            <dd>{theme === 'dark' ? 'Dark' : 'Light (Explore)'}</dd>
          </div>
        </dl>

        <div className="exp05-panel__toggles">
          <label>
            <input
              type="checkbox"
              checked={showPetals}
              onChange={(event) => setShowPetals(event.target.checked)}
            />
            Membrane petals
          </label>
          <label>
            <input
              type="checkbox"
              checked={showGrit}
              onChange={(event) => setShowGrit(event.target.checked)}
            />
            Particle field
          </label>
          <label>
            <input
              type="checkbox"
              checked={showCrystals}
              onChange={(event) => setShowCrystals(event.target.checked)}
            />
            Show crystals
          </label>
        </div>

        <p className="exp05-panel__hint">
          Left-drag orbit · middle-drag pan · wheel zoom
        </p>
      </aside>

      <div className="exp05-chrome">
        <div className="exp05-chrome__actions">
          <button type="button" onClick={togglePlaying}>
            {life.dead ? 'Ended' : playing ? 'Pause' : 'Play'}
          </button>
          <button type="button" onClick={handleRestart}>
            Reset
          </button>
          <button
            type="button"
            aria-pressed={theme === 'dark'}
            onClick={() =>
              setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
            }
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
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
