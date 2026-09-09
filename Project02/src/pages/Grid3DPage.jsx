import { useState } from 'react'
import GridScene3D from '../components/GridScene3D.jsx'
import FloatingMapWindow from '../components/FloatingMapWindow.jsx'
import ControlPanel from '../components/ControlPanel.jsx'

export default function Grid3DPage({ params, onChange, noiseMap }) {
  const [mapOpen, setMapOpen] = useState(true)
  const [renderMode, setRenderMode] = useState('solid') // 'solid' | 'line'

  return (
    <div className="page page-3d" role="tabpanel" aria-label="3D world view">
      <div className="page-body page-body-3d">
        <div className="view-tools">
          <button
            type="button"
            className={`tool-toggle${mapOpen ? ' is-active' : ''}`}
            aria-pressed={mapOpen}
            onClick={() => setMapOpen((v) => !v)}
          >
            2D MAP
          </button>
          <button
            type="button"
            className={`tool-toggle${renderMode === 'line' ? ' is-active' : ''}`}
            aria-pressed={renderMode === 'line'}
            onClick={() => setRenderMode((m) => (m === 'line' ? 'solid' : 'line'))}
          >
            {renderMode === 'line' ? 'LINE' : 'SOLID'}
          </button>
        </div>

        <main className="viewport-single viewport-3d" aria-label="3D height field from 2D noise map">
          <div className="pane pane-3d">
            <div className="pane-label">
              <span>FIELD / 3D HEIGHT</span>
              <span className="pane-meta">
                MAP {params.resolution}×{params.resolution} → {renderMode.toUpperCase()}
              </span>
            </div>
            <GridScene3D
              noiseMap={noiseMap}
              displace={params.displace}
              gridScale={params.gridScale}
              wireframe={renderMode === 'line'}
            />
          </div>
        </main>

        <FloatingMapWindow
          open={mapOpen}
          onClose={() => setMapOpen(false)}
          noiseMap={noiseMap}
          resolution={params.resolution}
        />
      </div>

      <ControlPanel mode="3d" params={params} onChange={onChange} />
    </div>
  )
}
