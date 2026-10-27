import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WorldViewport } from '../worldv2/WorldViewport.jsx'
import { useLifeEngine } from '../worldv2/life/useLifeEngine.js'
import { WORLD_V2_SEED } from '../worldv2/worldGeometry.js'
import '../worldv2/worldV2.css'
import {
  MEMBRANE_FREEZE_AGE,
  captureMembraneFreeze,
  composeFrozenMembraneLife,
  describeGrowthFocus,
  listGrowthSites,
  selectStableGrowthCluster,
} from './agentBehaviors/growthFocus.js'

const BACKGROUND_STUDY = 'dark'
const LIFE_SEED = WORLD_V2_SEED

/**
 * Crystal-focused inspect framing: close enough that clusters dominate;
 * organism silhouette stays mostly out of frame. User orbit / pan / zoom.
 */
const MACRO_RADIUS = 1.72
const MACRO_RADIUS_MIN = 0.95
const MACRO_RADIUS_MAX = 3.15
/** Approximate membrane radius at freeze AGE — seeds pivot before mesh settle. */
const CLUSTER_PIVOT_RADIUS = 1.3

const STUDIES = [
  {
    id: 'crystal-agents',
    label: 'Study 01',
    title: 'Crystal Agents',
    status: 'active',
    blurb:
      'Baseline growth lab: frozen membrane, live crystal growth, free inspect camera.',
  },
  {
    id: 'organism-agents',
    label: 'Study 02',
    title: 'Organism Agents',
    status: 'placeholder',
    blurb: 'Placeholder — whole-organism agency will land here later.',
  },
  {
    id: 'environmental-signals',
    label: 'Study 03',
    title: 'Environmental Signals',
    status: 'placeholder',
    blurb: 'Placeholder — signal fields and coupling will land here later.',
  },
]

function sphericalFromDirection(direction, radius) {
  const x = Number(direction?.[0]) || 0
  const y = Number(direction?.[1]) || 0
  const z = Number(direction?.[2]) || 1
  const len = Math.hypot(x, y, z) || 1
  const nx = x / len
  const ny = y / len
  const nz = z / len
  return {
    theta: Math.atan2(nx, nz),
    phi: Math.acos(Math.min(1, Math.max(-1, ny))),
    radius,
    revision: 0,
  }
}

function createInspectOrbitState(direction) {
  return sphericalFromDirection(direction ?? [0.2, 0.55, 0.8], MACRO_RADIUS)
}

function pivotFromDirection(direction, radius = CLUSTER_PIVOT_RADIUS) {
  const x = Number(direction?.[0]) || 0
  const y = Number(direction?.[1]) || 0
  const z = Number(direction?.[2]) || 1
  const len = Math.hypot(x, y, z) || 1
  return [(x / len) * radius, (y / len) * radius, (z / len) * radius]
}

function copyOrbitState(orbit) {
  return {
    theta: orbit.theta,
    phi: orbit.phi,
    radius: orbit.radius,
    revision: orbit.revision ?? 0,
  }
}

function cameraPositionFromOrbit(orbit, pivot = [0, 0, 0]) {
  const sinPhi = Math.sin(orbit.phi)
  return [
    pivot[0] + orbit.radius * sinPhi * Math.sin(orbit.theta),
    pivot[1] + orbit.radius * Math.cos(orbit.phi),
    pivot[2] + orbit.radius * sinPhi * Math.cos(orbit.theta),
  ]
}

function zoomPercentFromRadius(radius) {
  const t =
    (MACRO_RADIUS_MAX - radius) / (MACRO_RADIUS_MAX - MACRO_RADIUS_MIN)
  return Math.round(Math.min(1, Math.max(0, t)) * 100)
}

function radiusFromZoomPercent(percent) {
  const t = Math.min(1, Math.max(0, Number(percent) || 0) / 100)
  return MACRO_RADIUS_MAX - t * (MACRO_RADIUS_MAX - MACRO_RADIUS_MIN)
}

function StudyPlaceholder({ study }) {
  return (
    <div
      className="playground-experiment__study-placeholder"
      role="status"
      aria-live="polite"
    >
      <p className="playground-experiment__controls-label">
        {study.label} — {study.title}
      </p>
      <p className="playground-experiment__controls-note">{study.blurb}</p>
      <p className="playground-experiment__placeholder">Coming soon</p>
    </div>
  )
}

function CrystalAgentsStudy() {
  const [cameraEpoch, setCameraEpoch] = useState(0)
  const [zoomPercent, setZoomPercent] = useState(
    () => zoomPercentFromRadius(MACRO_RADIUS),
  )
  /** Locked once after membrane freeze — never re-picked while studying. */
  const [lockedCluster, setLockedCluster] = useState(null)
  const [selectedSiteIds, setSelectedSiteIds] = useState([])
  const [membraneFreeze, setMembraneFreeze] = useState(null)
  const defaultPivot = pivotFromDirection([0.25, 0.45, 0.85])
  const orbitPivotRef = useRef([...defaultPivot])
  const sharedOrbitRef = useRef(createInspectOrbitState([0.25, 0.45, 0.85]))
  /** Crystal-focused home view for Reset Camera (orbit + pivot). */
  const initialViewRef = useRef({
    orbit: copyOrbitState(sharedOrbitRef.current),
    pivot: [...defaultPivot],
  })
  const clusterLockedRef = useRef(false)
  const membraneCapturedRef = useRef(false)
  const pivotSettledRef = useRef(false)

  const {
    life,
    playing,
    togglePlaying,
    restart,
    seekToAge,
    setPlaying,
  } = useLifeEngine(LIFE_SEED)

  /* Park at membrane freeze AGE, paused — capture form snapshot once. */
  useEffect(() => {
    seekToAge(MEMBRANE_FREEZE_AGE, { resume: false })
    setPlaying(false)
    return () => setPlaying(false)
  }, [seekToAge, setPlaying])

  useEffect(() => {
    if (membraneCapturedRef.current) return
    if (Math.abs(life.age - MEMBRANE_FREEZE_AGE) > 0.02) return
    const freeze = captureMembraneFreeze(life)
    if (!freeze) return
    membraneCapturedRef.current = true
    setMembraneFreeze(freeze)

    if (clusterLockedRef.current) return
    const cluster = selectStableGrowthCluster(life, {
      maxSites: 5,
      minDot: 0.62,
      preferCount: 4,
    })
    if (!cluster.siteIds.length) return
    clusterLockedRef.current = true
    pivotSettledRef.current = false
    const orbit = createInspectOrbitState(cluster.direction)
    const pivot = pivotFromDirection(cluster.direction)
    sharedOrbitRef.current = { ...orbit, revision: 1 }
    orbitPivotRef.current = [...pivot]
    initialViewRef.current = {
      orbit: copyOrbitState(sharedOrbitRef.current),
      pivot: [...pivot],
    }
    setZoomPercent(zoomPercentFromRadius(orbit.radius))
    setLockedCluster(cluster)
    setSelectedSiteIds(cluster.siteIds)
    setCameraEpoch((n) => n + 1)
  }, [life])

  const displayLife = useMemo(
    () => composeFrozenMembraneLife(life, membraneFreeze),
    [life, membraneFreeze],
  )

  const focus = useMemo(
    () =>
      describeGrowthFocus(
        life,
        lockedCluster?.siteIds,
        lockedCluster?.anchorSiteId,
      ),
    [life, lockedCluster],
  )

  const allSites = useMemo(() => listGrowthSites(life), [life])
  const totalSiteCount = allSites.length
  const visibleSelected = selectedSiteIds.filter((id) =>
    focus.presentIds?.includes(id),
  )

  const startCamera = useMemo(
    () =>
      cameraPositionFromOrbit(
        sharedOrbitRef.current,
        orbitPivotRef.current,
      ),
    [cameraEpoch],
  )

  const handleFollowPivotSettled = useCallback((pivot) => {
    if (!Array.isArray(pivot) || pivot.length < 3) return
    orbitPivotRef.current = [pivot[0], pivot[1], pivot[2]]
    if (!pivotSettledRef.current) {
      pivotSettledRef.current = true
      initialViewRef.current = {
        orbit: copyOrbitState(sharedOrbitRef.current),
        pivot: [pivot[0], pivot[1], pivot[2]],
      }
    }
  }, [])

  const handleTogglePlay = useCallback(() => {
    togglePlaying()
  }, [togglePlaying])

  const handleRestart = useCallback(() => {
    clusterLockedRef.current = false
    membraneCapturedRef.current = false
    pivotSettledRef.current = false
    setLockedCluster(null)
    setSelectedSiteIds([])
    setMembraneFreeze(null)
    const orbit = createInspectOrbitState([0.25, 0.45, 0.85])
    const pivot = pivotFromDirection([0.25, 0.45, 0.85])
    sharedOrbitRef.current = { ...orbit, revision: 1 }
    orbitPivotRef.current = [...pivot]
    initialViewRef.current = {
      orbit: copyOrbitState(sharedOrbitRef.current),
      pivot: [...pivot],
    }
    setZoomPercent(zoomPercentFromRadius(MACRO_RADIUS))
    setCameraEpoch((n) => n + 1)
    restart({ clearEnvironment: true })
    seekToAge(MEMBRANE_FREEZE_AGE, { resume: false })
  }, [restart, seekToAge])

  const handleResetCamera = useCallback(() => {
    const home = initialViewRef.current
    const direction = lockedCluster?.direction ?? [0.25, 0.45, 0.85]
    const orbit = home?.orbit
      ? { ...copyOrbitState(home.orbit) }
      : createInspectOrbitState(direction)
    const pivot = home?.pivot ? [...home.pivot] : pivotFromDirection(direction)
    sharedOrbitRef.current = {
      ...orbit,
      revision: (sharedOrbitRef.current?.revision ?? 0) + 1,
    }
    orbitPivotRef.current = pivot
    setZoomPercent(zoomPercentFromRadius(orbit.radius))
  }, [lockedCluster])

  const handleSeekGrowthTime = useCallback(
    (growthTime) => {
      seekToAge(growthTime, { resume: false })
    },
    [seekToAge],
  )

  const handleZoom = useCallback((percent) => {
    const radius = radiusFromZoomPercent(percent)
    const orbit = sharedOrbitRef.current
    sharedOrbitRef.current = {
      ...orbit,
      radius,
      revision: (orbit?.revision ?? 0) + 1,
    }
    setZoomPercent(percent)
  }, [])

  const toggleSite = useCallback((siteId) => {
    setSelectedSiteIds((current) => {
      if (current.includes(siteId)) {
        if (current.length <= 1) return current
        return current.filter((id) => id !== siteId)
      }
      return [...current, siteId].sort((a, b) => a - b)
    })
  }, [])

  const membraneReady = Boolean(membraneFreeze)
  const growthTime = life.age

  return (
    <div className="playground-experiment__workspace playground-experiment__workspace--exp03">
      <div className="playground-experiment__stage">
        <section
          className="playground-experiment__scene playground-experiment__scene--live playground-experiment__scene--exp03"
          aria-label="Crystal Agents growth lab viewport"
        >
          <WorldViewport
            key={cameraEpoch}
            className="playground-experiment__viewport"
            view="exterior"
            life={displayLife}
            onStimulus={() => {}}
            backgroundStudy={BACKGROUND_STUDY}
            onCameraReset={handleResetCamera}
            sharedOrbitRef={sharedOrbitRef}
            orbitPivotRef={orbitPivotRef}
            orbitRadiusMin={MACRO_RADIUS_MIN}
            orbitRadiusMax={MACRO_RADIUS_MAX}
            cameraPosition={startCamera}
            autoRotate={false}
            breathAmplitude={0}
            followGrowthSiteIds={lockedCluster?.siteIds ?? null}
            followGrowthSiteMode="once"
            onFollowPivotSettled={handleFollowPivotSettled}
            visibleGrowthSiteIds={
              selectedSiteIds.length ? selectedSiteIds : null
            }
            exteriorControlMode="inspect"
          />
          <div className="playground-experiment__scene-chrome playground-experiment__scene-chrome--exp03">
            <div className="playground-experiment__scene-hud">
              <button type="button" onClick={handleTogglePlay}>
                {life.dead ? 'Ended' : playing ? 'Pause' : 'Play'}
              </button>
              <button type="button" onClick={handleRestart}>
                Reset
              </button>
              <button type="button" aria-pressed={membraneReady} disabled>
                Freeze Membrane
              </button>
              <button type="button" onClick={handleResetCamera}>
                Reset Camera
              </button>
            </div>
            <div className="playground-experiment__exp03-sliders">
              <label className="playground-experiment__timeline">
                <span className="playground-experiment__timeline-labels">
                  <span>Growth Time</span>
                  <span>{growthTime.toFixed(2)} / 1.00</span>
                </span>
                <input
                  className="playground-experiment__timeline-range"
                  type="range"
                  min={0}
                  max={1}
                  step={0.001}
                  value={growthTime}
                  aria-valuemin={0}
                  aria-valuemax={1}
                  aria-valuenow={Number(growthTime.toFixed(3))}
                  aria-valuetext={`Growth time ${growthTime.toFixed(3)}`}
                  onChange={(event) =>
                    handleSeekGrowthTime(Number(event.target.value))
                  }
                />
              </label>
              <label className="playground-experiment__timeline playground-experiment__timeline--zoom">
                <span className="playground-experiment__timeline-labels">
                  <span>Zoom</span>
                  <span>{zoomPercent}%</span>
                </span>
                <input
                  className="playground-experiment__timeline-range"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={zoomPercent}
                  aria-valuetext={`Zoom ${zoomPercent} percent`}
                  onChange={(event) => handleZoom(Number(event.target.value))}
                />
              </label>
            </div>
          </div>
        </section>
      </div>

      <aside
        className="playground-experiment__controls playground-experiment__controls--exp03"
        aria-label="Crystal Agents baseline controls"
      >
        <p className="playground-experiment__controls-label">
          Study 01 — Crystal Agents
        </p>
        <p className="playground-experiment__controls-title">
          Baseline Growth Experiment
        </p>
        <p className="playground-experiment__controls-note">
          Observe crystal growth on a fixed membrane surface. Membrane and
          environment stay constant. Only crystal growth evolves with Growth
          Time. Camera is fully user-controlled and never auto-reframes.
        </p>

        <div className="playground-experiment__exp03-section">
          <p className="playground-experiment__exp03-section-label">
            Fixed conditions
          </p>
          <dl className="playground-experiment__coupling-readout">
            <div>
              <dt>Membrane (AGE)</dt>
              <dd>
                Fixed ({MEMBRANE_FREEZE_AGE.toFixed(2)})
                {membraneReady ? '' : ' · capturing…'}
              </dd>
            </div>
            <div>
              <dt>Environment</dt>
              <dd>Constant</dd>
            </div>
            <div>
              <dt>Agent Behavior</dt>
              <dd>Not enabled</dd>
            </div>
            <div>
              <dt>Camera</dt>
              <dd>Inspect (orbit / pan / zoom)</dd>
            </div>
          </dl>
        </div>

        <div className="playground-experiment__exp03-section">
          <p className="playground-experiment__exp03-section-label">
            Camera controls
          </p>
          <dl className="playground-experiment__coupling-readout">
            <div>
              <dt>Left drag</dt>
              <dd>Orbit</dd>
            </div>
            <div>
              <dt>Middle drag</dt>
              <dd>Pan</dd>
            </div>
            <div>
              <dt>Wheel</dt>
              <dd>Zoom</dd>
            </div>
            <div>
              <dt>Reset Camera</dt>
              <dd>Home framing</dd>
            </div>
          </dl>
        </div>

        <div className="playground-experiment__exp03-section">
          <p className="playground-experiment__exp03-section-label">
            Evolving growth
          </p>
          <dl className="playground-experiment__coupling-readout">
            <div>
              <dt>Growth Time</dt>
              <dd>
                {growthTime.toFixed(2)} / 1.00
              </dd>
            </div>
            <div>
              <dt>Growth Sites (visible)</dt>
              <dd>
                {visibleSelected.length} / {Math.max(totalSiteCount, 1)}
              </dd>
            </div>
            <div>
              <dt>{focus.metricLabel}</dt>
              <dd>{focus.metric.toFixed(3)}</dd>
            </div>
          </dl>
        </div>

        <div className="playground-experiment__exp03-section">
          <p className="playground-experiment__exp03-section-label">
            Selected sites
          </p>
          <ul className="playground-experiment__exp03-sites">
            {(lockedCluster?.siteIds ?? []).map((siteId, index) => {
              const present = focus.presentIds?.includes(siteId)
              const checked = selectedSiteIds.includes(siteId)
              return (
                <li key={siteId}>
                  <label>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSite(siteId)}
                    />
                    <span
                      className={`playground-experiment__exp03-site-dot playground-experiment__exp03-site-dot--${
                        index % 3
                      }`}
                      aria-hidden
                    />
                    Site {String(siteId + 1).padStart(2, '0')}
                    {!present ? ' · dormant' : ''}
                  </label>
                </li>
              )
            })}
            {lockedCluster?.siteIds?.length ? (
              <li className="playground-experiment__exp03-sites-other">
                Other sites (hidden)
              </li>
            ) : (
              <li className="playground-experiment__exp03-sites-other">
                Locking cluster at membrane AGE {MEMBRANE_FREEZE_AGE.toFixed(2)}…
              </li>
            )}
          </ul>
        </div>

        <p className="playground-experiment__controls-note">
          In later studies: enable agent states (Growing / Dormant / Dying),
          neighbor perception, and competition.
        </p>
      </aside>
    </div>
  )
}

/**
 * Experiment 03 — Agent Behaviors
 * Study 01 = Crystal Growth Agent Lab (baseline); Studies 02–03 placeholders.
 */
export default function Experiment03({ title, description }) {
  const [studyId, setStudyId] = useState(STUDIES[0].id)
  const study = STUDIES.find((item) => item.id === studyId) ?? STUDIES[0]

  return (
    <article className="playground-experiment playground-experiment--exp03">
      <header className="playground-experiment__intro">
        <p className="playground-experiment__eyebrow">Playground · Experiment 03</p>
        <h1 className="playground-experiment__title">{title}</h1>
        <p className="playground-experiment__desc">{description}</p>
      </header>

      <div
        className="playground-experiment__study-tabs"
        role="tablist"
        aria-label="Experiment 03 studies"
      >
        {STUDIES.map((item) => {
          const active = item.id === study.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`playground-experiment__study-tab${
                active ? ' is-active' : ''
              }${item.status === 'placeholder' ? ' is-placeholder' : ''}`}
              onClick={() => setStudyId(item.id)}
            >
              <span>{item.label}</span>
              <em>{item.title}</em>
            </button>
          )
        })}
      </div>

      {study.status === 'active' ? (
        <CrystalAgentsStudy />
      ) : (
        <StudyPlaceholder study={study} />
      )}
    </article>
  )
}
