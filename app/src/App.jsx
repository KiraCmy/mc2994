import { useState } from 'react'
import SceneCanvas from './SceneCanvas.jsx'
import ControlBar from './ControlBar.jsx'
import { DEFAULT_LAYER_PARAMS } from './generateLayerPlanes.js'
import './App.css'

function App() {
  const [params, setParams] = useState(DEFAULT_LAYER_PARAMS)

  return (
    <div className="app-shell">
      <SceneCanvas params={params} />
      <header className="app-header">
        <p className="app-kicker">Generative</p>
        <h1>mc2994</h1>
      </header>
      <ControlBar params={params} onChange={setParams} />
    </div>
  )
}

export default App
