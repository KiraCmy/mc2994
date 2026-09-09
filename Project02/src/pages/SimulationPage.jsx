import ControlPanel from '../components/ControlPanel.jsx'
import WindFieldCanvas from '../components/WindFieldCanvas.jsx'
import ParticleFlowCanvas from '../components/ParticleFlowCanvas.jsx'
import SimulationScene3D from '../components/SimulationScene3D.jsx'
import { SIMULATION_MODES } from '../simulation/simulationModes.js'

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
  onReset,
  particleSystem,
  simView,
  onSimViewChange,
}) {
  const { status, simTime, stepCount, start, pause } = simulation
  const set = (key) => (value) => onChange({ ...params, [key]: value })
  const showParticles = simulationMode === 'particle'
  const showWind = simulationMode === 'wind'
  const showErosion = simulationMode === 'erosion'

  return (
    <div className="page page-simulation" role="tabpanel" aria-label="Simulation map view">
      <div className="page-body">
        <main className="viewport-simulation" aria-label="Simulation map">
          <div className="pane pane-simulation">
            <div className="pane-label">
              <span>FIELD / SIMULATION MAP</span>
              <span className="pane-meta">
                {simView.toUpperCase()} · {status.toUpperCase()} · STEP {stepCount}
              </span>
            </div>

            <div className="simulation-layout">
              <div className="simulation-viz">
                {showErosion ? (
                  <div className="simulation-placeholder">
                    <p className="sim-readout-note">HYDRAULIC EROSION — not implemented yet.</p>
                  </div>
                ) : simView === '3d' ? (
                  <div className="sim-3d-wrap">
                    <SimulationScene3D
                      mode={simulationMode}
                      noiseMap={noiseMap}
                      params={params}
                      particleSystem={particleSystem}
                    />
                  </div>
                ) : showWind ? (
                  <WindFieldCanvas
                    className="wind-field"
                    noiseMap={noiseMap}
                    windStrength={params.windStrength}
                    vectorDensity={params.vectorDensity}
                  />
                ) : showParticles ? (
                  <ParticleFlowCanvas
                    className="particle-field"
                    particleSystem={particleSystem}
                    particleCount={params.particleCount}
                    particleSize={params.particleSize}
                    trailLength={params.trailLength}
                  />
                ) : null}
              </div>

              <aside className="simulation-controls">
                <div className="control-group">
                  <div className="slider-label-row">
                    <label htmlFor="sim-mode">MODE</label>
                    <span>{SIMULATION_MODES.find((m) => m.id === simulationMode)?.label}</span>
                  </div>
                  <select
                    id="sim-mode"
                    className="shape-select"
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

                <div className="view-tools sim-view-tools">
                  <button
                    type="button"
                    className={`tool-toggle${simView === '2d' ? ' is-active' : ''}`}
                    aria-pressed={simView === '2d'}
                    onClick={() => onSimViewChange('2d')}
                  >
                    VIEW 2D
                  </button>
                  <button
                    type="button"
                    className={`tool-toggle${simView === '3d' ? ' is-active' : ''}`}
                    aria-pressed={simView === '3d'}
                    onClick={() => onSimViewChange('3d')}
                    disabled={showErosion}
                  >
                    VIEW 3D
                  </button>
                </div>

                <div className="simulation-transport">
                  <button
                    type="button"
                    className={`tool-toggle${status === 'running' ? ' is-active' : ''}`}
                    onClick={start}
                    disabled={status === 'running' || showErosion}
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
                  {showParticles ? (
                    <p className="sim-readout-note">
                      Particles ride the shared curl wind field. Press START to animate.
                    </p>
                  ) : null}
                </div>

                {showWind ? (
                  <div className="wind-controls">
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
                  <div className="wind-controls">
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
              </aside>
            </div>
          </div>
        </main>
      </div>

      <ControlPanel mode="2d" params={params} onChange={onChange} />
    </div>
  )
}
