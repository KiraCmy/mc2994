/**
 * Experiment 01 — empty placeholder.
 * Scene and controls slots are reserved; no Canvas or simulation yet.
 */
export default function Experiment01({ title, description }) {
  return (
    <article className="playground-experiment">
      <header className="playground-experiment__intro">
        <p className="playground-experiment__eyebrow">Playground</p>
        <h1 className="playground-experiment__title">{title}</h1>
        <p className="playground-experiment__desc">{description}</p>
      </header>

      <div className="playground-experiment__workspace">
        <section
          className="playground-experiment__scene"
          aria-label="Scene workspace"
        >
          <p className="playground-experiment__placeholder">
            Scene area — Three.js / R3F will mount here later.
          </p>
        </section>

        <aside
          className="playground-experiment__controls"
          aria-label="Experiment controls"
        >
          <p className="playground-experiment__controls-label">Controls</p>
          <p className="playground-experiment__placeholder playground-experiment__placeholder--muted">
            Experiment-specific controls will appear here.
          </p>
        </aside>
      </div>
    </article>
  )
}
