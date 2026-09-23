import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { generateCurlNoiseMap } from './noise/generateNoiseMap.js'
import { DEFAULT_SIMULATION_MODE } from './simulation/simulationModes.js'
import { useSimulationLoop } from './simulation/useSimulationLoop.js'
import { createParticleSystem } from './simulation/particleSystem.js'
import { createErosionTerrain } from './simulation/erosionTerrain.js'
import { createRaindropSystem } from './simulation/raindropSystem.js'
import Map2DPage from './pages/Map2DPage.jsx'
import Grid3DPage from './pages/Grid3DPage.jsx'
import SimulationPage from './pages/SimulationPage.jsx'
import HomePage from './pages/HomePage.jsx'
import AuthPanel from './components/AuthPanel.jsx'
import NoiseConfigPanel from './components/NoiseConfigPanel.jsx'
import { useAuthUser } from './hooks/useAuthUser.js'
import './App.css'

const DEFAULTS = {
  scale: 3.2,
  octaves: 3,
  strength: 1.2,
  time: 0.4,
  resolution: 96,
  noiseType: 'simplex',
  shapeOp: 'none',
  shapeAmount: 0,
  displace: 0.85,
  gridScale: 3.2,
  waterLevel: 0,
  windStrength: 1,
  evolutionSpeed: 0.35,
  vectorDensity: 24,
  particleCount: 500,
  particleSpeed: 1,
  particleSize: 1.6,
  trailLength: 0.65,
  rainAmount: 160,
  erosionRate: 1.55,
}

const INITIAL_EVOLVE = DEFAULTS.time

function getRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '')
  if (hash === '3d') return '3d'
  if (hash === 'sim' || hash === 'simulation') return 'sim'
  if (hash === '2d') return '2d'
  return 'home'
}

const ROUTE_LABEL = { home: 'HOME', '2d': '2D', '3d': '3D', sim: 'SIM' }

export default function App() {
  const [route, setRoute] = useState(getRoute)
  const [params, setParams] = useState(DEFAULTS)
  const [simulationMode, setSimulationMode] = useState(DEFAULT_SIMULATION_MODE)
  const [simView, setSimView] = useState('2d') // 2d | 3d
  const [erosionVersion, setErosionVersion] = useState(0)
  const { user, authReady, authError } = useAuthUser()

  const paramsRef = useRef(params)
  const modeRef = useRef(simulationMode)
  const particleSystemRef = useRef(null)
  const erosionTerrainRef = useRef(null)
  const raindropSystemRef = useRef(null)
  if (!particleSystemRef.current) {
    particleSystemRef.current = createParticleSystem()
  }
  if (!erosionTerrainRef.current) {
    erosionTerrainRef.current = createErosionTerrain()
  }
  if (!raindropSystemRef.current) {
    raindropSystemRef.current = createRaindropSystem()
  }
  const particles = particleSystemRef.current
  const erosionTerrain = erosionTerrainRef.current
  const raindrops = raindropSystemRef.current

  paramsRef.current = params
  modeRef.current = simulationMode

  useEffect(() => {
    particles.ensureCount(params.particleCount)
  }, [particles, params.particleCount])

  useEffect(() => {
    if (simulationMode === 'erosion' && raindrops.isActive()) {
      raindrops.ensureCount(params.rainAmount)
      raindrops._draw2d?.()
    }
  }, [simulationMode, raindrops, params.rainAmount])

  const onTick = useCallback(
    (dt) => {
      const mode = modeRef.current
      const p = paramsRef.current

      if (mode === 'wind') {
        if (p.evolutionSpeed > 0) {
          setParams((prev) => ({ ...prev, time: prev.time + p.evolutionSpeed * dt }))
        }
        return
      }

      if (mode === 'particle') {
        particles.step(dt, p._noiseMap, p.particleSpeed)
        particles._draw2d?.()
        return
      }

      if (mode === 'erosion') {
        raindrops.ensureCount(p.rainAmount)
        raindrops.step(dt, erosionTerrain, p.erosionRate)
        raindrops._draw2d?.()
        erosionTerrain._draw2d?.()
      }
    },
    [particles, raindrops, erosionTerrain],
  )

  const simulation = useSimulationLoop({ onTick })
  const { reset: resetSimulation, pause: pauseSimulation, start: startSimulation } = simulation

  const stopAndResetSimulation = useCallback(() => {
    pauseSimulation()
    resetSimulation()
    setParams((p) => ({ ...p, time: INITIAL_EVOLVE }))
    particles.reset()
    particles._draw2d?.()
    raindrops.clear()
    raindrops._draw2d?.()
    erosionTerrain.clear()
    setErosionVersion((v) => v + 1)
  }, [pauseSimulation, resetSimulation, particles, raindrops, erosionTerrain])

  const handleReset = useCallback(() => {
    stopAndResetSimulation()
  }, [stopAndResetSimulation])

  const handleStart = useCallback(() => {
    if (modeRef.current === 'erosion') {
      const p = paramsRef.current
      erosionTerrain.copyFromNoiseMap(p._noiseMap, p.displace)
      raindrops.start(p.rainAmount, p.displace)
      setErosionVersion((v) => v + 1)
    }
    startSimulation()
  }, [erosionTerrain, raindrops, startSimulation])

  const handleModeChange = useCallback(
    (nextMode) => {
      stopAndResetSimulation()
      setSimulationMode(nextMode)
    },
    [stopAndResetSimulation],
  )

  const handleLoadConfig = useCallback(
    (config) => {
      stopAndResetSimulation()
      setParams((current) => ({ ...current, ...config.params }))
      setSimulationMode(config.simulationMode ?? DEFAULT_SIMULATION_MODE)
      setSimView(config.simView ?? '2d')
    },
    [stopAndResetSimulation],
  )

  useEffect(() => {
    const onHash = () => setRoute(getRoute())
    window.addEventListener('hashchange', onHash)
    if (!window.location.hash) window.location.hash = '#/'
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const noiseMap = useMemo(
    () =>
      generateCurlNoiseMap({
        resolution: params.resolution,
        scale: params.scale,
        octaves: params.octaves,
        strength: params.strength,
        time: params.time,
        shapeOp: params.shapeOp,
        shapeAmount: params.shapeAmount,
        noiseType: params.noiseType,
      }),
    [
      params.resolution,
      params.scale,
      params.octaves,
      params.strength,
      params.time,
      params.shapeOp,
      params.shapeAmount,
      params.noiseType,
    ],
  )

  // Keep latest noise map on paramsRef for the rAF tick without re-binding the loop
  paramsRef.current = { ...params, _noiseMap: noiseMap }

  if (route === 'home') {
    return (
      <div className="app-shell">
        <HomePage />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="brand-bar">
        <a className="brand-block" href="#/" aria-label="Noise Lab home">
          <p className="app-kicker">NOISE LAB / {ROUTE_LABEL[route] ?? '2D'}</p>
          <h1 className="brand-title">Noise Lab</h1>
        </a>

        <div className="brand-actions">
          <div className="page-tabs" role="tablist" aria-label="Views">
            <a
              role="tab"
              aria-selected={route === '2d'}
              className={route === '2d' ? 'is-active' : ''}
              href="#/2d"
            >
              <span className="tab-label-full">2D MAP</span>
              <span className="tab-label-short">2D</span>
            </a>
            <a
              role="tab"
              aria-selected={route === '3d'}
              className={route === '3d' ? 'is-active' : ''}
              href="#/3d"
            >
              <span className="tab-label-full">3D WORLD</span>
              <span className="tab-label-short">3D</span>
            </a>
            <a
              role="tab"
              aria-selected={route === 'sim'}
              className={route === 'sim' ? 'is-active' : ''}
              href="#/sim"
            >
              <span className="tab-label-full">SIMULATION MAP</span>
              <span className="tab-label-short">SIM</span>
            </a>
          </div>
          <NoiseConfigPanel
            user={user}
            state={{ params, simulationMode, simView }}
            onLoad={handleLoadConfig}
          />
          <AuthPanel user={user} authReady={authReady} authError={authError} />
        </div>
      </header>

      <div className="app-main">
        {route === '3d' ? (
          <Grid3DPage params={params} onChange={setParams} noiseMap={noiseMap} />
        ) : route === 'sim' ? (
          <SimulationPage
            params={params}
            onChange={setParams}
            noiseMap={noiseMap}
            simulationMode={simulationMode}
            onSimulationModeChange={handleModeChange}
            simulation={simulation}
            onStart={handleStart}
            onReset={handleReset}
            particleSystem={particles}
            erosionTerrain={erosionTerrain}
            raindropSystem={raindrops}
            erosionVersion={erosionVersion}
            simView={simView}
            onSimViewChange={setSimView}
          />
        ) : (
          <Map2DPage params={params} onChange={setParams} noiseMap={noiseMap} />
        )}
      </div>
    </div>
  )
}
