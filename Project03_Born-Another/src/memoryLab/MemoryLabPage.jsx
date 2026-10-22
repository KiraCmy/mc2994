import { useCallback, useEffect, useState } from 'react'
import SiteHeader from '../SiteHeader.jsx'
import SiteHud from '../SiteHud.jsx'
import { TRANSITION_DURATION, WorldViewport } from '../worldv2/WorldViewport.jsx'
import { useLifeEngine } from '../worldv2/life/useLifeEngine.js'
import { WORLD_V2_SEED } from '../worldv2/worldGeometry.js'
import '../worldv2/worldV2.css'
import {
  DEFAULT_MEMORY_SIGNATURE,
  DEFAULT_MEMORY_TEXT,
  generateMockMemorySignature,
} from './generateMockMemorySignature.js'
import { mapMemoryToWorldParameters } from './mapMemoryToWorldParameters.js'
import './memoryLab.css'

/** Color-Graded = World D — Shader; Original = World B — Dark. */
const VISUAL_GRADED = 'shader'
const VISUAL_ORIGINAL = 'dark'

export default function MemoryLabPage({ modeId, onSelectMode }) {
  const [memoryText, setMemoryText] = useState(DEFAULT_MEMORY_TEXT)
  const [signature, setSignature] = useState(null)
  const [mappingDebug, setMappingDebug] = useState(null)
  const [generated, setGenerated] = useState(false)
  const [debugOpen, setDebugOpen] = useState(false)
  const [visualMode, setVisualMode] = useState(VISUAL_GRADED)
  const [view, setView] = useState('exterior')

  const {
    life,
    playing,
    togglePlaying,
    startLife,
    addStimulus,
    setPlaying,
  } = useLifeEngine(WORLD_V2_SEED)

  const transitioning = view === 'entering' || view === 'exiting'
  const backgroundStudy = visualMode

  useEffect(() => {
    if (!transitioning) return undefined
    const destination = view === 'entering' ? 'interior' : 'exterior'
    const timer = window.setTimeout(
      () => setView(destination),
      TRANSITION_DURATION * 1000,
    )
    return () => window.clearTimeout(timer)
  }, [transitioning, view])

  // Idle MEMORY LAB: keep life paused until Generate Life.
  useEffect(() => {
    if (!generated) setPlaying(false)
  }, [generated, setPlaying])

  const resetCameraView = useCallback(() => {
    setView('exterior')
  }, [])

  const handleGenerate = () => {
    const nextSignature = generateMockMemorySignature(memoryText)
    const worldParams = mapMemoryToWorldParameters(nextSignature, memoryText)
    setSignature(nextSignature)
    setMappingDebug(worldParams.debugMapping)
    setView('exterior')
    startLife({
      seed: worldParams.seed,
      durationSeconds: worldParams.durationSeconds,
      history: worldParams.history,
    })
    setGenerated(true)
  }

  const handleReset = () => {
    setMemoryText(DEFAULT_MEMORY_TEXT)
    setSignature(null)
    setMappingDebug(null)
    setGenerated(false)
    setDebugOpen(false)
    setVisualMode(VISUAL_GRADED)
    setView('exterior')
    setPlaying(false)
  }

  const shellClass = [
    'memory-lab',
    visualMode === VISUAL_GRADED ? 'memory-lab--graded' : 'memory-lab--original',
  ].join(' ')

  return (
    <main className={shellClass}>
      <SiteHud className="memory-lab__hud">
        <SiteHeader modeId={modeId} onSelectMode={onSelectMode} />
      </SiteHud>

      <div className="memory-lab__body">
        <section className="memory-lab__panel" aria-label="Memory input">
          <p className="memory-lab__eyebrow">Memory Lab · Step 01</p>
          <h1 className="memory-lab__title">Memory-driven life</h1>
          <p className="memory-lab__hint">
            Enter a personal memory. Generate Life maps it to the existing World
            organism — geometry and growth, not emotion-as-color.
          </p>

          <label className="memory-lab__label" htmlFor="memory-lab-text">
            Memory
          </label>
          <textarea
            id="memory-lab-text"
            className="memory-lab__textarea"
            value={memoryText}
            onChange={(event) => setMemoryText(event.target.value)}
            rows={7}
            spellCheck
          />

          <div className="memory-lab__actions">
            <button
              type="button"
              className="memory-lab__button memory-lab__button--primary"
              onClick={handleGenerate}
            >
              Generate Life
            </button>
            <button
              type="button"
              className="memory-lab__button"
              onClick={handleReset}
            >
              Reset
            </button>
          </div>

          <div className="memory-lab__debug">
            <p className="memory-lab__label">Visual mode (debug)</p>
            <div className="memory-lab__mode-toggle" role="group">
              <button
                type="button"
                className={visualMode === VISUAL_ORIGINAL ? 'is-active' : ''}
                aria-pressed={visualMode === VISUAL_ORIGINAL}
                onClick={() => setVisualMode(VISUAL_ORIGINAL)}
              >
                Original
              </button>
              <button
                type="button"
                className={visualMode === VISUAL_GRADED ? 'is-active' : ''}
                aria-pressed={visualMode === VISUAL_GRADED}
                onClick={() => setVisualMode(VISUAL_GRADED)}
              >
                Color-Graded
              </button>
            </div>
          </div>

          <div className="memory-lab__debug">
            <button
              type="button"
              className="memory-lab__debug-toggle"
              aria-expanded={debugOpen}
              onClick={() => setDebugOpen((open) => !open)}
            >
              {debugOpen ? '− Memory Signature' : '+ Memory Signature'}
            </button>
            {debugOpen ? (
              <div className="memory-lab__debug-body">
                <pre>
                  {JSON.stringify(
                    signature ?? {
                      note: 'Generate Life to compute signature',
                      defaultReference: DEFAULT_MEMORY_SIGNATURE,
                    },
                    null,
                    2,
                  )}
                </pre>
                {mappingDebug ? (
                  <pre>{JSON.stringify(mappingDebug, null, 2)}</pre>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <section className="memory-lab__viewer" aria-label="Organism viewer">
          {generated ? (
            <>
              <WorldViewport
                className="memory-lab__viewport"
                view={view}
                life={life}
                onStimulus={addStimulus}
                backgroundStudy={backgroundStudy}
                onCameraReset={resetCameraView}
              />
              <div className="memory-lab__viewer-hud">
                <p className="memory-lab__chip">
                  Age {life.age.toFixed(3)} · Seed {life.seed}
                </p>
                <p className="memory-lab__chip">
                  <button type="button" onClick={togglePlaying}>
                    {life.dead ? 'Ended' : playing ? 'Pause' : 'Play'}
                  </button>
                </p>
                <p className="memory-lab__chip">
                  <button
                    type="button"
                    disabled={transitioning}
                    onClick={() => {
                      if (transitioning) return
                      setView(view === 'exterior' ? 'entering' : 'exiting')
                    }}
                  >
                    {view === 'interior' || view === 'exiting'
                      ? 'Exit'
                      : 'Enter'}
                  </button>
                </p>
              </div>
            </>
          ) : (
            <p className="memory-lab__viewer-empty">
              Press Generate Life to begin a World organism from this memory.
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
