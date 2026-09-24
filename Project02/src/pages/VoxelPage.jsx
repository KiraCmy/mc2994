import { useEffect, useMemo, useRef, useState } from 'react'
import ViewDisplayBar from '../components/ViewDisplayBar.jsx'
import VoxelScene from '../components/VoxelScene.jsx'
import { evaluateDensity } from '../voxel/density.js'
import { CSG_PRESET_OPTIONS, CSG_PRESETS, applyCsgParams } from '../voxel/csgStack.js'
import {
  createChunkBlock,
  fillChunkBlock,
  markAllChunksDirty,
  remeshChunkBlock,
} from '../voxel/chunkManager.js'
import {
  DEFAULT_MESHER_ID,
  getVoxelMesher,
  VOXEL_MESHERS,
} from '../voxel/meshing/index.js'
import { formatMs, timeMs } from '../voxel/perf.js'
import { VOXEL_SHAPES } from '../voxel/shapes.js'

/**
 * Param ownership (Stage 2 choice):
 * Duplicate SCALE / OCTAVES / EVOLVE as voxel-prefixed *local* state on this page
 * (`voxelScale`, `voxelOctaves`, `voxelTime`). Do NOT read App.jsx `params` /
 * `DEFAULTS` for the Voxel tab yet — curl heightfield and voxel density stay
 * independently tunable. Lift into shared DEFAULTS only if a later stage needs
 * one slider to drive both instruments.
 */
const INITIAL = {
  gridSize: 16,
  voxelSize: 0.2,
  densityMode: 'ground',
  voxelScale: 1.2,
  voxelOctaves: 3,
  voxelTime: 0,
  voxelThreshold: 0,
  islandY: 0.15,
  islandWidth: 0.55,
  planetRadius: 1.05,
}

/** Slider-driven refill wait (Stage 8). Shape / CSG chips flush immediately. */
const REGEN_DEBOUNCE_MS = 80

function LocalSlider({ id, label, value, min, max, step, display, onChange }) {
  return (
    <div className="control-group">
      <div className="slider-label-row">
        <label htmlFor={id}>{label}</label>
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

export default function VoxelPage() {
  const [showAxis, setShowAxis] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [cameraResetNonce, setCameraResetNonce] = useState(0)

  const [gridSize, setGridSize] = useState(INITIAL.gridSize)
  const [voxelSize, setVoxelSize] = useState(INITIAL.voxelSize)
  const [densityMode, setDensityMode] = useState(INITIAL.densityMode)
  const [voxelScale, setVoxelScale] = useState(INITIAL.voxelScale)
  const [voxelOctaves, setVoxelOctaves] = useState(INITIAL.voxelOctaves)
  const [voxelTime, setVoxelTime] = useState(INITIAL.voxelTime)
  const [voxelThreshold, setVoxelThreshold] = useState(INITIAL.voxelThreshold)
  const [islandY, setIslandY] = useState(INITIAL.islandY)
  const [islandWidth, setIslandWidth] = useState(INITIAL.islandWidth)
  const [planetRadius, setPlanetRadius] = useState(INITIAL.planetRadius)
  const [csgPreset, setCsgPreset] = useState('none')
  const [smoothK, setSmoothK] = useState(0.4)
  const [displayMode, setDisplayMode] = useState('blocks')
  /** Stage 7 — mesher only; does not touch density settings / refill. */
  const [mesherId, setMesherId] = useState(DEFAULT_MESHER_ID)
  /** Bumped after density refill (BLOCKS) and after remesh (MESH). */
  const [fillRevision, setFillRevision] = useState(0)
  const [meshRevision, setMeshRevision] = useState(0)
  const [fillMs, setFillMs] = useState(null)
  const [meshMs, setMeshMs] = useState(null)
  const [meshTris, setMeshTris] = useState(0)
  const [meshQuads, setMeshQuads] = useState(null)
  const [chunkCount, setChunkCount] = useState(0)
  const [drawnChunkCount, setDrawnChunkCount] = useState(0)
  const viewBarRef = useRef(null)
  const flushKeyRef = useRef(null)

  const activeMesher = getVoxelMesher(mesherId)

  // Live control pack — UI reads this; density fill uses the debounced `regenPack`.
  const livePack = useMemo(
    () => ({
      gridSize,
      voxelSize,
      densityMode,
      csgPreset,
      smoothK,
      voxelScale,
      voxelOctaves,
      voxelTime,
      islandY,
      islandWidth,
      planetRadius,
    }),
    [
      gridSize,
      voxelSize,
      densityMode,
      csgPreset,
      smoothK,
      voxelScale,
      voxelOctaves,
      voxelTime,
      islandY,
      islandWidth,
      planetRadius,
    ],
  )

  /** Discrete chips — changing these skips the debounce. */
  const flushKey = `${densityMode}|${csgPreset}`

  const [regenPack, setRegenPack] = useState(livePack)

  useEffect(() => {
    const first = flushKeyRef.current === null
    const immediate = !first && flushKey !== flushKeyRef.current
    flushKeyRef.current = flushKey

    if (first) return

    if (immediate) {
      setRegenPack(livePack)
      return
    }

    const id = setTimeout(() => setRegenPack(livePack), REGEN_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [livePack, flushKey])

  const csgStack = useMemo(
    () =>
      applyCsgParams(CSG_PRESETS[regenPack.csgPreset] ?? CSG_PRESETS.none, {
        smoothK: regenPack.smoothK,
      }),
    [regenPack.csgPreset, regenPack.smoothK],
  )

  // Shared settings for evaluateDensity — filled from debounced / flushed pack only.
  const densitySettings = useMemo(
    () => ({
      mode: regenPack.densityMode,
      csgStack,
      scale: regenPack.voxelScale,
      octaves: regenPack.voxelOctaves,
      time: regenPack.voxelTime,
      heightAmp: 0.85,
      thresholdBias: 0.15,
      islandY: regenPack.islandY,
      islandWidth: regenPack.islandWidth,
      planetRadius: regenPack.planetRadius,
    }),
    [regenPack, csgStack],
  )

  // 2×2×2 chunk block — RESOLUTION ≈ 2 × chunkSize.
  const chunkSize = Math.max(4, Math.ceil(regenPack.gridSize / 2))
  const chunks = useMemo(
    () =>
      createChunkBlock({
        nx: 2,
        ny: 2,
        nz: 2,
        chunkSize,
        voxelSize: regenPack.voxelSize,
      }),
    [chunkSize, regenPack.voxelSize],
  )

  // Density refill — chunk block only (BLOCKS + MESH share these buffers).
  useEffect(() => {
    const densityFn = (p) => evaluateDensity(p, densitySettings)
    const filled = timeMs(() => {
      markAllChunksDirty(chunks)
      fillChunkBlock(chunks, densityFn)
    })
    setFillMs(filled.ms)
    setFillRevision((n) => n + 1)

    // eslint-disable-next-line no-console
    console.log(
      `[voxel perf] chunks=${chunks.length}×${chunkSize}³ fill=${filled.ms.toFixed(1)}ms`,
    )
  }, [chunks, densitySettings, chunkSize])

  // Remesh — skip empty chunks; threshold / mesher change remeshes without refill.
  useEffect(() => {
    if (fillRevision === 0) return
    markAllChunksDirty(chunks)
    const densityFn = (p) => evaluateDensity(p, densitySettings)
    const meshed = timeMs(() =>
      remeshChunkBlock(chunks, voxelThreshold, densityFn, {
        onlyDirty: true,
        mesherId,
      }),
    )
    const stats = meshed.result
    setMeshMs(meshed.ms)
    setMeshTris(stats.triangleCount)
    setMeshQuads(stats.quadCount)
    setChunkCount(stats.chunkCount)
    setDrawnChunkCount(stats.drawnCount)
    setMeshRevision((n) => n + 1)

    // eslint-disable-next-line no-console
    console.log(
      `[voxel perf] mesher=${mesherId} mesh=${meshed.ms.toFixed(1)}ms ` +
        `drawn=${stats.drawnCount}/${stats.chunkCount} tris=${stats.triangleCount}` +
        (stats.quadCount != null ? ` quads=${stats.quadCount}` : ''),
    )
    // densitySettings: halo fallback only; values already filled
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunks, fillRevision, voxelThreshold, mesherId])

  // Solid count across all chunks (render-time threshold).
  const solidCount = useMemo(() => {
    let n = 0
    for (const chunk of chunks) {
      for (let i = 0; i < chunk.values.length; i++) {
        if (chunk.values[i] > voxelThreshold) n++
      }
    }
    return n
  }, [chunks, voxelThreshold, fillRevision])

  return (
    <div className="page page-3d" role="tabpanel" aria-label="Voxel volume view">
      <div className="page-body page-body-3d">
        <main className="workspace-viz viewport-3d" aria-label="Voxel grid workspace">
          <div className="pane pane-3d pane-open">
            <ViewDisplayBar
              barRef={viewBarRef}
              modes={[
                { id: 'blocks', label: 'BLOCKS' },
                { id: 'mesh', label: 'MESH' },
              ]}
              modeId={displayMode}
              onModeChange={setDisplayMode}
              tools={[
                {
                  id: 'axis',
                  label: 'AXIS',
                  toggle: true,
                  active: showAxis,
                  onClick: () => setShowAxis((value) => !value),
                },
                {
                  id: 'grid',
                  label: 'GRID',
                  toggle: true,
                  active: showGrid,
                  onClick: () => setShowGrid((value) => !value),
                },
                {
                  id: 'reset',
                  label: 'RESET CAMERA',
                  onClick: () => setCameraResetNonce((value) => value + 1),
                },
              ]}
              end={
                <span className="pane-meta">
                  {chunkSize * 2}³ · {drawnChunkCount}/{chunkCount || chunks.length} chunks
                  {' · '}
                  fill {formatMs(fillMs)} · mesh {formatMs(meshMs)}
                  {meshTris > 0 ? ` · ${meshTris} tris` : ''}
                  {meshQuads != null ? ` · ${meshQuads} quads` : ''}
                  {' · '}
                  {displayMode === 'blocks'
                    ? `${solidCount} BLOCKS`
                    : activeMesher.label}
                </span>
              }
            />
            <div className="viz-stage">
              <VoxelScene
                chunks={chunks}
                threshold={voxelThreshold}
                revision={fillRevision + meshRevision}
                displayMode={displayMode}
                mesherId={mesherId}
                showAxis={showAxis}
                showGrid={showGrid}
                cameraResetNonce={cameraResetNonce}
              />
            </div>
          </div>
        </main>

        <aside className="control-panel" aria-label="Voxel controls">
          <div className="control-section">
            <p className="section-label">VOXEL GRID</p>
            <LocalSlider
              id="voxel-grid-size"
              label="RESOLUTION"
              value={gridSize}
              min={4}
              max={32}
              step={1}
              display={`${gridSize}³`}
              onChange={setGridSize}
            />
            <p className="control-placeholder">
              Volume is a 2×2×2 chunk block (empty chunks skip meshing). Drawn count
              shows in the view-bar meta as drawn/total.
            </p>
            <LocalSlider
              id="voxel-cell-size"
              label="VOXEL SIZE"
              value={voxelSize}
              min={0.08}
              max={0.4}
              step={0.01}
              display={voxelSize.toFixed(2)}
              onChange={setVoxelSize}
            />
          </div>

          <div className="control-section noise-type-section">
            <p className="section-label">SHAPE</p>
            <div className="noise-type-tags" role="radiogroup" aria-label="Voxel density shape">
              {VOXEL_SHAPES.map((shape) => (
                <button
                  key={shape.id}
                  type="button"
                  role="radio"
                  className={`noise-type-tag${densityMode === shape.id ? ' is-active' : ''}`}
                  aria-checked={densityMode === shape.id}
                  onClick={() => setDensityMode(shape.id)}
                >
                  {shape.tag}
                </button>
              ))}
            </div>
          </div>

          {densityMode === 'island' ? (
            <div className="control-section">
              <p className="section-label">ISLAND</p>
              <LocalSlider
                id="voxel-island-y"
                label="BAND Y"
                value={islandY}
                min={-1}
                max={1}
                step={0.05}
                display={islandY.toFixed(2)}
                onChange={setIslandY}
              />
              <LocalSlider
                id="voxel-island-width"
                label="BAND WIDTH"
                value={islandWidth}
                min={0.15}
                max={1.5}
                step={0.05}
                display={islandWidth.toFixed(2)}
                onChange={setIslandWidth}
              />
            </div>
          ) : null}

          {densityMode === 'planet' ? (
            <div className="control-section">
              <p className="section-label">PLANET</p>
              <LocalSlider
                id="voxel-planet-radius"
                label="RADIUS"
                value={planetRadius}
                min={0.4}
                max={1.8}
                step={0.05}
                display={planetRadius.toFixed(2)}
                onChange={setPlanetRadius}
              />
            </div>
          ) : null}

          <div className="control-section noise-type-section">
            <p className="section-label">CSG PRESET</p>
            <div className="noise-type-tags" role="radiogroup" aria-label="CSG presets">
              {CSG_PRESET_OPTIONS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  role="radio"
                  className={`noise-type-tag${csgPreset === preset.id ? ' is-active' : ''}`}
                  aria-checked={csgPreset === preset.id}
                  onClick={() => setCsgPreset(preset.id)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {csgPreset === 'smoothUnion' ? (
              <LocalSlider
                id="voxel-smooth-k"
                label="SMOOTH K"
                value={smoothK}
                min={0.05}
                max={1.2}
                step={0.05}
                display={smoothK.toFixed(2)}
                onChange={setSmoothK}
              />
            ) : null}
            <p className="control-placeholder">
              Same density field for both views — toggle BLOCKS / MESH in the view bar to
              A/B cubic voxels vs isosurface. Compare TWO BLOB UNION (hard) vs SMOOTH
              UNION (soft; raise K).
            </p>
          </div>

          <div className="control-section noise-type-section">
            <p className="section-label">MESHER</p>
            <div className="noise-type-tags" role="radiogroup" aria-label="Voxel mesher">
              {VOXEL_MESHERS.map((mesher) => (
                <button
                  key={mesher.id}
                  type="button"
                  role="radio"
                  className={`noise-type-tag${mesherId === mesher.id ? ' is-active' : ''}`}
                  aria-checked={mesherId === mesher.id}
                  onClick={() => setMesherId(mesher.id)}
                >
                  {mesher.label}
                </button>
              ))}
            </div>
            <p className="control-placeholder">
              Switches mesh method only — density / CSG / noise stay put. MESH view uses
              the selected mesher (MC smooth default; CULLED FACES = blocky quads).
            </p>
          </div>

          <div className="control-section">
            <p className="section-label">NOISE (VOXEL-LOCAL)</p>
            <LocalSlider
              id="voxel-scale"
              label="SCALE"
              value={voxelScale}
              min={0.2}
              max={4}
              step={0.05}
              display={voxelScale.toFixed(2)}
              onChange={setVoxelScale}
            />
            <LocalSlider
              id="voxel-octaves"
              label="OCTAVES"
              value={voxelOctaves}
              min={1}
              max={6}
              step={1}
              onChange={setVoxelOctaves}
            />
            <LocalSlider
              id="voxel-time"
              label="EVOLVE"
              value={voxelTime}
              min={0}
              max={8}
              step={0.05}
              display={voxelTime.toFixed(2)}
              onChange={setVoxelTime}
            />
            <LocalSlider
              id="voxel-threshold"
              label="THRESHOLD"
              value={voxelThreshold}
              min={-0.5}
              max={0.5}
              step={0.01}
              display={voxelThreshold.toFixed(2)}
              onChange={setVoxelThreshold}
            />
            <p className="control-placeholder">
              Threshold is render-only (instant). SCALE / OCTAVES / EVOLVE and other
              sliders debounce refill (~{REGEN_DEBOUNCE_MS}ms); SHAPE / CSG chips apply
              immediately.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
