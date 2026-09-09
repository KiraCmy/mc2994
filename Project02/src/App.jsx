import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { generateCurlNoiseMap } from './noise/generateNoiseMap.js'
import { DEFAULT_SIMULATION_MODE } from './simulation/simulationModes.js'
import { useSimulationLoop } from './simulation/useSimulationLoop.js'
import { createParticleSystem } from './simulation/particleSystem.js'
import Map2DPage from './pages/Map2DPage.jsx'
import Grid3DPage from './pages/Grid3DPage.jsx'
import SimulationPage from './pages/SimulationPage.jsx'
import './App.css'

const DEFAULTS = {
  scale: 3.2,
  octaves: 3,
  strength: 1.2,
  time: 0.4,
  resolution: 48,
  shapeOp: 'none',
  shapeAmount: 0,
  displace: 0.85,
  gridScale: 3.2,
  windStrength: 1,
  evolutionSpeed: 0.35,
  vectorDensity: 24,
  particleCount: 500,
  particleSpeed: 1,
  particleSize: 1.6,
  trailLength: 0.65,
}

const INITIAL_EVOLVE = DEFAULTS.time

function getRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '')
  if (hash === '3d') return '3d'
  if (hash === 'sim' || hash === 'simulation') return 'sim'
  return '2d'
}

const ROUTE_LABEL = { '2d': '2D', '3d': '3D', sim: 'SIM' }

export default function App() {
  const [route, setRoute] = useState(getRoute)
  const [params, setParams] = useState(DEFAULTS)
  const [simulationMode, setSimulationMode] = useState(DEFAULT_SIMULATION_MODE)
  const [simView, setSimView] = useState('2d') // 2d | 3d

  const paramsRef = useRef(params)
  const modeRef = useRef(simulationMode)
  const particleSystemRef = useRef(null)
  if (!particleSystemRef.current) {
    particleSystemRef.current = createParticleSystem()
  }
  const particles = particleSystemRef.current

  paramsRef.current = params
  modeRef.current = simulationMode

  useEffect(() => {
    particles.ensureCount(params.particleCount)
  }, [particles, params.particleCount])

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
      }
    },
    [particles],
  )

  const simulation = useSimulationLoop({ onTick })
  const { reset: resetSimulation, pause: pauseSimulation } = simulation

  const stopAndResetSimulation = useCallback(() => {
    pauseSimulation()
    resetSimulation()
    setParams((p) => ({ ...p, time: INITIAL_EVOLVE }))
    particles.reset()
    particles._draw2d?.()
  }, [pauseSimulation, resetSimulation, particles])

  const handleReset = useCallback(() => {
    stopAndResetSimulation()
  }, [stopAndResetSimulation])

  const handleModeChange = useCallback(
    (nextMode) => {
      stopAndResetSimulation()
      setSimulationMode(nextMode)
    },
    [stopAndResetSimulation],
  )

  useEffect(() => {
    const onHash = () => setRoute(getRoute())
    window.addEventListener('hashchange', onHash)
    if (!window.location.hash) window.location.hash = '#/2d'
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
      }),
    [
      params.resolution,
      params.scale,
      params.octaves,
      params.strength,
      params.time,
      params.shapeOp,
      params.shapeAmount,
    ],
  )

  // Keep latest noise map on paramsRef for the rAF tick without re-binding the loop
  paramsRef.current = { ...params, _noiseMap: noiseMap }

  return (
    <div className="app-shell">
      <header className="brand-bar">
        <div className="brand-block">
          <p className="app-kicker">NOISE LAB / {ROUTE_LABEL[route] ?? '2D'}</p>
          <h1 className="brand-title">Noise Lab</h1>
        </div>

        <div className="page-tabs" role="tablist" aria-label="Views">
          <a
            role="tab"
            aria-selected={route === '2d'}
            className={route === '2d' ? 'is-active' : ''}
            href="#/2d"
          >
            2D MAP
          </a>
          <a
            role="tab"
            aria-selected={route === '3d'}
            className={route === '3d' ? 'is-active' : ''}
            href="#/3d"
          >
            3D WORLD
          </a>
          <a
            role="tab"
            aria-selected={route === 'sim'}
            className={route === 'sim' ? 'is-active' : ''}
            href="#/sim"
          >
            SIMULATION MAP
          </a>
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
            onReset={handleReset}
            particleSystem={particles}
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
