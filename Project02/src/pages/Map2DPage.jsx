import { useCallback, useRef, useState } from 'react'
import EquationPanel from '../components/EquationPanel.jsx'
import NoiseMap2D from '../components/NoiseMap2D.jsx'
import ControlPanel from '../components/ControlPanel.jsx'
import ViewDisplayBar from '../components/ViewDisplayBar.jsx'
import ViewportExportMenu, {
  EXPORT_OPTIONS_SCREENSHOT,
} from '../components/ViewportExportMenu.jsx'

const DISPLAY_MODES = [
  { id: 'dots', label: 'DOT FIELD' },
  { id: 'height', label: 'HEIGHT MAP' },
]

export default function Map2DPage({ params, onChange, noiseMap }) {
  const [displayMode, setDisplayMode] = useState('dots')
  const captureApiRef = useRef(null)
  const capturePng = useCallback(() => captureApiRef.current?.capturePng?.() ?? null, [])
  const modeLabel = DISPLAY_MODES.find((mode) => mode.id === displayMode)?.label ?? 'DOT FIELD'

  return (
    <div className="page page-2d" role="tabpanel" aria-label="2D map view">
      <div className="page-body">
        <main className="workspace-viz" aria-label="2D curl noise map">
          <div className="pane pane-2d pane-open">
            <ViewDisplayBar
              modes={DISPLAY_MODES}
              modeId={displayMode}
              onModeChange={setDisplayMode}
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
                options={EXPORT_OPTIONS_SCREENSHOT}
                filePrefix="2d-map"
              />
              <NoiseMap2D
                className="map-2d"
                noiseMap={noiseMap}
                captureApiRef={captureApiRef}
                displayMode={displayMode}
              />
            </div>
          </div>
        </main>

        <ControlPanel mode="2d" params={params} onChange={onChange}>
          <EquationPanel />
        </ControlPanel>
      </div>
    </div>
  )
}
