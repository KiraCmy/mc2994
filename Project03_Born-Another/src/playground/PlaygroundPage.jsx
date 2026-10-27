import { useState } from 'react'
import SiteHud from '../SiteHud.jsx'
import { useAutoHideHeader } from '../useAutoHideHeader.js'
import Experiment01 from './Experiment01.jsx'
import Experiment02 from './Experiment02.jsx'
import Experiment03 from './Experiment03.jsx'
import Experiment04 from './Experiment04.jsx'
import Experiment05 from './Experiment05.jsx'
import {
  DEFAULT_PLAYGROUND_EXPERIMENT_ID,
  getPlaygroundExperiment,
  PLAYGROUND_EXPERIMENTS,
} from './experiments.js'
import './playground.css'

const EXPERIMENT_VIEWS = {
  '01': Experiment01,
  '02': Experiment02,
  '03': Experiment03,
  '04': Experiment04,
  '05': Experiment05,
}

export default function PlaygroundPage({ header }) {
  const { hidden, scrolled, scrollerRef } = useAutoHideHeader()
  const [activeId, setActiveId] = useState(DEFAULT_PLAYGROUND_EXPERIMENT_ID)

  const experiment = getPlaygroundExperiment(activeId)
  const View = EXPERIMENT_VIEWS[experiment.id] ?? Experiment01

  const isExp05 = experiment.id === '05'

  return (
    <div
      className={`playground-page${isExp05 ? ' playground-page--exp05' : ''}`}
    >
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
