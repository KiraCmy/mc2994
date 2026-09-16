/** Curl-noise equation readout styled as a marginal annotation. */
export default function EquationPanel() {
  return (
    <section className="equation-panel control-section" aria-label="Curl noise equation">
      <p className="equation-kicker">ANNOTATION / EQUATION</p>
      <div className="equation-block">
        <p className="eq-line">
          <span className="eq-sym">ψ</span>
          <span className="eq-op">=</span>
          <span className="eq-body">S( FBM(x·s + t, y·s − t') )</span>
        </p>
        <p className="eq-line">
          <span className="eq-sym">v</span>
          <span className="eq-op">=</span>
          <span className="eq-body">
            ∇ × ψ = ( ∂ψ/∂y , −∂ψ/∂x ) · k
          </span>
        </p>
        <p className="eq-line">
          <span className="eq-sym">|v|</span>
          <span className="eq-op">→</span>
          <span className="eq-body">map luminance / 3D height</span>
        </p>
      </div>
      <dl className="equation-legend">
        <div>
          <dt>ψ</dt>
          <dd>shaped scalar potential</dd>
        </div>
        <div>
          <dt>S</dt>
          <dd>selected shaping operator</dd>
        </div>
        <div>
          <dt>s</dt>
          <dd>scale factor</dd>
        </div>
        <div>
          <dt>t</dt>
          <dd>time offset</dd>
        </div>
        <div>
          <dt>k</dt>
          <dd>curl gain</dd>
        </div>
      </dl>
    </section>
  )
}
