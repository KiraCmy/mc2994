import { useCallback, useEffect, useState } from 'react'
import { useLifeEngine } from '../worldv2/life/useLifeEngine.js'
import CrystalAgentInspector from './agentBehaviors/CrystalAgentInspector.jsx'
import CrystalAgentsStaticScene from './agentBehaviors/CrystalAgentsStaticScene.jsx'
import { useCrystalAgentSim } from './agentBehaviors/useCrystalAgentSim.js'
import { CRYSTAL_AGENT_DEFAULTS } from './agentBehaviors/crystalAgentTypes.js'
import {
  EXP05_LIFE_SEED,
  EXP05_OBSERVE_AGE,
} from './finalForm/exploreLifeAdapter.js'
import {
  EXP05_COMPOSITION_MODES,
  EXP05_LAB_DEFAULTS,
  normalizeExp05LabParams,
} from './finalForm/exp05LabParams.js'

const STUDIES = [
  {
    id: 'crystal-agents',
    label: 'Study 01',
    title: 'Crystal Agents',
    status: 'active',
    blurb:
      'Autonomous crystal growth agents on the Exp05 membrane — FSM + moisture.',
  },
  {
    id: 'organism-agents',
    label: 'Study 02',
    title: 'Organism Agents',
    status: 'placeholder',
    blurb: 'Placeholder — whole-organism agency will land here later.',
  },
  {
    id: 'environmental-signals',
    label: 'Study 03',
    title: 'Environmental Signals',
    status: 'placeholder',
    blurb: 'Placeholder — signal fields and coupling will land here later.',
  },
]

function StudyPlaceholder({ study }) {
  return (
    <div className="exp03-panel exp03-panel--placeholder" role="status">
      <p className="exp03-panel__label">
        {study.label} — {study.title}
      </p>
      <p className="exp03-panel__note">{study.blurb}</p>
      <p className="exp03-panel__hint">Coming soon</p>
    </div>
  )
}

/**
 * Study 01 — Crystal Agent MVP: FSM growth on frozen Exp05 membrane.
 */
function CrystalAgentsStudy() {
  const { life, seekToAge, setPlaying, setMoistureAtStep } =
    useLifeEngine(EXP05_LIFE_SEED)
  const [lab] = useState(() =>
    normalizeExp05LabParams({
      ...EXP05_LAB_DEFAULTS,
      compositionMode: EXP05_COMPOSITION_MODES.BODY,
    }),
  )
  const [cameraEpoch, setCameraEpoch] = useState(0)
  const [agentSeed, setAgentSeed] = useState(EXP05_LIFE_SEED)
  const [agentPlaying, setAgentPlaying] = useState(true)
  const [moisture, setMoisture] = useState(
    () => life.environment?.moisture ?? CRYSTAL_AGENT_DEFAULTS.moisture,
  )

  useEffect(() => {
    seekToAge(EXP05_OBSERVE_AGE, { resume: false })
    setPlaying(false)
    return () => setPlaying(false)
  }, [seekToAge, setPlaying])

  /*
   * Sync life env moisture once for infrastructure reuse (no AGE rebuild).
   * Agent sim owns the live moisture signal; avoid per-frame life identity churn
   * that rebuilt crystal seating while agents were growing.
   */
  useEffect(() => {
    setMoistureAtStep(moisture)
  }, [moisture, setMoistureAtStep])

  const {
    sim,
    growthByPieceId,
    getGrowthMap,
    diagnostics,
    meanProgress,
    scrubProgress,
    reset,
  } = useCrystalAgentSim({
    agentSeed,
    moisture,
    playing: agentPlaying,
  })

  const handleResetCamera = useCallback(() => {
    setCameraEpoch((n) => n + 1)
  }, [])

  const handleResetSim = useCallback(() => {
    reset()
  }, [reset])

  const handleTogglePlay = useCallback(() => {
    setAgentPlaying((p) => !p)
  }, [])

  const handleSeedChange = useCallback((seed) => {
    setAgentSeed(seed)
    setAgentPlaying(true)
  }, [])

  const handleMoistureChange = useCallback((value) => {
    setMoisture(value)
  }, [])

  const handleProgressChange = useCallback(
    (value) => {
      setAgentPlaying(false)
      scrubProgress(value)
    },
    [scrubProgress],
  )

  return (
    <div className="exp03-immerse">
      <CrystalAgentsStaticScene
        key={cameraEpoch}
        life={life}
        lab={lab}
        className="exp03-viewport"
        planSeed={agentSeed}
        growthByPieceId={growthByPieceId}
        getGrowthMap={getGrowthMap}
      />

      <div className="exp03-intro">
        <p className="exp03-intro__eyebrow">
          Playground · Experiment 03 · Study 01
        </p>
        <p className="exp03-intro__title">Crystal Agents</p>
        <p className="exp03-intro__desc">
          Primary growth nodes act as autonomous agents (Dormant → Growing →
          Branching / Stressed / Decaying). Secondary and tertiary crystals
          emerge over time. Membrane AGE stays frozen at{' '}
          {EXP05_OBSERVE_AGE.toFixed(2)}.
        </p>
      </div>

      <CrystalAgentInspector
        sim={sim}
        agentSeed={agentSeed}
        moisture={moisture}
        playing={agentPlaying}
        progress={meanProgress}
        diagnostics={diagnostics}
        onTogglePlay={handleTogglePlay}
        onReset={handleResetSim}
        onSeedChange={handleSeedChange}
        onMoistureChange={handleMoistureChange}
        onProgressChange={handleProgressChange}
      />

      <div className="exp03-chrome">
        <div className="exp03-chrome__actions">
          <button type="button" onClick={handleTogglePlay}>
            {agentPlaying ? 'Pause Agents' : 'Play Agents'}
          </button>
          <button type="button" onClick={handleResetSim}>
            Reset Growth
          </button>
          <button type="button" onClick={handleResetCamera}>
            Reset Camera
          </button>
        </div>
        <p className="exp03-chrome__hint">
          Left orbit · middle pan · wheel zoom · AGE frozen · agents{' '}
          {agentPlaying ? 'live' : 'paused'}
        </p>
      </div>
    </div>
  )
}

/**
 * Experiment 03 — Agent Behaviors
 * Study 01 = Crystal Agent MVP (FSM + moisture + inspector).
 */
export default function Experiment03({ title, description }) {
  const [studyId, setStudyId] = useState(STUDIES[0].id)
  const study = STUDIES.find((item) => item.id === studyId) ?? STUDIES[0]

  return (
    <article className="playground-experiment playground-experiment--exp03">
      <div
        className="exp03-study-tabs"
        role="tablist"
        aria-label="Experiment 03 studies"
      >
        {STUDIES.map((item) => {
          const active = item.id === study.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`exp03-study-tab${active ? ' is-active' : ''}${
                item.status === 'placeholder' ? ' is-placeholder' : ''
              }`}
              onClick={() => setStudyId(item.id)}
            >
              <span>{item.label}</span>
              <em>{item.title}</em>
            </button>
          )
        })}
      </div>

      {study.status === 'active' ? (
        <CrystalAgentsStudy />
      ) : (
        <>
          <div className="exp03-intro">
            <p className="exp03-intro__eyebrow">Playground · Experiment 03</p>
            <p className="exp03-intro__title">{title}</p>
            <p className="exp03-intro__desc">{description}</p>
          </div>
          <StudyPlaceholder study={study} />
        </>
      )}
    </article>
  )
}
