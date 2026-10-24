import { useEffect, useState } from 'react'
import heroShot from '../assets/hero-shot.png'
import concept02Fossil from '../assets/concept-02-fossil.jpg'
import concept02Fossil2 from '../assets/concept-02-fossil2.jpg'
import concept02Fossil3 from '../assets/concept-02-fossil3.jpg'
import concept03Encounter from '../assets/concept-03-encounter.jpg'
import concept041 from '../assets/concept-04-1.jpg'
import concept042 from '../assets/concept-04-2.jpg'
import concept043 from '../assets/concept-04-3.jpg'
import concept044 from '../assets/concept-04-4.jpg'
import concept051 from '../assets/concept-05-1.jpg'
import concept06 from '../assets/concept-06.jpg'
import SiteHud from '../SiteHud.jsx'
import { useAutoHideHeader } from '../useAutoHideHeader.js'
import './concept.css'

const SECTIONS = [
  { id: '01', label: 'Origin' },
  { id: '02', label: 'The Proposition' },
  { id: '03', label: 'The Encounter' },
  { id: '04', label: 'Coexistence' },
  { id: '05', label: 'Impermanence' },
  { id: '06', label: 'Revelation' },
]

function HeadingLines({ as: Tag = 'h2', id, lines, className = '' }) {
  return (
    <Tag
      id={id}
      className={`concept-heading${className ? ` ${className}` : ''}`}
    >
      {lines.map((line) => (
        <span key={line} className="concept-heading-line">
          {line}
        </span>
      ))}
    </Tag>
  )
}

function SectionLabel({ number, name }) {
  return (
    <p className="concept-label">
      <span className="concept-label-index">{number}</span>
      <span className="concept-label-sep" aria-hidden="true">
        {' — '}
      </span>
      <span className="concept-label-name">{name}</span>
    </p>
  )
}

/** Editorial media frame — use `src` when photography is available. */
function MediaSlot({ label, src, className = '' }) {
  return (
    <figure className={`concept-media ${className}`}>
      {src ? (
        <img src={src} alt={label} loading="lazy" decoding="async" />
      ) : (
        <span className="concept-media-label" role="img" aria-label={label}>
          {label}
        </span>
      )}
    </figure>
  )
}

function PanelCaption({ children }) {
  return <p className="concept-caption">{children}</p>
}

/**
 * CONCEPT — cinematic Origin hero + editorial story spreads (02|03, 04, 05|06).
 * Shared SiteHeader overlays the hero via `.is-cinematic`; structure unchanged.
 */
export default function ConceptPage({ header }) {
  const { hidden, scrolled, scrollerRef } = useAutoHideHeader()
  const [cinematic, setCinematic] = useState(true)
  const [activeId, setActiveId] = useState('01')
  const [scroller, setScroller] = useState(null)

  const bindScroller = (node) => {
    setScroller(node)
    scrollerRef(node)
  }

  useEffect(() => {
    if (!scroller) return undefined

    const hero = scroller.querySelector('#concept-01')
    if (!hero) return undefined

    const io = new IntersectionObserver(
      ([entry]) => {
        setCinematic(entry.isIntersecting && entry.intersectionRatio > 0.35)
      },
      { root: scroller, threshold: [0.2, 0.35, 0.5] },
    )
    io.observe(hero)
    return () => io.disconnect()
  }, [scroller])

  useEffect(() => {
    if (!scroller) return undefined

    const nodes = SECTIONS.map((s) =>
      scroller.querySelector(`#concept-${s.id}`),
    ).filter(Boolean)
    if (!nodes.length) return undefined

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const top = visible[0]
        if (top?.target?.id) {
          setActiveId(top.target.id.replace('concept-', ''))
        }
      },
      {
        root: scroller,
        threshold: [0.25, 0.45, 0.6],
        rootMargin: '-12% 0px -40% 0px',
      },
    )
    nodes.forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [scroller])

  const jumpTo = (id) => {
    const el = scroller?.querySelector(`#concept-${id}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const hudClass = ['concept-hud', cinematic ? 'is-cinematic' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div className="concept-root">
      <SiteHud className={hudClass} hidden={hidden} scrolled={scrolled}>
        {header}
      </SiteHud>

      <nav className="concept-side-nav" aria-label="Concept sections">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            className={activeId === section.id ? 'is-active' : ''}
            aria-current={activeId === section.id ? 'true' : undefined}
            aria-label={`${section.id} ${section.label}`}
            onClick={() => jumpTo(section.id)}
          >
            {section.id}
          </button>
        ))}
      </nav>

      <div className="concept" ref={bindScroller}>
        {/* 01 — Origin (unchanged cinematic hero) */}
        <section
          id="concept-01"
          className="concept-hero"
          aria-labelledby="concept-01-heading"
        >
          <div className="concept-hero-bg" aria-hidden="true">
            <img src={heroShot} alt="" decoding="async" />
            <div className="concept-hero-veil" />
          </div>

          <div className="concept-hero-inner">
            <div className="concept-hero-copy">
              <SectionLabel number="01" name="Origin" />
              <HeadingLines
                as="h1"
                id="concept-01-heading"
                className="concept-heading--hero"
                lines={['What makes', 'a life real?']}
              />
              <p className="concept-body concept-body--hero">
                Born Another is inspired by the replicants in Blade Runner (1982) — artificial
                lives with finite time, fragile memory, and the need to mean something before they
                disappear.
              </p>
              <ul className="concept-keywords">
                <li>Memory</li>
                <li>Mortality</li>
                <li>Existence</li>
              </ul>
            </div>

            <aside className="concept-hero-quote">
              <blockquote>
                “All those moments will be lost in time, like tears in rain.”
              </blockquote>
              <p className="concept-cite">Roy Batty / Blade Runner (1982)</p>
            </aside>
          </div>
        </section>

        <div className="concept-story">
          {/* 02 | 03 — paired editorial spread */}
          <div className="concept-spread concept-spread--pair">
            <section
              id="concept-02"
              className="concept-panel"
              aria-labelledby="concept-02-title"
            >
              <div className="concept-panel-text">
                <SectionLabel number="02" name="The Proposition" />
                <HeadingLines id="concept-02-title" lines={['A life of', 'its own.']} />
                <p className="concept-body">
                  Speculative digital organisms emerge from inherited conditions and grow through
                  their own internal rules.
                </p>
                <p className="concept-body">
                  Visitors may enter and influence them, but cannot fully author what they become —
                  or keep them from ending.
                </p>
              </div>
              <div className="concept-panel-visual">
                <div className="concept-collage concept-collage--02">
                  <MediaSlot
                    label="Ammonite / fossil form"
                    src={concept02Fossil}
                    className="concept-collage__a concept-media--fossil"
                  />
                  <MediaSlot
                    label="Mineral texture"
                    src={concept02Fossil2}
                    className="concept-collage__b concept-media--fossil2"
                  />
                  <MediaSlot
                    label="Cellular texture"
                    src={concept02Fossil3}
                    className="concept-collage__c concept-media--fossil3"
                  />
                </div>
                <PanelCaption>Traces of former lives</PanelCaption>
              </div>
            </section>

            <section
              id="concept-03"
              className="concept-panel"
              aria-labelledby="concept-03-title"
            >
              <div className="concept-panel-text">
                <SectionLabel number="03" name="The Encounter" />
                <HeadingLines
                  id="concept-03-title"
                  lines={['Your words become', 'part of its world.']}
                />
                <p className="concept-body">
                  Language is not decoration here — it softens into climate, pressure, and memory
                  inside the living system.
                </p>
                <p className="concept-body">
                  What you say leaves a mark the organism must live with.
                </p>
              </div>
              <div className="concept-panel-visual">
                <div className="concept-frame concept-frame--tall">
                  <MediaSlot
                    label="Hand at rain-streaked window"
                    src={concept03Encounter}
                    className="concept-media--encounter"
                  />
                </div>
                <PanelCaption>Words, environment, influence</PanelCaption>
              </div>
            </section>
          </div>

          {/* 04 — full-width coexistence */}
          <section
            id="concept-04"
            className="concept-panel concept-panel--wide"
            aria-labelledby="concept-04-title"
          >
            <div className="concept-panel-text">
              <SectionLabel number="04" name="Coexistence" />
              <HeadingLines
                id="concept-04-title"
                lines={['A life beyond', 'our relationship.']}
              />
              <p className="concept-body">
                The organism continues whether or not anyone is watching. Growth, drift, and decay
                follow its own time — a life that exceeds the moments of human attention.
              </p>
            </div>
            <div className="concept-panel-visual">
              <div className="concept-collage concept-collage--04">
                <MediaSlot
                  label="Murmuration / particle swarm"
                  src={concept041}
                  className="concept-collage__a concept-media--04-1"
                />
                <MediaSlot
                  label="Wispy particle field"
                  src={concept042}
                  className="concept-collage__b concept-media--04-2"
                />
                <MediaSlot
                  label="Tangled luminous lines"
                  src={concept043}
                  className="concept-collage__c concept-media--04-3"
                />
                <MediaSlot
                  label="Flowing field texture"
                  src={concept044}
                  className="concept-collage__d concept-media--04-4"
                />
              </div>
              <PanelCaption>Interaction, influence, unseen relationships</PanelCaption>
            </div>
          </section>

          {/* 05 | 06 — paired editorial spread */}
          <div className="concept-spread concept-spread--pair">
            <section
              id="concept-05"
              className="concept-panel"
              aria-labelledby="concept-05-title"
            >
              <div className="concept-panel-text">
                <SectionLabel number="05" name="Impermanence" />
                <HeadingLines
                  id="concept-05-title"
                  lines={['Nothing remains', 'unchanged.']}
                />
                <p className="concept-body">
                  Form softens, structure fails, and presence thins. Decay is not a failure state —
                  it is how the system tells the truth about time.
                </p>
              </div>
              <div className="concept-panel-visual">
                <div className="concept-frame concept-frame--tall">
                  <MediaSlot
                    label="Dried plants / skeletal form"
                    src={concept051}
                    className="concept-media--05-1"
                  />
                </div>
                <PanelCaption>Growth, decay, disappearance</PanelCaption>
              </div>
            </section>

            <section
              id="concept-06"
              className="concept-panel"
              aria-labelledby="concept-06-title"
            >
              <div className="concept-panel-text">
                <SectionLabel number="06" name="Revelation" />
                <HeadingLines
                  id="concept-06-title"
                  lines={['Only in its absence', 'do we discover its past.']}
                />
                <p className="concept-body">
                  After disappearance, traces may remain — residues that later lives can inherit.
                  Memory becomes structure: a record of relationships rather than a gallery of
                  finished objects.
                </p>
              </div>
              <div className="concept-panel-visual">
                <div className="concept-frame concept-frame--tall">
                  <MediaSlot
                    label="Archive drawer / specimens"
                    src={concept06}
                    className="concept-media--06"
                  />
                </div>
                <PanelCaption>Archive, extinction, a longer history</PanelCaption>
              </div>
            </section>
          </div>

          <footer className="concept-coda">
            <p className="concept-coda-question">
              Can we form a meaningful relationship with a life we cannot fully understand or
              control?
            </p>
            <span className="concept-coda-rule" aria-hidden="true" />
          </footer>
        </div>
      </div>
    </div>
  )
}
