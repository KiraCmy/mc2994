import { useCallback, useRef, useState } from 'react'
import ControlPanel from '../components/ControlPanel.jsx'
import WindFieldCanvas from '../components/WindFieldCanvas.jsx'
import ParticleFlowCanvas from '../components/ParticleFlowCanvas.jsx'
import NoiseMap2D from '../components/NoiseMap2D.jsx'
import ErosionHeightCanvas from '../components/ErosionHeightCanvas.jsx'
import SimulationScene3D from '../components/SimulationScene3D.jsx'
import ViewDisplayBar from '../components/ViewDisplayBar.jsx'
import ViewportExportMenu, {
  EXPORT_OPTIONS_SCREENSHOT,
} from '../components/ViewportExportMenu.jsx'
import { SIMULATION_MODES } from '../simulation/simulationModes.js'

const BACKGROUND_VIEWS = [
  { id: 'particles', label: 'PARTICLES ONLY', shortLabel: 'PARTICLES' },
  { id: 'map', label: 'PARTICLES + 2D MAP', shortLabel: '+ 2D MAP' },
]

const SIM_VIEWS = [
  { id: '2d', label: '2D FIELD' },
  { id: '3d', label: '3D FIELD' },
]

function ParamSlider({ id, label, tip, value, min, max, step, display, onChange }) {
  return (
    <div className="control-group">
      <div className="slider-label-row">
        <label htmlFor={id} className="tip-label" title={tip}>
          <span className="tip-word">{label}</span>
        </label>
        <span>{display ?? value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

export default function SimulationPage({
  params,
  onChange,
  noiseMap,
  simulationMode,
  onSimulationModeChange,
  simulation,
  onStart,
  onReset,
  particleSystem,
  erosionTerrain,
  raindropSystem,
  erosionVersion = 0,
  simView,
  onSimViewChange,
}) {
  const { status, simTime, stepCount, pause } = simulation
  const set = (key) => (value) => onChange({ ...params, [key]: value })
  const [backgroundView, setBackgroundView] = useState('particles')
  const captureApiRef = useRef(null)
  const capturePng = useCallback(() => captureApiRef.current?.capturePng?.() ?? null, [])
  const showParticles = simulationMode === 'particle'
  const showWind = simulationMode === 'wind'
  const showErosion = simulationMode === 'erosion'
  const erosionReady = showErosion && erosionTerrain?.isReady()
  const showGeometry = simView === '3d'
  const showMapBackground = showParticles && simView === '2d' && backgroundView === 'map'

  const viewModes = SIM_VIEWS.map((view) => ({
    ...view,
  }))

  const backgroundTools =
    showParticles && simView === '2d'
      ? BACKGROUND_VIEWS.map((view) => ({
          id: view.id,
          label: view.shortLabel,
          toggle: true,
          active: backgroundView === view.id,
          onClick: () => setBackgroundView(view.id),
        }))
      : []

  return (
    <div className="page page-simulation" role="tabpanel" aria-label="Simulation map view">
      <div className="page-body">
        <main className="workspace-viz" aria-label="Simulation map">
          <div className="pane pane-simulation pane-open">
            <ViewDisplayBar
              modes={viewModes}
              modeId={simView}
              onModeChange={onSimViewChange}
              tools={backgroundTools}
              end={
                <span className="pane-meta">
                  <span className={`pane-status${status === 'running' ? ' is-running' : ''}`}>
                    {status.toUpperCase()}
                  </span>
                  <span className="pane-meta-sep">·</span>
                  <span>STEP {stepCount}</span>
                </span>
              }
            />

            <div className="viz-stage simulation-viz">
              {simView === '3d' ? (
                <div className="sim-3d-wrap">
                  <ViewportExportMenu
                    noiseMap={noiseMap}
                    displace={params.displace}
                    gridScale={params.gridScale}
                    capturePng={capturePng}
                    options={EXPORT_OPTIONS_SCREENSHOT}
                    filePrefix="sim-3d"
                  />
                  {showErosion && !erosionReady ? (
                    <div className="simulation-placeholder">
                      <p className="sim-readout-note">
                        HYDRAULIC EROSION — press START to copy the current noise height map into
                        a separate simulation terrain.
                      </p>
                    </div>
                  ) : (
                    <SimulationScene3D
                      mode={simulationMode}
                      noiseMap={noiseMap}
                      params={params}
                      particleSystem={particleSystem}
                      captureApiRef={captureApiRef}
                      erosionTerrain={erosionTerrain}
                      raindropSystem={raindropSystem}
                      erosionVersion={erosionVersion}
                    />
                  )}
                </div>
              ) : showErosion ? (
                erosionReady ? (
                  <ErosionHeightCanvas
                    className="erosion-field"
                    erosionTerrain={erosionTerrain}
                    version={erosionVersion}
                  />
                ) : (
                  <div className="simulation-placeholder">
                    <p className="sim-readout-note">
                      HYDRAULIC EROSION — press START to copy the current noise height map into a
                      separate simulation terrain. The shared noise map stays unchanged.
                    </p>
                  </div>
                )
              ) : showWind ? (
                <WindFieldCanvas
                  className="wind-field"
                  noiseMap={noiseMap}
                  windStrength={params.windStrength}
                  vectorDensity={params.vectorDensity}
                />
              ) : showParticles ? (
                <div className={`particle-stack${showMapBackground ? ' has-map-bg' : ''}`}>
                  {showMapBackground ? (
                    <NoiseMap2D className="particle-map-bg" noiseMap={noiseMap} />
                  ) : null}
                  <ParticleFlowCanvas
                    className="particle-field"
                    particleSystem={particleSystem}
                    particleCount={params.particleCount}
                    particleSize={params.particleSize}
                    trailLength={params.trailLength}
                    overMap={showMapBackground}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </main>

        <ControlPanel
          mode="sim"
          params={params}
          onChange={onChange}
          showGeometry={showGeometry}
          lead={
            <div className="control-section simulation-controls simulation-controls-lead">
              <p className="section-label">SIMULATION</p>
              <div className="control-group">
                <div className="slider-label-row">
                  <label htmlFor="sim-mode">MODE</label>
                  <span>{SIMULATION_MODES.find((m) => m.id === simulationMode)?.label}</span>
                </div>
                <select
                  id="sim-mode"
                  className="sim-mode-select"
                  value={simulationMode}
                  onChange={(e) => onSimulationModeChange(e.target.value)}
                >
                  {SIMULATION_MODES.map((mode) => (
                    <option key={mode.id} value={mode.id}>
                      {mode.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="simulation-transport">
                <button
                  type="button"
                  className={`tool-toggle is-primary${status === 'running' ? ' is-active' : ''}`}
                  onClick={onStart}
                  disabled={status === 'running'}
                >
                  START
                </button>
                <button
                  type="button"
                  className="tool-toggle"
                  onClick={pause}
                  disabled={status !== 'running'}
                >
                  PAUSE
                </button>
                <button type="button" className="tool-toggle" onClick={onReset}>
                  RESET
                </button>
              </div>

              <div className="simulation-readout">
                <p className="sim-readout-line">
                  <span>TIME</span>
                  <span className="sim-readout-value">{simTime.toFixed(3)} s</span>
                </p>
                <p className="sim-readout-line">
                  <span>STEPS</span>
                  <span className="sim-readout-value">{stepCount}</span>
                </p>
                <p className="sim-readout-line">
                  <span>EVOLVE</span>
                  <span className="sim-readout-value">{params.time.toFixed(2)}</span>
                </p>
                {showErosion ? (
                  <p className="sim-readout-line">
                    <span>TERRAIN</span>
                    <span className="sim-readout-value">
                      {erosionReady
                        ? `${erosionTerrain.getResolution()}×${erosionTerrain.getResolution()} COPY`
                        : 'NOT COPIED'}
                    </span>
                  </p>
                ) : null}
                {showParticles ? (
                  <p className="sim-readout-note">
                    Particles ride the shared curl wind field. Press START to animate.
                  </p>
                ) : null}
                {showErosion ? (
                  <p className="sim-readout-note">
                    Continuous rain falls in the 3D view and soaks into the ground over time. The 2D
                    field shows the carved height map only. The original noise map stays untouched.
                  </p>
                ) : null}
              </div>
            </div>
          }
        >
          {showErosion ? (
            <div className="control-section wind-controls">
              <p className="section-label">HYDRAULIC EROSION</p>
              <ParamSlider
                id="rain-amount"
                label="RAIN AMOUNT"
                tip="Number of raindrop particles moving downhill on the height field."
                value={params.rainAmount}
                min={10}
                max={800}
                step={10}
                onChange={set('rainAmount')}
              />
              <ParamSlider
                id="erosion-rate"
                label="EROSION RATE"
                tip="Sediment entrainment strength. Higher values carve clearer channels faster."
                value={params.erosionRate}
                min={0.3}
                max={3}
                step={0.05}
                display={params.erosionRate.toFixed(2)}
                onChange={set('erosionRate')}
              />
            </div>
          ) : null}

          {showWind ? (
            <div className="control-section wind-controls">
              <p className="section-label">WIND FIELD</p>
              <ParamSlider
                id="wind-strength"
                label="WIND STRENGTH"
                tip="Scales vector length and brightness from the shared curl field."
                value={params.windStrength}
                min={0.1}
                max={3}
                step={0.05}
                display={params.windStrength.toFixed(2)}
                onChange={set('windStrength')}
              />
              <ParamSlider
                id="evolution-speed"
                label="EVOLUTION SPEED"
                tip="How fast Evolve advances while the simulation is running."
                value={params.evolutionSpeed}
                min={0}
                max={2}
                step={0.01}
                display={params.evolutionSpeed.toFixed(2)}
                onChange={set('evolutionSpeed')}
              />
              <ParamSlider
                id="vector-density"
                label="VECTOR DENSITY"
                tip="Number of directional samples drawn across the field."
                value={params.vectorDensity}
                min={8}
                max={48}
                step={1}
                onChange={set('vectorDensity')}
              />
            </div>
          ) : null}

          {showParticles ? (
            <div className="control-section wind-controls">
              <p className="section-label">PARTICLE FLOW</p>
              <ParamSlider
                id="particle-count"
                label="PARTICLE COUNT"
                tip="Number of particles advected by the curl wind field."
                value={params.particleCount}
                min={50}
                max={2000}
                step={10}
                onChange={set('particleCount')}
              />
              <ParamSlider
                id="particle-speed"
                label="SPEED"
                tip="How fast particles travel along local wind vectors."
                value={params.particleSpeed}
                min={0.05}
                max={3}
                step={0.05}
                display={params.particleSpeed.toFixed(2)}
                onChange={set('particleSpeed')}
              />
              <ParamSlider
                id="particle-size"
                label="PARTICLE SIZE"
                tip="Drawn size of each particle."
                value={params.particleSize}
                min={0.5}
                max={4}
                step={0.1}
                display={params.particleSize.toFixed(1)}
                onChange={set('particleSize')}
              />
              <ParamSlider
                id="trail-length"
                label="TRAIL LENGTH"
                tip="How long motion trails persist in the 2D view."
                value={params.trailLength}
                min={0}
                max={1}
                step={0.01}
                display={params.trailLength.toFixed(2)}
                onChange={set('trailLength')}
              />
            </div>
          ) : null}

          {showParticles ? (
            <div className="control-section background-view-section">
              <p className="section-label">BACKGROUND VIEW</p>
              <div className="noise-type-tags" role="listbox" aria-label="Background view">
                {BACKGROUND_VIEWS.map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    role="option"
                    aria-selected={backgroundView === view.id}
                    className={`noise-type-tag${backgroundView === view.id ? ' is-active' : ''}`}
                    onClick={() => setBackgroundView(view.id)}
                  >
                    {view.label === 'PARTICLES ONLY' ? '#particles' : '#particles+map'}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </ControlPanel>
      </div>
    </div>
  )
}
