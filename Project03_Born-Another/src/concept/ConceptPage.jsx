import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
import keywordMemoryStill from '../assets/concept-keyword-memory.jpg'
import keywordMortalityStill from '../assets/concept-keyword-mortality.jpg'
import keywordExistenceStill from '../assets/concept-keyword-existence.jpg'
import userJourneyDiagram from '../assets/concept-user-journey.png'
import SiteHud from '../SiteHud.jsx'
import { useAutoHideHeader } from '../useAutoHideHeader.js'
import './concept.css'

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false,
  )
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!query) return undefined
    const onChange = () => setReduced(query.matches)
    query.addEventListener?.('change', onChange)
    return () => query.removeEventListener?.('change', onChange)
  }, [])
  return reduced
}

const SECTIONS = [
  { id: '01', label: 'Origin', trace: 'Origin' },
  { id: '02', label: 'The Proposition', trace: 'Proposition' },
  { id: '03', label: 'The Encounter', trace: 'Encounter' },
  { id: '04', label: 'Coexistence', trace: 'Coexistence' },
  { id: '05', label: 'Impermanence', trace: 'Impermanence' },
  { id: '06', label: 'Revelation', trace: 'Revelation' },
  { id: '07', label: 'Experience', trace: 'Experience' },
]

/** User Journey diagram (docs/assets/image/userjounery.png). */
const USER_JOURNEY_DIAGRAM = {
  src: userJourneyDiagram,
  alt: 'Born Another user journey — from encounter to coexistence, loss, and revelation',
}

/**
 * Origin keyword panels — edit copy / stills here.
 * Image sources: docs/assets/image/memory.jpg, morality.jpg, Existence.jpg
 */
const ORIGIN_KEYWORDS = [
  {
    id: 'memory',
    label: 'Memory',
    image: keywordMemoryStill,
    imageAlt: 'A hand holding a Polaroid of a shared past — Blade Runner',
    bladeRunner:
      "Rachael's implanted memories shape her sense of identity, even though her past is not truly her own.",
    interpretation:
      'Memory does not simply preserve the past. It shapes how a life understands itself and responds to the world.',
    translation: 'Past interactions → Persistent traces → Future responses',
  },
  {
    id: 'mortality',
    label: 'Mortality',
    image: keywordMortalityStill,
    imageAlt: 'Roy Batty in his final moments holding a dove — Blade Runner',
    bladeRunner:
      "Replicants are created with limited lifespans. Roy Batty's final moments reveal the fragility and significance of a finite life.",
    interpretation:
      'A life becomes meaningful not because it lasts forever, but because its existence is temporary and irreversible.',
    translation: 'Birth → Growth → Decay → Death',
  },
  {
    id: 'existence',
    label: 'Existence',
    image: keywordExistenceStill,
    imageAlt: 'Rachael and Deckard — Blade Runner',
    bladeRunner:
      'The boundary between humans and replicants becomes increasingly uncertain, questioning what makes a life truly real.',
    interpretation:
      'An artificial life does not need to resemble a human or a natural organism to evoke empathy, curiosity, or attachment.',
    translation: 'Autonomy → Interaction → Emotional connection',
  },
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
 * 07 — EXPERIENCE: collapsible User Journey accordion + optional lightbox.
 * Image `src` is a single constant — swap the asset without restructuring.
 */
function UserJourneySection({ diagram, reducedMotion }) {
  const [open, setOpen] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const panelId = 'concept-07-journey-panel'
  const hasImage = Boolean(diagram?.src)

  useEffect(() => {
    if (!lightboxOpen) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setLightboxOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [lightboxOpen])

  const lightbox =
    lightboxOpen && hasImage && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="concept-journey-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="Enlarged user journey diagram"
            onClick={() => setLightboxOpen(false)}
          >
            <button
              type="button"
              className="concept-journey-lightbox__close"
              aria-label="Close enlarged view"
              onClick={() => setLightboxOpen(false)}
            >
              ×
            </button>
            <img
              src={diagram.src}
              alt={diagram.alt}
              className="concept-journey-lightbox__image"
              onClick={(event) => event.stopPropagation()}
            />
          </div>,
          document.body,
        )
      : null

  return (
    <section
      id="concept-07"
      className={`concept-journey${open ? ' is-open' : ''}${
        reducedMotion ? ' is-reduced-motion' : ''
      }`}
      aria-labelledby="concept-07-title"
    >
      <button
        type="button"
        className="concept-journey__header"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <div className="concept-journey__intro">
          <SectionLabel number="07" name="EXPERIENCE" />
          <HeadingLines
            id="concept-07-title"
            lines={['Explore the User Journey']}
          />
          <p className="concept-body concept-journey__subtitle">
            From encounter to coexistence, loss, and revelation.
          </p>
        </div>
        <span className="concept-journey__mark" aria-hidden="true">
          {open ? '−' : '+'}
        </span>
      </button>

      <div
        id={panelId}
        className="concept-journey__panel"
        role="region"
        aria-labelledby="concept-07-title"
        hidden={reducedMotion && !open ? true : undefined}
      >
        <div className="concept-journey__panel-inner">
          {hasImage ? (
            <button
              type="button"
              className="concept-journey__figure-btn"
              onClick={() => setLightboxOpen(true)}
              aria-label="Enlarge user journey diagram"
            >
              <figure className="concept-journey__figure">
                <img
                  src={diagram.src}
                  alt={diagram.alt}
                  loading="eager"
                  decoding="async"
                />
              </figure>
            </button>
          ) : (
            <figure
              className="concept-journey__figure concept-journey__figure--placeholder"
              aria-label="User journey diagram placeholder"
            >
              <span className="concept-journey__placeholder-mark">
                User Journey diagram
              </span>
              <span className="concept-journey__placeholder-note">
                Asset pending — replace USER_JOURNEY_DIAGRAM.src
              </span>
            </figure>
          )}
        </div>
      </div>

      {lightbox}
    </section>
  )
}

/**
 * CONCEPT — cinematic Origin hero + editorial story spreads (02|03, 04, 05|06).
 * Shared SiteHeader overlays the hero via `.is-cinematic`; structure unchanged.
 */
export default function ConceptPage({ header }) {
  const { hidden, scrolled, scrollerRef } = useAutoHideHeader()
  const reducedMotion = usePrefersReducedMotion()
  const [cinematic, setCinematic] = useState(true)
  const [activeId, setActiveId] = useState('01')
  const [scroller, setScroller] = useState(null)
  const [activeKeywordId, setActiveKeywordId] = useState(null)
  const [keywordFade, setKeywordFade] = useState(false)
  /* 'playing' | 'settled' — cinematic hero open; settled matches static hero */
  const [heroIntro, setHeroIntro] = useState(() =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
      ? 'settled'
      : 'playing',
  )
  const keywordPanelRef = useRef(null)
  const keywordsRef = useRef(null)
  const keywordFadeTimer = useRef(null)

  const bindScroller = (node) => {
    setScroller(node)
    scrollerRef(node)
  }

  const activeKeyword =
    ORIGIN_KEYWORDS.find((k) => k.id === activeKeywordId) ?? null

  const closeKeywordPanel = () => {
    setActiveKeywordId(null)
    setKeywordFade(false)
  }

  const openKeyword = (id) => {
    if (keywordFadeTimer.current) {
      window.clearTimeout(keywordFadeTimer.current)
      keywordFadeTimer.current = null
    }
    if (id === activeKeywordId) {
      closeKeywordPanel()
      return
    }
    if (activeKeywordId) {
      setKeywordFade(true)
      keywordFadeTimer.current = window.setTimeout(() => {
        setActiveKeywordId(id)
        setKeywordFade(false)
        keywordFadeTimer.current = null
      }, 180)
      return
    }
    setActiveKeywordId(id)
  }

  useEffect(() => {
    return () => {
      if (keywordFadeTimer.current) window.clearTimeout(keywordFadeTimer.current)
    }
  }, [])

  useEffect(() => {
    if (reducedMotion) {
      setHeroIntro('settled')
      return undefined
    }
    if (heroIntro !== 'playing') return undefined
    const settle = window.setTimeout(() => setHeroIntro('settled'), 4800)
    return () => window.clearTimeout(settle)
  }, [heroIntro, reducedMotion])

  useEffect(() => {
    if (!activeKeywordId) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeKeywordPanel()
    }

    const onPointerDown = (event) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (keywordPanelRef.current?.contains(target)) return
      if (keywordsRef.current?.contains(target)) return
      closeKeywordPanel()
    }

    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [activeKeywordId])

  /* Align panel top to the heading; expand left toward the intro body. */
  useLayoutEffect(() => {
    if (!activeKeywordId) return undefined

    const heading = document.getElementById('concept-01-heading')
    const inner = heading?.closest('.concept-hero-inner')
    const copy = heading?.closest('.concept-hero-copy')
    const body = copy?.querySelector('.concept-body--hero')
    const panel = keywordPanelRef.current
    if (!heading || !inner || !panel) return undefined

    const syncPosition = () => {
      const innerRect = inner.getBoundingClientRect()
      const headingRect = heading.getBoundingClientRect()
      const bodyRect = body?.getBoundingClientRect()
      const copyRect = copy?.getBoundingClientRect() ?? headingRect
      const panelWidth = panel.offsetWidth || 680

      const top = headingRect.top - innerRect.top
      const gap = 20
      /* Sit just right of the intro paragraph so the panel grows into the center gap. */
      const preferredLeft = bodyRect
        ? bodyRect.right - innerRect.left + gap
        : copyRect.right - innerRect.left + gap
      const maxLeft = Math.max(0, innerRect.width - panelWidth - 12)
      const left = Math.min(Math.max(preferredLeft, 0), maxLeft)

      panel.style.top = `${Math.round(top)}px`
      panel.style.left = `${Math.round(left)}px`
    }

    syncPosition()
    const raf = window.requestAnimationFrame(syncPosition)
    const ro = new ResizeObserver(syncPosition)
    ro.observe(inner)
    if (copy) ro.observe(copy)
    if (body) ro.observe(body)
    ro.observe(panel)
    window.addEventListener('resize', syncPosition)

    return () => {
      window.cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('resize', syncPosition)
    }
  }, [activeKeywordId])

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

  const activeIndex = Math.max(
    0,
    SECTIONS.findIndex((s) => s.id === activeId),
  )
  const traceProgress =
    SECTIONS.length > 1 ? activeIndex / (SECTIONS.length - 1) : 0

  const hudClass = ['concept-hud', cinematic ? 'is-cinematic' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div className="concept-root">
      <SiteHud className={hudClass} hidden={hidden} scrolled={scrolled}>
        {header}
      </SiteHud>

      <nav
        className="concept-side-nav"
        aria-label="Concept sections"
        style={{ '--trace-progress': String(traceProgress) }}
      >
        <div className="concept-side-nav__rail" aria-hidden="true">
          <span className="concept-side-nav__rail-track" />
          <span className="concept-side-nav__rail-progress" />
        </div>
        <ol className="concept-side-nav__list">
          {SECTIONS.map((section) => {
            const active = activeId === section.id
            return (
              <li key={section.id}>
                <button
                  type="button"
                  className={`concept-side-nav__item${active ? ' is-active' : ''}`}
                  aria-current={active ? 'true' : undefined}
                  aria-label={`${section.id} ${section.label}`}
                  onClick={() => jumpTo(section.id)}
                >
                  <span className="concept-side-nav__label">{section.trace}</span>
                  <span className="concept-side-nav__node" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="concept" ref={bindScroller}>
        {/* 01 — Origin (unchanged cinematic hero) */}
        <section
          id="concept-01"
          className={`concept-hero${
            heroIntro === 'playing' ? ' is-intro-playing' : ' is-intro-settled'
          }`}
          aria-labelledby="concept-01-heading"
        >
          <div className="concept-hero-bg" aria-hidden="true">
            <img src={heroShot} alt="" decoding="async" />
            <div className="concept-hero-veil" />
            {heroIntro === 'playing' ? (
              <>
                <div className="concept-hero-intro__night" />
                <div className="concept-hero-intro__glass" />
              </>
            ) : null}
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
              <div className="concept-keywords" ref={keywordsRef}>
                <p className="concept-keywords__hint">Select a concept</p>
                <ul className="concept-keywords__list">
                  {ORIGIN_KEYWORDS.map((keyword) => {
                    const selected = keyword.id === activeKeywordId
                    return (
                      <li key={keyword.id}>
                        <button
                          type="button"
                          className={`concept-keyword${selected ? ' is-active' : ''}`}
                          aria-pressed={selected}
                          aria-expanded={selected}
                          aria-controls="concept-keyword-panel"
                          onClick={() => openKeyword(keyword.id)}
                        >
                          <span className="concept-keyword__label">{keyword.label}</span>
                          <span className="concept-keyword__mark" aria-hidden="true">
                            {selected ? '−' : '+'}
                          </span>
                          <span className="concept-keyword__rule" aria-hidden="true" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>

            {activeKeyword ? (
              <aside
                id="concept-keyword-panel"
                ref={keywordPanelRef}
                className={`concept-keyword-panel${keywordFade ? ' is-fading' : ''}`}
                role="dialog"
                aria-modal="false"
                aria-label={`${activeKeyword.label} concept note`}
              >
                <button
                  type="button"
                  className="concept-keyword-panel__close"
                  aria-label="Close keyword panel"
                  onClick={closeKeywordPanel}
                >
                  ×
                </button>

                <div className="concept-keyword-panel__layout" key={activeKeyword.id}>
                  <figure className="concept-keyword-panel__still">
                    <img
                      src={activeKeyword.image}
                      alt={activeKeyword.imageAlt}
                      decoding="async"
                    />
                  </figure>

                  <div className="concept-keyword-panel__copy">
                    <p className="concept-keyword-panel__meta">Concept / 01</p>
                    <h2 className="concept-keyword-panel__title">{activeKeyword.label}</h2>

                    <section className="concept-keyword-panel__block">
                      <p className="concept-keyword-panel__kicker">In Blade Runner</p>
                      <p className="concept-keyword-panel__text">
                        {activeKeyword.bladeRunner}
                      </p>
                    </section>

                    <section className="concept-keyword-panel__block">
                      <p className="concept-keyword-panel__kicker">My Interpretation</p>
                      <p className="concept-keyword-panel__text">
                        {activeKeyword.interpretation}
                      </p>
                    </section>

                    <section className="concept-keyword-panel__block">
                      <p className="concept-keyword-panel__kicker">Design Translation</p>
                      <p className="concept-keyword-panel__translation">
                        {activeKeyword.translation}
                      </p>
                    </section>
                  </div>
                </div>
              </aside>
            ) : null}
          </div>

          {/* Anchored to .concept-hero (not .concept-hero-inner) so bottom-right stays viewport-relative */}
          <aside className="concept-hero-quote">
            <blockquote>
              “All those moments will be lost in time, like tears in rain.”
            </blockquote>
            <p className="concept-cite">Roy Batty / Blade Runner (1982)</p>
          </aside>
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

          <UserJourneySection
            diagram={USER_JOURNEY_DIAGRAM}
            reducedMotion={reducedMotion}
          />

          <footer className="concept-coda">
            <p className="concept-coda-statement">
              <span className="concept-coda-statement__line">
                You never had the chance to meet.
              </span>
              <span className="concept-coda-statement__line">Until now.</span>
            </p>
            <span className="concept-coda-rule" aria-hidden="true" />
          </footer>
        </div>
      </div>
    </div>
  )
}
