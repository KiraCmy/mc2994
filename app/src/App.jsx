import { useState } from 'react'
import SceneCanvas from './SceneCanvas.jsx'
import ControlBar from './ControlBar.jsx'
import { DEFAULT_THEME_ID, THEMES } from './themes.js'
import './App.css'

function App() {
  const [spikes, setSpikes] = useState(14)
  const [hue, setHue] = useState(200)
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID)
  const theme = THEMES[themeId] ?? THEMES.midnight

  return (
    <div
      className="app-shell"
      data-theme={themeId}
      style={{
        '--panel-bg': theme.panel,
        '--panel-border': theme.panelBorder,
        '--ui-text': theme.text,
        '--ui-muted': theme.muted,
        '--ui-accent': theme.accent,
        '--scene-bg': theme.background,
      }}
    >
      <SceneCanvas spikes={spikes} hue={hue} themeId={themeId} />
      <header className="app-header">
        <p className="app-kicker">Interactive scene</p>
        <h1>mc2994</h1>
      </header>
      <ControlBar
        spikes={spikes}
        hue={hue}
        themeId={themeId}
        onSpikesChange={setSpikes}
        onHueChange={setHue}
        onThemeChange={setThemeId}
      />
    </div>
  )
}

export default App
