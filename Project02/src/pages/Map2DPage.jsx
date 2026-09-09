import EquationPanel from '../components/EquationPanel.jsx'
import NoiseMap2D from '../components/NoiseMap2D.jsx'
import ControlPanel from '../components/ControlPanel.jsx'

export default function Map2DPage({ params, onChange, noiseMap }) {
  return (
    <div className="page page-2d" role="tabpanel" aria-label="2D map view">
      <div className="page-body">
        <main className="viewport-2d" aria-label="2D curl noise map">
          <div className="pane pane-2d">
            <div className="pane-label">
              <span>FIELD / 2D MAP</span>
              <span className="pane-meta">
                {params.resolution}×{params.resolution}
              </span>
            </div>
            <NoiseMap2D className="map-2d" noiseMap={noiseMap} />
          </div>
          <EquationPanel />
        </main>
      </div>

      <ControlPanel mode="2d" params={params} onChange={onChange} />
    </div>
  )
}
