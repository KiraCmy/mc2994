import { useEffect, useMemo, useRef, useState } from 'react'
import FossilPlate from './FossilPlate.jsx'
import { FOSSIL_AMMONITE } from './habitatFossil.js'
import { lifeCaption, finalCondition } from '../../archive/archiveText.js'
import { layoutCallouts } from './specimenFrame.js'
import { anatomyCallouts, averageEnvironment, clock, finalLevel, interactionLabel, keyEvents, lifecycleCurve } from './revealRecord.js'

/**
 * Exp07 end of life, as an archive sheet: the record of this life and the
 * real creature it was identified as on the left, its anatomy marked around
 * the remains, and its then/now, lifecycle, water and key events on the right.
 *
 * `story` is lifeLog.summarizeLife for this life (null in the lab), `then`
 * a picture from early in its life, `now` a picture of its remains.
 */
export default function FossilReveal({
  fossil = FOSSIL_AMMONITE,
  onBornAnother,
  onLinger,
  onSave = null,
  saved = false,
  onOpenArchive = null,
  story = null,
  species = 'spiral',
  env = {},
  level = null,
  then = null,
  now = null,
  number = null,
  world = null,
}) {
  const sectionRef = useRef(null)
  const end = level ?? finalLevel(story, 1)
  const avg = useMemo(() => averageEnvironment(story, env), [story, env])
  const curve = useMemo(() => lifecycleCurve(story, 260, 72, 6), [story])
  const events = useMemo(() => keyEvents(story, 6), [story])
  const callouts = useMemo(() => anatomyCallouts({ species, env: avg, level: end }), [species, avg, end])
  const narrative = lifeCaption({ crystallization: end, timeline: story?.timeline ?? [], environment: avg })
  const lived = story?.lived ?? null
  const thenStage = story?.stages?.find((s) => s.name === 'first') ?? null
  const [large, setLarge] = useState(false)

  useAnatomyOverlay(sectionRef, world)

  return (
    <section ref={sectionRef} className="exp07-reveal" aria-labelledby="exp07-reveal-name">
      {/* Around the remains: a frame and three marked places on the body. */}
      <svg className="exp07-reveal__anatomy" aria-hidden="true">
        <rect data-a="box" className="exp07-reveal__box" />
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} data-a={`h${i}`} className="exp07-reveal__handle" width="7" height="7" />
        ))}
        {callouts.map((c) => (
          <g key={c.id}>
            <polyline data-a={`${c.id}-line`} className="exp07-reveal__cline" />
            <circle data-a={`${c.id}-dot`} r="4" className="exp07-reveal__cdot" />
          </g>
        ))}
      </svg>
      {callouts.map((c) => (
        <div key={c.id} data-a={`${c.id}-label`} className="exp07-reveal__clabel" aria-hidden="true">
          <b>{c.title}</b>
          {c.lines.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      ))}

      {/* Left: the record, and under it the choices (one column, never over it). */}
      <div className="exp07-reveal__left" data-a="left">
      <div className="exp07-reveal__card">
        <p className="exp07-reveal__eyebrow">
          Archive <i>/</i> {number ?? '—'}
        </p>
        <h2 id="exp07-reveal-name" className="exp07-reveal__name">
          {fossil.name}
        </h2>
        <dl className="exp07-reveal__rows">
          <div>
            <dt>Species (simulated)</dt>
            <dd className="is-italic">{fossil.latin}</dd>
          </div>
          <div>
            <dt>Lifespan</dt>
            <dd>{clock(lived)}</dd>
          </div>
          <div>
            <dt>Environment</dt>
            <dd>
              T {avg.temperature.toFixed(2)}&ensp;M {avg.moisture.toFixed(2)}&ensp;Turb {avg.turbulence.toFixed(2)}
            </dd>
          </div>
          <div>
            <dt>Interaction</dt>
            <dd className="is-italic">{interactionLabel(story)}</dd>
          </div>
          <div>
            <dt>Remains</dt>
            <dd>{finalCondition(end)}</dd>
          </div>
        </dl>
        <div className="exp07-reveal__narrative">
          <h3>Narrative</h3>
          <p>{narrative}</p>
        </div>
        <RealSpecimen fossil={fossil} onEnlarge={() => setLarge(true)} />
      </div>

      <div className="exp07-reveal__actions">
        <button type="button" className="exp07-reveal__primary" onClick={onBornAnother}>
          <Icon d="M7 2v10M2 7h10" />
          Born another
        </button>
        {onSave ? (
          saved ? (
            <button type="button" className="exp07-reveal__ghost is-saved" onClick={onOpenArchive ?? undefined}>
              <Icon d="M2.5 7.5l3 3 6-7" />
              In your archive
            </button>
          ) : (
            <button type="button" className="exp07-reveal__ghost" onClick={onSave}>
              <Icon d="M7 1.5v7M4 6l3 3 3-3M1.5 10v2.5h11V10" />
              Save to archive
            </button>
          )
        ) : null}
        <button type="button" className="exp07-reveal__ghost" onClick={onLinger}>
          <Icon d="M1 7s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4zM7 5.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z" />
          Stay with the remains
        </button>
      </div>
      </div>

      {/* Right: then / now, lifecycle, water, events. */}
      <aside className="exp07-reveal__record" data-a="record" aria-label="Life record">
        <section className="exp07-reveal__then">
          <figure>
            <figcaption>
              Then <span>({clock(thenStage?.t ?? (story ? 0 : null))})</span>
            </figcaption>
            {then ? <img src={then} alt="" /> : <span className="exp07-reveal__noimg" />}
          </figure>
          <span className="exp07-reveal__arrow" aria-hidden="true">
            <svg viewBox="0 0 48 10">
              <path d="M0 5h46M41 1l5 4-5 4" />
            </svg>
          </span>
          <figure>
            <figcaption>
              <u>Now</u> <span>({clock(lived)})</span>
            </figcaption>
            {now ? <img src={now} alt="" /> : <span className="exp07-reveal__noimg" />}
          </figure>
        </section>

        {curve ? (
          <section className="exp07-reveal__lifecycle">
            <h3>Lifecycle</h3>
            <div className="exp07-reveal__curve">
              <svg viewBox="0 0 260 72" preserveAspectRatio="none" aria-label="Crystallization over its life">
                <defs>
                  <linearGradient id="exp07-life-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#ece8f4" stopOpacity="0.16" />
                    <stop offset="1" stopColor="#ece8f4" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={curve.area} className="is-fill" />
                <path d={curve.d} className="is-line" />
                <line x1={curve.peak.x} y1={curve.peak.y} x2={curve.peak.x} y2="72" className="is-peak" />
              </svg>
              <i className="exp07-reveal__peak" style={{ left: `${(curve.peak.x / 260) * 100}%`, top: `${(curve.peak.y / 72) * 100}%` }} />
            </div>
            <p className="exp07-reveal__ticks">
              {lifecycleTicks(curve.peak.x / 260).map((t) => (
                <span key={t.label} style={{ left: `${t.at * 100}%` }} className={`is-${t.align}`}>
                  {t.label}
                </span>
              ))}
            </p>
          </section>
        ) : null}

        <section className="exp07-reveal__env">
          <h3>Environment (avg)</h3>
          {[
            ['Temperature', avg.temperature],
            ['Moisture', avg.moisture],
            ['Turbulence', avg.turbulence],
          ].map(([label, v]) => (
            <p key={label}>
              <span>{label}</span>
              <i style={{ '--v': v }} />
              <span>{v.toFixed(2)}</span>
            </p>
          ))}
        </section>

        {events.length ? (
          <section className="exp07-reveal__events">
            <h3>Key events</h3>
            <ol>
              {events.map((e, i) => (
                <li key={`${e.t}-${i}`} className={`is-${e.kind}`}>
                  <time>{clock(e.t)}</time>
                  <span>{e.label}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </aside>

      <p className="exp07-reveal__hint" data-a="hint" aria-hidden="true">
        Drag to turn the remains
      </p>

      {large && fossil.photo ? <PhotoView fossil={fossil} onClose={() => setLarge(false)} /> : null}
    </section>
  )
}

/** Birth · Growth · Peak · Decay under the curve, Peak under its marker. */
function lifecycleTicks(peakAt) {
  const peak = Math.min(0.78, Math.max(0.3, peakAt))
  const ticks = [{ label: 'Birth', at: 0, align: 'start' }]
  if (peak > 0.34) ticks.push({ label: 'Growth', at: peak / 2, align: 'middle' })
  ticks.push({ label: 'Peak', at: peak, align: 'middle' })
  ticks.push({ label: 'Decay', at: 1, align: 'end' })
  return ticks
}

function Icon({ d }) {
  return (
    <svg className="exp07-reveal__icon" viewBox="0 0 14 14" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

/**
 * The real creature the remains were identified as: its photograph (falls
 * back to the drawn plate if the picture cannot load), its span in time,
 * and — folded — why it vanished.
 */
function RealSpecimen({ fossil, onEnlarge }) {
  const photo = fossil.photo
  const [state, setState] = useState(photo ? 'loading' : 'failed')
  useEffect(() => {
    setState(photo ? 'loading' : 'failed')
  }, [fossil.id, photo])
  const hasPhoto = Boolean(photo) && state !== 'failed'
  return (
    <section className="exp07-reveal__real" aria-label={`The real ${fossil.name}`}>
      <h3>Real specimen</h3>
      <div className="exp07-reveal__realrow">
        {hasPhoto ? (
          <button
            type="button"
            className={`exp07-reveal__realphoto${state === 'ready' ? ' is-ready' : ''}`}
            onClick={onEnlarge}
            aria-label={`Enlarge the photograph: ${photo.caption}`}
          >
            <img src={photo.src} alt={photo.caption} decoding="async" onLoad={() => setState('ready')} onError={() => setState('failed')} />
            <span aria-hidden="true">⤢</span>
          </button>
        ) : (
          <div className="exp07-reveal__realplate">
            <FossilPlate id={fossil.id} />
          </div>
        )}
        <div className="exp07-reveal__realtext">
          <b>
            {fossil.latin} <em>{fossil.epithet}</em>
          </b>
          <span>{fossil.appeared}</span>
          <span>{fossil.vanished}</span>
        </div>
      </div>
      {hasPhoto && state === 'ready' ? (
        <p className="exp07-reveal__credit">
          {photo.caption}.{' '}
          <a href={photo.page} target="_blank" rel="noreferrer">
            {photo.credit}
          </a>
        </p>
      ) : null}
      <details className="exp07-reveal__fossil">
        <summary>Why it vanished</summary>
        <div className="exp07-reveal__fossil-body">
          <p className="exp07-reveal__cause">{fossil.cause}</p>
          <p className="exp07-reveal__echo">{fossil.echo}</p>
          {hasPhoto ? (
            <figure className="exp07-reveal__figure">
              <FossilPlate id={fossil.id} />
            </figure>
          ) : null}
        </div>
      </details>
    </section>
  )
}

/** The photograph, large, over the sheet (click or Esc to close). */
function PhotoView({ fossil, onClose }) {
  const photo = fossil.photo
  const closeRef = useRef(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])
  return (
    <div className="exp07-reveal__lightbox" role="dialog" aria-modal="true" aria-label={photo.caption} onClick={onClose}>
      <figure onClick={(e) => e.stopPropagation()}>
        <img src={photo.src} alt={photo.caption} />
        <figcaption>
          <b>{fossil.name}</b> · {photo.caption}.{' '}
          <a href={photo.page} target="_blank" rel="noreferrer">
            {photo.credit}
          </a>
        </figcaption>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close the photograph">
          ×
        </button>
      </figure>
    </div>
  )
}

const IDS = ['mineral', 'membrane', 'core']
const FALLBACK = { box: { x0: -0.96, y0: -0.96, x1: 0.96, y1: 0.96 }, anchors: { mineral: [-0.55, -0.5], membrane: [0.82, -0.15], core: [0.15, 0.25] } }

/**
 * Lays the frame and callouts over the remains. In World Final the scene
 * calls it every frame, right after projecting the body (world.specimenOverlay),
 * with the body's centre and radius (world.specimenScreen), its box from its
 * own geometry (world.specimenBox, px) and the three callout
 * points as real places on the body (world.specimenAnchors, px) — so the
 * lines stay on the same parts of the body as it turns. In the lab (no world)
 * it follows the CSS vars with its own frame loop. Labels are measured and
 * kept on screen, off the panels and the buttons.
 */
function useAnatomyOverlay(sectionRef, world) {
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return undefined
    const root = section.parentElement
    const q = (name) => section.querySelector(`[data-a="${name}"]`)
    const box = q('box')
    const svg = box.ownerSVGElement
    const handles = Array.from({ length: 8 }, (_, i) => q(`h${i}`))
    const parts = IDS.map((id) => ({ id, line: q(`${id}-line`), dot: q(`${id}-dot`), label: q(`${id}-label`) }))
    const left = q('left')
    const record = q('record')
    const hint = q('hint')
    const layout = () => {
      const w = world?.current
      let cx
      let cy
      let r
      if (w?.specimenScreen) ({ x: cx, y: cy, r } = w.specimenScreen)
      else {
        const style = getComputedStyle(root)
        cx = parseFloat(style.getPropertyValue('--exp07-ax'))
        cy = parseFloat(style.getPropertyValue('--exp07-ay'))
        r = parseFloat(style.getPropertyValue('--exp07-ar'))
      }
      const ok = section.offsetWidth > 0 && getComputedStyle(svg).display !== 'none' && Number.isFinite(cx) && Number.isFinite(cy) && Number.isFinite(r) && r > 4
      section.classList.toggle('has-anatomy', ok)
      if (!ok) return
      /* The frame: the body's own geometry projected this frame (World
         Final), a little air around it; a box around its sphere otherwise. */
      const g = w?.specimenBox
      const pad = Math.max(6, r * 0.04)
      const bx = g
        ? { x0: g.x0 - pad, y0: g.y0 - pad, x1: g.x1 + pad, y1: g.y1 + pad }
        : { x0: cx + FALLBACK.box.x0 * r, y0: cy + FALLBACK.box.y0 * r, x1: cx + FALLBACK.box.x1 * r, y1: cy + FALLBACK.box.y1 * r }
      /* Callout points: real places on the body when the scene has them. */
      const live = w?.specimenAnchors
      const anchors = {}
      for (const id of IDS) {
        const a = live?.[id]
        anchors[id] = a && Number.isFinite(a[0]) && Number.isFinite(a[1]) ? a : [cx + FALLBACK.anchors[id][0] * r, cy + FALLBACK.anchors[id][1] * r]
      }
      const rect = section.getBoundingClientRect()
      const rel = (el) => {
        if (!el || !el.offsetWidth) return null
        const b = el.getBoundingClientRect()
        return { left: b.left - rect.left, top: b.top - rect.top, right: b.right - rect.left, bottom: b.bottom - rect.top }
      }
      const c = rel(left)
      const rc = rel(record)
      const hn = rel(hint)
      const safe = {
        left: (c ? c.right : 0) + 20,
        right: (rc ? rc.left : rect.width) - 20,
        top: Math.min(c?.top ?? 80, rc?.top ?? 80),
        bottom: Math.min(hn ? hn.top : rect.height, rc ? rc.bottom : rect.height) - 14,
      }
      box.setAttribute('x', bx.x0)
      box.setAttribute('y', bx.y0)
      box.setAttribute('width', Math.max(1, bx.x1 - bx.x0))
      box.setAttribute('height', Math.max(1, bx.y1 - bx.y0))
      const hx = [0, 0.5, 1, 1, 1, 0.5, 0, 0]
      const hy = [0, 0, 0, 0.5, 1, 1, 1, 0.5]
      handles.forEach((h, i) => {
        h.setAttribute('x', bx.x0 + hx[i] * (bx.x1 - bx.x0) - 3.5)
        h.setAttribute('y', bx.y0 + hy[i] * (bx.y1 - bx.y0) - 3.5)
      })
      const sizes = Object.fromEntries(parts.map((p) => [p.id, { w: p.label.offsetWidth, h: p.label.offsetHeight }]))
      const laid = layoutCallouts(bx, anchors, sizes, safe)
      for (const part of parts) {
        const l = laid[part.id]
        part.line.setAttribute('points', l.points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '))
        part.dot.setAttribute('cx', l.points[0][0])
        part.dot.setAttribute('cy', l.points[0][1])
        part.label.style.transform = `translate(${l.label.x.toFixed(1)}px, ${l.label.y.toFixed(1)}px)`
      }
    }
    if (world?.current) {
      const w = world.current
      w.specimenOverlay = layout
      return () => {
        if (w.specimenOverlay === layout) w.specimenOverlay = null
      }
    }
    let frame = 0
    const tick = () => {
      frame = requestAnimationFrame(tick)
      layout()
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [sectionRef, world])
}
