import { Fragment } from 'react'
import bladeRunnerStill from '../assets/blade-runner-roy-batty.jpg'
import coverImage from '../assets/cover-image.png'
import SiteHud from '../SiteHud.jsx'
import { useAutoHideHeader } from '../useAutoHideHeader.js'
import './concept.css'

/** Soft frosted stand-in for imagery that will be produced later. */
function Placeholder({ label, shape = 'rect', className = '', style, children }) {
  return (
    <div
      className={`concept-ph concept-ph--${shape} ${className}`}
      style={style}
      role="img"
      aria-label={label}
    >
      {children}
      <span className="concept-ph-label">{label}</span>
    </div>
  )
}

function SectionHead({ number, label, title, children }) {
  return (
    <>
      <p className="concept-num">{number}</p>
      <div className="concept-text">
        <p className="concept-label">{label}</p>
        <h2 className="concept-heading">{title}</h2>
        {children}
      </div>
    </>
  )
}

function Arrow() {
  return (
    <span className="concept-arrow" aria-hidden="true">
      →
    </span>
  )
}

const PREMISE_TERMS = ['Form', 'Growth', 'Behavior', 'Time', 'Memory', 'Lineage']

const TRANSLATION = [
  {
    title: 'Cinematic Inspiration',
    lines: ['Artificial life · Mortality', 'Memory · Identity'],
    image: 'Film still — city at night',
    shape: 'rect',
  },
  {
    title: 'Conceptual Translation',
    lines: ['Finite lifespan · Autonomous evolution', 'Preservation · Lineage'],
    image: 'Abstract translucent form',
    shape: 'organism',
  },
  {
    title: 'Procedural Implementation',
    lines: ['Seed · AGE · Deformation', 'Growth · Trace · Lineage'],
    image: 'Procedural organism',
    shape: 'organism',
  },
]

const LIFE_STAGES = [
  { title: 'Birth', note: 'A potential emerges', scale: 0.42 },
  { title: 'Development', note: 'Rapid growth and change', scale: 0.82 },
  { title: 'Maturity', note: 'Complex structure', scale: 1 },
  { title: 'Instability', note: 'Becoming fragile', scale: 1 },
  { title: 'Decay', note: 'Dissolving form', scale: 0.86 },
  { title: 'Death', note: 'Disappearance', scale: 0.86 },
  { title: 'Trace', note: 'Residual memory', scale: 0.86 },
]

const EXPERIENCE_STEPS = [
  { title: '1. Set Conditions', note: 'Seed, parameters, environment' },
  { title: '2. A Life Emerges', note: 'Procedural rules generate an entity' },
  { title: '3. Observe & Intervene', note: 'Influence growth and behavior' },
  { title: '4. Preserve This Moment', note: 'Choose what to remember', highlight: true },
  { title: '5. Death → Trace', note: 'The life ends, its history may remain' },
]

/** Lineage graph nodes, positioned in % of the graph area. */
const LINEAGE_NODES = [
  { id: '001', note: 'Origin', x: 52, y: 14 },
  { id: '002', note: 'Variation', x: 33, y: 44 },
  { id: '003', note: 'Variation', x: 72, y: 46 },
  { id: '004', note: 'Inheritance', x: 10, y: 80 },
  { id: '005', note: 'Mutation', x: 43, y: 80 },
  { id: '006', note: 'New Branch', x: 84, y: 76 },
]
const LINEAGE_EDGES = [
  ['001', '002'],
  ['001', '003'],
  ['002', '004'],
  ['002', '005'],
  ['003', '005'],
  ['003', '006'],
]

const FUTURE_TOPICS = [
  'AI as an interpreter',
  'More complex lifecycle rules',
  'Persistent memory system',
  'Environmental interactions',
  'A growing world of interconnected lives',
]

function lineagePath(a, b) {
  const midY = (a.y + b.y) / 2
  return `M ${a.x} ${a.y} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y}`
}

/**
 * CONCEPT — editorial overview of Born Another. Layout, typography, copy and
 * image placeholders only; imagery and motion come later.
 */
export default function ConceptPage({ header }) {
  const nodeById = Object.fromEntries(LINEAGE_NODES.map((node) => [node.id, node]))
  const { hidden, scrolled, scrollerRef } = useAutoHideHeader()

  return (
    <div className="concept-root">
    <SiteHud className="concept-hud" hidden={hidden} scrolled={scrolled}>
      {header}
    </SiteHud>
    <div className="concept" ref={scrollerRef}>

      {/* 01 — The Premise */}
      <section className="concept-section concept-premise">
        <p className="concept-num">01</p>
        <div className="concept-text concept-premise-text">
          <p className="concept-label">The Premise</p>
          <h1 className="concept-heading concept-heading--hero">
            A life
            <br />
            that was never
            <br />
            meant to last.
          </h1>
          <p className="concept-body concept-body--lead">
            BORN ANOTHER is a procedural living world with a finite lifespan.
          </p>
          <p className="concept-body">
            Each life emerges from inherited conditions and develops through its own internal
            rules. Visitors may enter, explore, and influence its evolution, but they cannot fully
            control what it becomes or prevent its eventual disappearance.
          </p>
          <p className="concept-body">
            As the world changes, visitors choose which moments are worth preserving. What remains
            may become a memory, a trace, or the beginning of another life.
          </p>
          <p className="concept-scroll">Scroll to explore</p>
        </div>
        <div className="concept-premise-visual">
          <img
            className="concept-premise-image"
            src={coverImage}
            alt="Iridescent translucent sphere with crystalline shards emerging from its surface"
            decoding="async"
          />
          <ul className="concept-terms">
            {PREMISE_TERMS.map((term) => (
              <li key={term}>{term}</li>
            ))}
          </ul>
          <p className="concept-premise-coda">
            A temporary existence.
            <br />
            A lasting trace.
          </p>
        </div>
      </section>

      {/* 02 — Conceptual Origin */}
      <section className="concept-section concept-origin">
        <p className="concept-num">02</p>
        <div className="concept-text">
          <p className="concept-label">Conceptual Origin</p>
          <h2 className="concept-heading concept-heading--caps">
            Blade Runner
            <br />
            (1982)
          </h2>
          <span className="concept-rule" />
          <p className="concept-body">
            Born Another is inspired by the replicants in Blade Runner (1982). The reference is to
            their condition as artificial lives, not to the film&apos;s visual aesthetic.
          </p>
        </div>
        <img
          className="concept-origin-still"
          src={bladeRunnerStill}
          alt="Roy Batty holding a white dove — Blade Runner (1982)"
          loading="lazy"
          decoding="async"
        />
        <div className="concept-origin-quote">
          <blockquote>
            “All those moments will be lost in time, like tears in rain.”
          </blockquote>
          <p className="concept-cite">— Roy Batty, Blade Runner (1982)</p>
          <p className="concept-body">
            If an artificial life is designed to disappear, what makes its existence meaningful?
          </p>
          <p className="concept-body">
            If its memories disappear with it, what is worth preserving?
          </p>
        </div>
      </section>

      {/* 03 — The Translation */}
      <section className="concept-section">
        <SectionHead
          number="03"
          label="The Translation"
          title={
            <>
              From Artificial Life
              <br />
              to Procedural Life
            </>
          }
        >
          <p className="concept-body">
            The questions raised by Blade Runner are translated into a computational system, where
            abstract, non-human entities explore similar themes of mortality, identity and memory.
          </p>
        </SectionHead>
        <div className="concept-flow concept-flow--3">
          {TRANSLATION.map((card, i) => (
            <Fragment key={card.title}>
              {i > 0 ? <Arrow /> : null}
              <article className="concept-card">
                <p className="concept-label concept-label--center">{card.title}</p>
                <p className="concept-note">
                  {card.lines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </p>
                <Placeholder label={card.image} shape={card.shape} className="concept-card-ph" />
              </article>
            </Fragment>
          ))}
        </div>
      </section>

      {/* 04 — The Life Cycle */}
      <section className="concept-section">
        <SectionHead
          number="04"
          label="The Life Cycle"
          title={
            <>
              Anatomy
              <br />
              of a Finite Life
            </>
          }
        >
          <p className="concept-body">
            Each entity has a limited lifespan. Its form changes through time rather than appearing
            immediately as a finished object.
          </p>
        </SectionHead>
        <div className="concept-lifecycle">
          <div className="concept-stages">
            {LIFE_STAGES.map((stage) => (
              <div key={stage.title} className="concept-stage">
                <p className="concept-label concept-label--center">{stage.title}</p>
                <p className="concept-note">{stage.note}</p>
                <div className="concept-stage-slot">
                  <Placeholder
                    label={stage.title}
                    shape="organism"
                    className="concept-stage-ph"
                    style={{ '--stage-scale': stage.scale }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="concept-axis" aria-hidden="true">
            <span>Age 0</span>
            <span className="concept-axis-line">
              {LIFE_STAGES.map((stage, i) => (
                <i
                  key={stage.title}
                  className={i === 2 ? 'is-active' : ''}
                  style={{ left: `${(i / (LIFE_STAGES.length - 1)) * 100}%` }}
                />
              ))}
            </span>
            <span>Age 100</span>
          </div>
        </div>
      </section>

      {/* 05 — The User Experience */}
      <section className="concept-section">
        <SectionHead
          number="05"
          label="The User Experience"
          title={
            <>
              Influence,
              <br />
              Observe,
              <br />
              Preserve
            </>
          }
        >
          <p className="concept-body">
            The user does not directly design the object, but chooses initial conditions and
            interacts with it during its lifetime.
          </p>
        </SectionHead>
        <div className="concept-flow concept-flow--5">
          {EXPERIENCE_STEPS.map((step, i) => (
            <Fragment key={step.title}>
              {i > 0 ? <Arrow /> : null}
              <article className={`concept-step${step.highlight ? ' is-highlight' : ''}`}>
                <Placeholder label={`Still — ${step.title.replace(/^\d\.\s*/, '')}`} className="concept-step-ph">
                  {step.highlight ? <span className="concept-step-frame" /> : null}
                </Placeholder>
                <div className="concept-step-copy">
                  <p className="concept-label">{step.title}</p>
                  <p className="concept-note">{step.note}</p>
                </div>
              </article>
            </Fragment>
          ))}
        </div>
      </section>

      {/* 06 — Memory & Lineage */}
      <section className="concept-section concept-lineage">
        <SectionHead
          number="06"
          label="Memory & Lineage"
          title={
            <>
              The World
              <br />
              Remembers
            </>
          }
        >
          <p className="concept-body">
            After an entity disappears, it can leave behind a trace or memory within the system.
            New entities may inherit partial information from what came before.
          </p>
        </SectionHead>
        <div className="concept-graph">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {LINEAGE_EDGES.map(([a, b]) => (
              <path key={`${a}-${b}`} d={lineagePath(nodeById[a], nodeById[b])} />
            ))}
          </svg>
          {LINEAGE_NODES.map((node) => (
            <div
              key={node.id}
              className="concept-node"
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
            >
              <Placeholder label={`Entity ${node.id}`} shape="organism" className="concept-node-ph" />
              <p className="concept-node-copy">
                <span>{node.id}</span>
                {node.note}
              </p>
            </div>
          ))}
        </div>
        <div className="concept-aside">
          <p className="concept-body">
            Each life may inherit traces of what existed before, yet develop into something
            individual.
          </p>
          <p className="concept-body">
            The collection becomes a record of relationships, rather than a gallery of independent
            objects.
          </p>
        </div>
      </section>

      {/* 07 — Future Vision */}
      <section className="concept-section concept-future">
        <SectionHead
          number="07"
          label="Future Vision"
          title={
            <>
              A World
              <br />
              That Remembers
            </>
          }
        >
          <p className="concept-body">
            In the future, natural language may be used as input for initial conditions. An AI
            interprets personal memories or emotions, and translates them into abstract parameters
            for new lives.
          </p>
        </SectionHead>
        <div className="concept-flow concept-flow--future">
          <article className="concept-future-step">
            <blockquote className="concept-future-quote">
              “I remember a place
              <br />
              that no longer exists.”
            </blockquote>
            <p className="concept-label concept-label--center">User Input</p>
            <p className="concept-note">Text, memory, emotion</p>
          </article>
          <Arrow />
          <article className="concept-future-step">
            <Placeholder label="AI interpretation — signal" className="concept-future-ph" />
            <p className="concept-label concept-label--center">AI Interpretation</p>
            <p className="concept-note">Translate to conditions</p>
          </article>
          <Arrow />
          <article className="concept-future-step">
            <Placeholder label="New life" className="concept-future-ph" />
            <p className="concept-label concept-label--center">Procedural System</p>
            <p className="concept-note">Generate a new life</p>
          </article>
        </div>
        <div className="concept-aside concept-aside--ruled">
          <p className="concept-label">Future Exploration</p>
          <ul className="concept-list">
            {FUTURE_TOPICS.map((topic) => (
              <li key={topic}>{topic}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* 08 — An Open Question / Next Exploration */}
      <section className="concept-section concept-care">
        <SectionHead
          number="08"
          label="An Open Question / Next Exploration"
          title={
            <>
              Can We Care for
              <br />
              a Life We Cannot Keep?
            </>
          }
        >
          <p className="concept-label">Proposed / Not Yet Implemented</p>
          <p className="concept-body">
            The current prototype allows visitors to observe and influence a finite digital
            organism. But what would make these interactions feel like caring for a living system,
            rather than manipulating procedural geometry?
          </p>
          <p className="concept-body">
            I am exploring a care-based interaction model in which users could nurture the
            organism, respond to its changing needs, and potentially delay its decay. Every
            intervention might bring both benefits and consequences, while death remains
            inevitable.
          </p>
        </SectionHead>
        <div className="concept-care-visual">
          <figure className="concept-care-diagram" aria-label="Relationship between care, control, and loss around a finite life">
            <svg viewBox="0 0 240 210" role="presentation">
              <defs>
                <radialGradient id="concept-care-glow-care" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#a8e4ef" stopOpacity="0.34" />
                  <stop offset="100%" stopColor="#a8e4ef" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="concept-care-glow-control" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#c9b8ff" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#c9b8ff" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="concept-care-glow-loss" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f0b0c4" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#f0b0c4" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="120" cy="48" r="28" fill="url(#concept-care-glow-care)" />
              <circle cx="52" cy="168" r="28" fill="url(#concept-care-glow-control)" />
              <circle cx="188" cy="168" r="28" fill="url(#concept-care-glow-loss)" />
              <path
                className="concept-care-diagram-edge"
                d="M120 48 L52 168 L188 168 Z"
                fill="none"
              />
              <text className="concept-care-diagram-center" x="120" y="118" textAnchor="middle">
                Finite Life
              </text>
              <text className="concept-care-diagram-node" x="120" y="52" textAnchor="middle">
                Care
              </text>
              <text className="concept-care-diagram-node" x="52" y="172" textAnchor="middle">
                Control
              </text>
              <text className="concept-care-diagram-node" x="188" y="172" textAnchor="middle">
                Loss
              </text>
            </svg>
          </figure>
          <p className="concept-body concept-body--lead concept-care-question">
            Can care create attachment without turning the organism into something fully
            controllable?
          </p>
        </div>
      </section>
    </div>
    </div>
  )
}
