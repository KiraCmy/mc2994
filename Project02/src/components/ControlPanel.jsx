import { SHAPE_OPS, getShapeOp } from '../noise/shaping.js'

const TIPS = {
  SCALE: 'Zooms the noise pattern. Lower = larger swirls; higher = finer detail.',
  OCTAVES: 'How many noise layers are stacked. More octaves = richer turbulence.',
  STRENGTH: 'Scales curl vector magnitude (how strong the flow field is).',
  EVOLVE: 'Shifts the noise in time so the field morphs.',
  RES: 'Grid sample count (N×N). Higher = sharper map, heavier compute.',
  HEIGHT: 'How far the 3D mesh lifts from curl magnitude.',
  SIZE: 'World size of the 3D grid plane.',
  OP: 'Shaping operator remaps the noise potential before curl.',
  AMT: 'Amount / strength of the selected shaping operator.',
  EXP: 'Exponent for POWER shaping (curves the potential).',
  BIAS: 'Schlick bias — pushes values toward dark or bright.',
  GAIN: 'Schlick gain — contrasts midtones vs extremes.',
  SOFT: 'Soft clamp limit — how hard peaks are cut.',
  MIX: 'Blend toward absolute-value fold of the potential.',
  EDGE: 'Smoothstep edge width — softens transitions.',
  FREQ: 'Sine warp frequency through the potential.',
}

function TipLabel({ htmlFor, children, tip }) {
  return (
    <label htmlFor={htmlFor} className="tip-label">
      <span className="tip-word">{children}</span>
      {tip ? <span className="tip-bubble" role="tooltip">{tip}</span> : null}
    </label>
  )
}

function ParamSlider({ id, label, tip, value, min, max, step, display, onChange }) {
  return (
    <div className="control-group">
      <div className="slider-label-row">
        <TipLabel htmlFor={id} tip={tip ?? TIPS[label]}>
          {label}
        </TipLabel>
        <span>{display ?? value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

export default function ControlPanel({ mode = '2d', params, onChange }) {
  const shapeMeta = getShapeOp(params.shapeOp)
  const set = (key) => (value) => onChange({ ...params, [key]: value })

  const onShapeOp = (id) => {
    const op = getShapeOp(id)
    onChange({ ...params, shapeOp: id, shapeAmount: op.defaultAmount })
  }

  const shapeTip = TIPS[shapeMeta.paramLabel] ?? TIPS.AMT

  return (
    <aside
      className={`control-bar control-bar-${mode}`}
      aria-label={mode === '3d' ? '3D world controls' : '2D curl noise controls'}
    >
      <div className="control-section">
        <p className="section-label">NOISE</p>
        <ParamSlider
          id={`${mode}-scale`}
          label="SCALE"
          value={params.scale}
          min={0.5}
          max={12}
          step={0.05}
          display={params.scale.toFixed(2)}
          onChange={set('scale')}
        />
        <ParamSlider
          id={`${mode}-octaves`}
          label="OCTAVES"
          value={params.octaves}
          min={1}
          max={6}
          step={1}
          onChange={set('octaves')}
        />
        <ParamSlider
          id={`${mode}-strength`}
          label="STRENGTH"
          value={params.strength}
          min={0.1}
          max={4}
          step={0.05}
          display={params.strength.toFixed(2)}
          onChange={set('strength')}
        />
        <ParamSlider
          id={`${mode}-time`}
          label="EVOLVE"
          value={params.time}
          min={0}
          max={20}
          step={0.05}
          display={params.time.toFixed(2)}
          onChange={set('time')}
        />
      </div>

      <div className="control-section">
        <p className="section-label">GRID</p>
        <ParamSlider
          id={`${mode}-resolution`}
          label="RES"
          value={params.resolution}
          min={8}
          max={96}
          step={1}
          onChange={set('resolution')}
        />
        {mode === '3d' ? (
          <>
            <ParamSlider
              id="displace"
              label="HEIGHT"
              value={params.displace}
              min={0}
              max={2.5}
              step={0.02}
              display={params.displace.toFixed(2)}
              onChange={set('displace')}
            />
            <ParamSlider
              id="gridScale"
              label="SIZE"
              value={params.gridScale}
              min={1}
              max={6}
              step={0.1}
              display={params.gridScale.toFixed(1)}
              onChange={set('gridScale')}
            />
          </>
        ) : null}
      </div>

      <div className="control-section shape-section">
        <p className="section-label">SHAPING</p>
        <div className="control-group">
          <div className="slider-label-row">
            <TipLabel htmlFor={`${mode}-shape-op`} tip={TIPS.OP}>
              OP
            </TipLabel>
            <span>{shapeMeta.label}</span>
          </div>
          <select
            id={`${mode}-shape-op`}
            className="shape-select"
            value={params.shapeOp}
            onChange={(e) => onShapeOp(e.target.value)}
          >
            {SHAPE_OPS.map((op) => (
              <option key={op.id} value={op.id}>
                {op.label}
              </option>
            ))}
          </select>
        </div>
        <ParamSlider
          id={`${mode}-shape-amount`}
          label={shapeMeta.paramLabel}
          tip={shapeTip}
          value={params.shapeAmount}
          min={shapeMeta.min}
          max={shapeMeta.max}
          step={shapeMeta.step}
          display={
            Number.isInteger(params.shapeAmount)
              ? params.shapeAmount
              : params.shapeAmount.toFixed(2)
          }
          onChange={set('shapeAmount')}
        />
      </div>
    </aside>
  )
}
