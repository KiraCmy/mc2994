/**
 * Exp03 Study 01 — compact Crystal Agent debug inspector.
 */
import { CRYSTAL_AGENT_STATES } from './crystalAgentTypes.js'
import { MULTI_CLUSTER_MAX } from './multiBioCrystalPlan.js'

const STATE_LABEL = {
  [CRYSTAL_AGENT_STATES.DORMANT]: 'Dormant',
  [CRYSTAL_AGENT_STATES.GROWING]: 'Growing',
  [CRYSTAL_AGENT_STATES.BRANCHING]: 'Branching',
  [CRYSTAL_AGENT_STATES.STRESSED]: 'Stressed',
  [CRYSTAL_AGENT_STATES.DECAYING]: 'Decaying',
}

function formatPct(v) {
  return `${Math.round((Number(v) || 0) * 100)}%`
}

function recentTransitions(agent, limit = 3) {
  const list = agent?.transitions || []
  return list.slice(-limit).reverse()
}

export default function CrystalAgentInspector({
  sim,
  agentSeed,
  moisture,
  clusterCount = 1,
  fieldContrast = 0,
  competition = 0,
  showFlows = true,
  clusterSummaries = [],
  playing,
  progress = 0,
  diagnostics = null,
  onTogglePlay,
  onReset,
  onSeedChange,
  onMoistureChange,
  onClusterCountChange,
  onFieldContrastChange,
  onCompetitionChange,
  onToggleFlows,
  onProgressChange,
}) {
  const agents = sim?.agents || []

  return (
    <aside className="exp03-panel exp03-panel--agents" aria-label="Crystal Agent Inspector">
      <p className="exp03-panel__label">Agent Inspector</p>
      <p className="exp03-panel__note">
        Primary nodes are autonomous agents. Drag Progress to jump maturity
        instantly — no need to wait for live growth.
      </p>

      <div className="exp03-agent-controls" role="group" aria-label="Simulation controls">
        <button type="button" onClick={onTogglePlay}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" onClick={onReset}>
          Reset
        </button>
      </div>

      <label className="exp03-lab__row">
        <span>
          Progress
          <em className="exp03-lab__value">{formatPct(progress)}</em>
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={clamp01(progress)}
          onChange={(e) => onProgressChange?.(Number(e.target.value))}
          aria-valuetext={`Formation progress ${formatPct(progress)}`}
          aria-label="Crystal formation progress"
        />
      </label>

      <label className="exp03-lab__row">
        <span>
          Seed
          <em className="exp03-lab__value">{agentSeed}</em>
        </span>
        <input
          type="number"
          min={1}
          max={99999}
          step={1}
          value={agentSeed}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n) && n >= 1) onSeedChange(Math.floor(n))
          }}
          aria-label="Agent seed"
        />
      </label>

      <label className="exp03-lab__row">
        <span>
          Clusters
          <em className="exp03-lab__value">{clusterCount}</em>
        </span>
        <input
          type="range"
          min={1}
          max={MULTI_CLUSTER_MAX}
          step={1}
          value={clusterCount}
          onChange={(e) => onClusterCountChange?.(Number(e.target.value))}
          aria-valuetext={`${clusterCount} clusters`}
          aria-label="Crystal cluster count"
        />
      </label>

      <label className="exp03-lab__row">
        <span>
          Global moisture
          <em className="exp03-lab__value">{moisture.toFixed(2)}</em>
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={moisture}
          onChange={(e) => onMoistureChange(Number(e.target.value))}
          aria-valuetext={`Moisture ${moisture.toFixed(2)}`}
          aria-label="Agent moisture"
        />
      </label>

      <label className="exp03-lab__row">
        <span>
          Field contrast
          <em className="exp03-lab__value">±{fieldContrast.toFixed(2)}</em>
        </span>
        <input
          type="range"
          min={0}
          max={0.4}
          step={0.01}
          value={fieldContrast}
          onChange={(e) => onFieldContrastChange?.(Number(e.target.value))}
          aria-valuetext={`Local moisture contrast ±${fieldContrast.toFixed(2)}`}
          aria-label="Local moisture field contrast"
        />
      </label>

      <label className="exp03-lab__row">
        <span>
          Competition
          <em className="exp03-lab__value">
            {competition > 0 ? competition.toFixed(2) : 'off'}
          </em>
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={competition}
          onChange={(e) => onCompetitionChange?.(Number(e.target.value))}
          aria-valuetext={
            competition > 0
              ? `Neighbour competition ${competition.toFixed(2)}`
              : 'Neighbour competition off'
          }
          aria-label="Neighbour competition strength"
        />
      </label>

      <label className="exp03-lab__check">
        <input
          type="checkbox"
          checked={showFlows}
          onChange={() => onToggleFlows?.()}
        />
        <span>Show drain flows</span>
      </label>

      {clusterSummaries.length > 0 ? (
        <ul className="exp03-cluster-list" aria-label="Clusters">
          {clusterSummaries.map((c) => (
            <li
              key={c.id}
              className={`exp03-cluster-row is-${c.dominantState || 'dormant'}`}
            >
              <strong>C{c.index}</strong>
              <span
                className="exp03-cluster-row__moisture"
                title={`Field ${c.fieldMoisture.toFixed(2)} − drain ${c.drain.toFixed(2)} = ${c.localMoisture.toFixed(2)}`}
              >
                {/* Grey = what the field offers; blue = what is left after neighbours drain it. */}
                <b style={{ width: `${clampPct(c.fieldMoisture)}%` }} />
                <i style={{ width: `${clampPct(c.localMoisture)}%` }} />
              </span>
              <em>{c.localMoisture.toFixed(2)}</em>
              <span className="exp03-cluster-row__state">
                {STATE_LABEL[c.dominantState] || '—'}
              </span>
              <em>{formatPct(c.meanProgress)}</em>
              {c.drain >= 0.015 ? (
                <span className="exp03-cluster-row__drain">
                  −{c.drain.toFixed(2)} drained by{' '}
                  {c.drainedBy.map((id) => `C${id.slice(1)}`).join(', ')}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <dl className="exp03-panel__readout">
        <div>
          <dt>Sim time</dt>
          <dd>{(sim?.time ?? 0).toFixed(2)}s</dd>
        </div>
        <div>
          <dt>Step</dt>
          <dd>{sim?.step ?? 0}</dd>
        </div>
        <div>
          <dt>Agents</dt>
          <dd>{agents.length}</dd>
        </div>
        <div>
          <dt>Moisture in</dt>
          <dd>{(sim?.moisture ?? moisture).toFixed(2)}</dd>
        </div>
      </dl>

      {diagnostics ? (
        <dl className="exp03-panel__readout exp03-panel__readout--diag" aria-label="Growth diagnostics">
          <div>
            <dt>Growth mul</dt>
            <dd>{diagnostics.moistureMul.toFixed(3)}</dd>
          </div>
          <div>
            <dt>Mean rate</dt>
            <dd>{diagnostics.meanGrowthRate.toFixed(3)}/s</dd>
          </div>
          <div>
            <dt>Mean progress</dt>
            <dd>{formatPct(diagnostics.meanProgress)}</dd>
          </div>
          <div>
            <dt>Mean scale</dt>
            <dd>{diagnostics.meanRenderScale.toFixed(3)}</dd>
          </div>
        </dl>
      ) : null}

      <ul className="exp03-agent-list">
        {agents.map((agent) => {
          const unlocked = agent.children.filter((c) => c.unlocked).length
          const transitions = recentTransitions(agent)
          const renderScale = clamp01(agent.progress)
          return (
            <li key={agent.id} className={`exp03-agent-card is-${agent.state}`}>
              <div className="exp03-agent-card__head">
                <strong>
                  {agent.clusterId ? `C${agent.clusterId.slice(1)}·` : ''}P
                  {agent.localIndex ?? agent.index}
                </strong>
                <span className="exp03-agent-card__state">
                  {STATE_LABEL[agent.state] || agent.state}
                </span>
              </div>
              <div className="exp03-agent-card__meters" aria-hidden="true">
                <i
                  className="exp03-agent-card__bar exp03-agent-card__bar--growth"
                  style={{ width: `${clampPct(agent.progress)}%` }}
                />
                <i
                  className="exp03-agent-card__bar exp03-agent-card__bar--stress"
                  style={{ width: `${clampPct(agent.stress)}%` }}
                />
              </div>
              <dl className="exp03-agent-card__stats">
                <div>
                  <dt>Growth</dt>
                  <dd>{formatPct(agent.progress)}</dd>
                </div>
                <div>
                  <dt>Scale</dt>
                  <dd>{renderScale.toFixed(3)}</dd>
                </div>
                <div>
                  <dt>Rate</dt>
                  <dd>{(agent.growthRate ?? 0).toFixed(3)}/s</dd>
                </div>
                <div>
                  <dt>Mul</dt>
                  <dd>{(agent.growthMul ?? 0).toFixed(2)}</dd>
                </div>
                <div>
                  <dt>Moisture</dt>
                  <dd>{(agent.moistureSeen ?? 0).toFixed(2)}</dd>
                </div>
                <div>
                  <dt>Branches</dt>
                  <dd>
                    {unlocked}/{agent.children.length}
                  </dd>
                </div>
              </dl>
              {transitions.length > 0 ? (
                <ol className="exp03-agent-card__transitions">
                  {transitions.map((tr, i) => (
                    <li key={`${tr.t}-${tr.to}-${i}`}>
                      t={tr.t.toFixed(2)} · {tr.from}→{tr.to}
                      <span> · {tr.reason}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="exp03-agent-card__idle">No transitions yet</p>
              )}
            </li>
          )
        })}
      </ul>

      <p className="exp03-panel__hint">
        Progress = maturity · Global moisture ± field − neighbour drain =
        moisture each cluster receives · Contrast 0 = uniform field ·
        Competition off = independent clusters
      </p>
    </aside>
  )
}

function clamp01(v) {
  return Math.min(1, Math.max(0, Number(v) || 0))
}

function clampPct(v) {
  return Math.min(100, Math.max(0, (Number(v) || 0) * 100))
}
