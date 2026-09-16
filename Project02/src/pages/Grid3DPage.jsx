import { useCallback, useRef, useState } from 'react'
import GridScene3D from '../components/GridScene3D.jsx'
import FloatingMapWindow from '../components/FloatingMapWindow.jsx'
import ControlPanel from '../components/ControlPanel.jsx'
import ViewDisplayBar from '../components/ViewDisplayBar.jsx'
import ViewportExportMenu, {
  EXPORT_OPTIONS_FULL,
} from '../components/ViewportExportMenu.jsx'

const DISPLAY_MODES = [
  { id: 'solid', label: 'SOLID' },
  { id: 'wireframe', label: 'WIREFRAME' },
  { id: 'solid-wire', label: 'SOLID + WIREFRAME' },
]

export default function Grid3DPage({ params, onChange, noiseMap }) {
  const [mapOpen, setMapOpen] = useState(true)
  const [renderMode, setRenderMode] = useState('solid')
  const [showAxis, setShowAxis] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [cameraResetNonce, setCameraResetNonce] = useState(0)
  const viewBarRef = useRef(null)
  const captureApiRef = useRef(null)
  const modeLabel = DISPLAY_MODES.find((mode) => mode.id === renderMode)?.label ?? 'SOLID'

  const capturePng = useCallback(() => captureApiRef.current?.capturePng?.() ?? null, [])

  return (
    <div className="page page-3d" role="tabpanel" aria-label="3D world view">
      <div className="page-body page-body-3d">
        <main className="workspace-viz viewport-3d" aria-label="3D height field from 2D noise map">
          <div className="pane pane-3d pane-open">
            <ViewDisplayBar
              barRef={viewBarRef}
              modes={DISPLAY_MODES}
              modeId={renderMode}
              onModeChange={setRenderMode}
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
                {
                  id: 'map',
                  label: '2D PREVIEW',
                  toggle: true,
                  active: mapOpen,
                  onClick: () => setMapOpen((value) => !value),
                },
              ]}
              end={
                <span className="pane-meta">
                  {params.resolution}×{params.resolution} · {modeLabel}
                </span>
              }
            />
            <div className="viz-stage">
              <ViewportExportMenu
                noiseMap={noiseMap}
                displace={params.displace}
                gridScale={params.gridScale}
                capturePng={capturePng}
                options={EXPORT_OPTIONS_FULL}
                filePrefix="3d-world"
              />
              <GridScene3D
                noiseMap={noiseMap}
                displace={params.displace}
                gridScale={params.gridScale}
                displayMode={renderMode}
                showAxis={showAxis}
                showGrid={showGrid}
                cameraResetNonce={cameraResetNonce}
                captureApiRef={captureApiRef}
              />
            </div>
          </div>
        </main>

        <FloatingMapWindow
          open={mapOpen}
          onClose={() => setMapOpen(false)}
          noiseMap={noiseMap}
          resolution={params.resolution}
          anchorRef={viewBarRef}
        />

        <ControlPanel mode="3d" params={params} onChange={onChange} />
      </div>
    </div>
  )
}
