import { useState } from 'react'
import SiteHud from '../SiteHud.jsx'
import { useAutoHideHeader } from '../useAutoHideHeader.js'
import Experiment01 from './Experiment01.jsx'
import {
  DEFAULT_PLAYGROUND_EXPERIMENT_ID,
  getPlaygroundExperiment,
  PLAYGROUND_EXPERIMENTS,
} from './experiments.js'
import './playground.css'

const EXPERIMENT_VIEWS = {
  '01': Experiment01,
}

export default function PlaygroundPage({ header }) {
  const { hidden, scrolled, scrollerRef } = useAutoHideHeader()
  const [activeId, setActiveId] = useState(DEFAULT_PLAYGROUND_EXPERIMENT_ID)

  const experiment = getPlaygroundExperiment(activeId)
  const View = EXPERIMENT_VIEWS[experiment.id] ?? Experiment01

  return (
    <div className="playground-page">
      <SiteHud
        className="playground-page__hud"
        hidden={hidden}
        scrolled={scrolled}
      >
        {header}
        <div
          className="hud-study-modes playground-page__tabs"
          role="tablist"
          aria-label="Playground experiments"
        >
          {PLAYGROUND_EXPERIMENTS.map((item) => {
            const active = item.id === experiment.id
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`hud-study-mode-item${active ? ' is-active' : ''}`}
                onClick={() => setActiveId(item.id)}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </SiteHud>

      <main className="playground-page__content" ref={scrollerRef}>
        <View title={experiment.title} description={experiment.description} />
      </main>
    </div>
  )
}
