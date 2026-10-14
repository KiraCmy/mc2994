import architecturalDesignDiagram from '../assets/architectural-design-diagram.png'
import conceptLifecycleDiagram from '../assets/concept-lifecycle-diagram.png'
import conceptLifecycleDiagram02 from '../assets/concept-lifecycle-diagram-02.png'
import crystalGrowthGrammarDiagram from '../assets/crystal-growth-grammar-diagram.png'
import SiteHud from '../SiteHud.jsx'
import { useAutoHideHeader } from '../useAutoHideHeader.js'
import './system.css'

const SYSTEM_SECTIONS = [
  {
    number: '01',
    title: 'Concept & Lifecycle',
    note: 'Finite life, autonomous development, intervention, disappearance, and preservation.',
    diagrams: [
      {
        src: conceptLifecycleDiagram,
        alt: 'Concept translation diagram: Blade Runner themes, principles, and Born Another core concept.',
      },
      {
        src: conceptLifecycleDiagram02,
        alt: 'Lifecycle, exterior and interior worlds, user journey, and key idea diagram.',
      },
    ],
  },
  {
    number: '02',
    title: 'Procedural Architecture',
    note: 'Seeded state, fixed-step evolution, spatial fields, and rendering interfaces.',
    diagrams: [
      {
        src: architecturalDesignDiagram,
        alt: 'Procedural architecture diagram: seed, lifecycle, spatial fields, rendering, and user intervention loop.',
      },
    ],
  },
  {
    number: '03',
    title: 'Crystal Growth Grammar',
    note: 'Nucleation, local mineral conditions, hierarchy, and constrained morphology.',
    diagrams: [
      {
        src: crystalGrowthGrammarDiagram,
        alt: 'Shared life engine diagram: inputs, growth grammar, exterior and interior expressions, and user exploration.',
      },
    ],
  },
  {
    number: '04',
    title: 'Exterior / Interior Mapping',
    note: 'One procedural surface and one growth history viewed from both sides.',
  },
]

const CARE_FLOW = [
  {
    title: 'Autonomous Life',
    note: 'Energy / Growth / Decay',
  },
  {
    title: 'User Observes',
    note: 'Attention without authorship',
  },
  {
    title: 'User Intervenes',
    note: 'Nurture / Protect / Redirect',
  },
  {
    title: 'Consequences',
    note: 'Recovery / Stress / Trade-offs',
  },
  {
    title: 'Feedback',
    note: 'Returns to observation',
  },
]

const CARE_QUESTIONS = [
  'Does care make the organism feel more alive, or simply more game-like?',
  'Should users be able to extend its lifespan, or only influence how it lives?',
  'How much control can users have before the organism loses its autonomy?',
]

function CareFlowArrow() {
  return (
    <span className="system-page__care-arrow" aria-hidden="true">
      →
    </span>
  )
}

export default function SystemPage({ header }) {
  const { hidden, scrolled, scrollerRef } = useAutoHideHeader()

  return (
    <div className="system-page">
      <SiteHud className="system-page__hud" hidden={hidden} scrolled={scrolled}>
        {header}
      </SiteHud>

      <main className="system-page__content" ref={scrollerRef}>
        <div className="system-page__intro">
          <p>Procedural living-world system</p>
          <h1>
            Shaped by rules.
            <br />
            Changed by the world.
            <br />
            Bound by time.
          </h1>
        </div>

        <div className="system-page__sections">
          {SYSTEM_SECTIONS.map((section) => (
            <section key={section.number} className="system-page__section">
              <span>{section.number}</span>
              <div>
                <h2>{section.title}</h2>
                <p>{section.note}</p>
              </div>
              {section.diagrams?.length ? (
                <div className="system-page__diagrams">
                  {section.diagrams.map((diagram) => (
                    <img
                      key={diagram.src}
                      className="system-page__diagram"
                      src={diagram.src}
                      alt={diagram.alt}
                      loading="lazy"
                      decoding="async"
                    />
                  ))}
                </div>
              ) : null}
            </section>
          ))}

          <section className="system-page__section system-page__section--care">
            <span>05</span>
            <div>
              <p className="system-page__proposed">Proposed / Not Yet Implemented</p>
              <h2>Care &amp; Consequences — A Proposed Interaction Model</h2>
              <p>
                A conceptual exploration of care-based interaction. The autonomous lifecycle
                continues independently and eventually leads to death or preservation; the loop
                below asks how intervention might feel like tending a life without making it fully
                controllable.
              </p>
            </div>

            <div className="system-page__care">
              <div className="system-page__care-flow" role="list">
                {CARE_FLOW.map((step, index) => (
                  <div key={step.title} className="system-page__care-step-wrap">
                    {index > 0 ? <CareFlowArrow /> : null}
                    <article className="system-page__care-step" role="listitem">
                      <h3>{step.title}</h3>
                      <p>{step.note}</p>
                    </article>
                  </div>
                ))}
              </div>

              <div className="system-page__care-outcome">
                <span className="system-page__care-outcome-rule" aria-hidden="true" />
                <p>
                  <span>Autonomous lifecycle continues independently</span>
                  <span className="system-page__care-arrow" aria-hidden="true">
                    →
                  </span>
                  <strong>Death / Preservation</strong>
                </p>
              </div>

              <p className="system-page__care-example">
                Example: Protecting one crystal region may consume resources needed by another.
              </p>

              <ol className="system-page__care-questions">
                {CARE_QUESTIONS.map((question, index) => (
                  <li key={question}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <p>{question}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
