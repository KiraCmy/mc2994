import { useState } from 'react'
import SceneCanvas from './SceneCanvas.jsx'
import ControlBar from './ControlBar.jsx'
import './App.css'

function App() {
  const [subdivision, setSubdivision] = useState(2)

  return (
    <div className="app-shell">
      <SceneCanvas subdivision={subdivision} />
      <header className="app-header">
        <p className="app-kicker">Scene</p>
        <h1>mc2994</h1>
      </header>
      <ControlBar subdivision={subdivision} onSubdivisionChange={setSubdivision} />
    </div>
  )
}

export default App
