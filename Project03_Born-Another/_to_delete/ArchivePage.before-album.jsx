import { useCallback, useEffect, useMemo, useState } from 'react'
import SiteHeader from '../SiteHeader.jsx'
import SiteHud from '../SiteHud.jsx'
import { useAutoHideHeader } from '../useAutoHideHeader.js'
import FossilPlate from '../playground/finalHabitat/FossilPlate.jsx'
import { loadArchive, removeSpecimen } from '../playground/finalHabitat/archive.js'
import {
  clock,
  envSeries,
  finalCondition,
  lastWords,
  lifeCaption,
  lifeSpan,
  lifeStages,
  specimenNumber,
} from './archiveText.js'
import './archive.css'
import './archiveSheet.css'

/** `#archive/<key>` → key (or null for the overview). */
function keyFromHash() {
  if (typeof window === 'undefined') return null
  const m = window.location.hash.match(/^#\/?archive\/(.+)$/)
  return m ? decodeURIComponent(m[1]) : null
}
const hrefFor = (key) => `#archive/${encodeURIComponent(key)}`

/** A steady, per-specimen tilt and size so the grid reads as a collection. */
function poseFor(key) {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  const r = (n) => ((h >>> (n * 5)) & 1023) / 1023
  return { rotate: Math.round((r(1) - 0.5) * 40), scale: 0.8 + r(2) * 0.2 }
}

/** "4 min" style total. */
function minutes(sec) {
  return `${Math.max(0, Math.round((sec || 0) / 60))} min`
}

/**
 * Life Archive: the lives the viewer kept. The overview is a dark plate of
 * remains, each named by the last thing the viewer told it; each specimen is
 * one shareable card.
 */
export default function ArchivePage({ modeId, onSelectMode }) {
  const { hidden, scrolled, scrollerRef } = useAutoHideHeader()
  const [entries, setEntries] = useState(() => loadArchive())
  const [selected, setSelected] = useState(keyFromHash)

  useEffect(() => {
    const onHash = () => {
      setSelected(keyFromHash())
      setEntries(loadArchive())
    }
    const onStorage = (e) => {
      if (!e.key || e.key.startsWith('born-another.archive')) setEntries(loadArchive())
    }
    window.addEventListener('hashchange', onHash)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const specimen = useMemo(() => entries.find((e) => e.key === selected) ?? null, [entries, selected])
  useEffect(() => {
    document.querySelector('.archive-page__scroller')?.scrollTo?.(0, 0)
  }, [selected])

  const remove = useCallback((key) => {
    setEntries(removeSpecimen(key))
    window.location.hash = '#archive'
  }, [])

  return (
    <div className="archive-page">
      <SiteHud className="archive-page__hud" hidden={hidden} scrolled={scrolled}>
        <SiteHeader modeId={modeId} onSelectMode={onSelectMode} />
      </SiteHud>
      <main className="archive-page__scroller" ref={scrollerRef}>
        {specimen ? (
          <SpecimenView entry={specimen} number={specimenNumber(entries, specimen.key)} onRemove={remove} />
        ) : (
          <Overview entries={entries} missing={Boolean(selected)} />
        )}
      </main>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Remains({ entry, className = '', style }) {
  return (
    <span className={`arc-remains ${entry.image ? '' : 'arc-remains--plate'} ${className}`} style={style}>
      {entry.image ? <img src={entry.image} alt={`The remains of this ${entry.name}`} /> : <FossilPlate id={entry.fossilId ?? 'ammonite'} />}
    </span>
  )
}

function Overview({ entries, missing }) {
  const species = new Set(entries.map((e) => e.fossilId)).size
  const watched = entries.reduce((sum, e) => sum + (e.watched || 0), 0)
  return (
    <section className="arc-overview" aria-labelledby="arc-title">
      <header className="arc-overview__head">
        <h1 id="arc-title" className="arc-overview__title">Life Archive</h1>
        <p className="arc-overview__lede">
          {entries.length ? `${entries.length} ${entries.length === 1 ? 'life' : 'lives'} you watched end, ` : 'Lives you watched end, '}
          named by the last thing you told them
        </p>
      </header>
      {missing ? <p className="arc-overview__note">That specimen is no longer in this archive.</p> : null}
      {entries.length === 0 ? (
        <div className="arc-overview__empty">
          <p>Nothing kept yet. Stay with a life in World Final until it ends, then save its remains.</p>
          <a className="arc-button" href="#world-final">Enter World Final</a>
        </div>
      ) : (
        <ol className="arc-grid">
          {entries.map((e, i) => {
            const w = lastWords(e)
            const pose = poseFor(e.key)
            return (
              <li key={e.key}>
                <a className="arc-cell" href={hrefFor(e.key)}>
                  <span className="arc-cell__stage">
                    <Remains
                      entry={e}
                      className="arc-cell__remains"
                      style={{ '--arc-rot': `${pose.rotate}deg`, '--arc-scale': pose.scale }}
                    />
                  </span>
                  <span className={`arc-cell__words${w ? '' : ' is-quiet'}`}>
                    {w ? `“${w.text}”` : e.lived == null ? e.name : 'no words'}
                  </span>
                  <span className="arc-cell__meta">
                    {e.name} · No. {String(entries.length - i).padStart(3, '0')}
                  </span>
                </a>
              </li>
            )
          })}
        </ol>
      )}
      <footer className="arc-overview__foot">
        <span>
          <i aria-hidden="true">●</i> {entries.length} kept · {species} {species === 1 ? 'species' : 'species'}
          {watched ? ` · ${minutes(watched)} witnessed` : ''}
        </span>
        <span>Born Another · kept in this browser</span>
      </footer>
    </section>
  )
}

/* ------------------------------------------------------------------ */

/** A magnified window onto the remains (a close-up plate). */
function Detail({ entry, zoom, x, y, className = '' }) {
  return (
    <div className={`arc-detail ${className}`} aria-hidden="true">
      <div className="arc-detail__lens" style={{ transform: `scale(${zoom}) translate(${x}, ${y})` }}>
        <Remains entry={entry} />
      </div>
    </div>
  )
}

/** One stage thumbnail: its picture if one was kept, else the drawn plate. */
function StageThumb({ entry, stage }) {
  const style = { '--arc-stage-scale': stage.scale }
  return (
    <span className="arc-stage__thumb" style={style} aria-hidden="true">
      {stage.image ? <img src={stage.image} alt="" /> : <FossilPlate id={entry.fossilId ?? 'ammonite'} />}
    </span>
  )
}

/** Temperature / moisture / turbulence over its life, as dotted traces. */
function EnvTrace({ entry }) {
  const W = 400
  const H = 36
  const series = envSeries(entry)
  /* Records without a timeline get a flat 0..1 trace and no word marks. */
  const timed = (entry.timeline ?? []).length >= 2
  const lastT = Math.max(...series[0].points.map((p) => p.t))
  const end = Math.max(1e-6, timed ? Math.max(lastT, entry.lived ?? 0) : lastT)
  const x = (t) => (W * Math.min(end, Math.max(0, t))) / end
  const y = (v) => 3 + (H - 6) * (1 - Math.max(0, Math.min(1, v)))
  const words = timed ? entry.words ?? [] : []
  return (
    <dl className="arc-trace">
      {series.map(({ key, points }) => {
        const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join('')
        return (
          <div key={key} className="arc-trace__row">
            <dt>{key}</dt>
            <dd>
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${key} over its life`}>
                <path d={d} className="arc-trace__glow" />
                <path d={d} className="arc-trace__line" />
                {words.map((w, i) => (
                  <line key={i} x1={x(w.t)} x2={x(w.t)} y1={H - 7} y2={H} className="arc-trace__word" />
                ))}
              </svg>
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

function SpecimenView({ entry, number, onRemove }) {
  const words = entry.words ?? []
  const last = lastWords(entry)
  const stages = lifeStages(entry)

  return (
    <div className="arc-specimen">
      <article className="arc-sheet" aria-labelledby="arc-name">
        <div className="arc-sheet__inner">
          <section className="arc-sheet__left">
            <p className="arc-sheet__brand">
              Born Another
              <br />
              Life Archive
            </p>
            <p className="arc-sheet__no">{number}</p>
            <h1 id="arc-name" className="arc-sheet__name">{entry.name}</h1>
            <p className="arc-sheet__could">A life that could have been.</p>
            <dl className="arc-sheet__meta">
              <div>
                <dt>Origin</dt>
                <dd>{entry.latin || entry.name} (extinct)</dd>
              </div>
              <div>
                <dt>Life span</dt>
                <dd>{lifeSpan(entry.lived)}</dd>
              </div>
              <div>
                <dt>Interventions</dt>
                <dd>{entry.lived == null ? '—' : words.length}</dd>
              </div>
              <div>
                <dt>Final condition</dt>
                <dd>{finalCondition(entry.crystallization)}</dd>
              </div>
            </dl>
            <div className="arc-sheet__last">
              <p className="arc-sheet__label">
                Last words <span>/</span> {last ? clock(last.t) : '—'}
              </p>
              <p className={`arc-sheet__quote${last ? '' : ' is-quiet'}`}>{last ? `“${last.text}”` : 'no words'}</p>
            </div>
            <Detail entry={entry} zoom={2.6} x="8%" y="-4%" className="arc-sheet__detail-low" />
          </section>

          <section className="arc-sheet__stage" aria-label="Remains">
            <i className="arc-cross arc-cross--tl" aria-hidden="true" />
            <i className="arc-cross arc-cross--tr" aria-hidden="true" />
            <i className="arc-cross arc-cross--bl" aria-hidden="true" />
            <i className="arc-cross arc-cross--br" aria-hidden="true" />
            <Remains entry={entry} className="arc-sheet__remains" />
            <span className="arc-sheet__scale" aria-hidden="true">
              2 mm
            </span>
          </section>

          <section className="arc-sheet__right">
            <Detail entry={entry} zoom={2.9} x="-10%" y="9%" />
            <Detail entry={entry} zoom={3.6} x="2%" y="-8%" />
            <p className="arc-sheet__caption">{lifeCaption(entry)}</p>
          </section>

          <section className="arc-sheet__strip">
            <div className="arc-sheet__timeline">
              <p className="arc-sheet__label">Life timeline</p>
              <ol className="arc-stages">
                {stages.map((s) => (
                  <li key={s.id} className="arc-stage">
                    <StageThumb entry={entry} stage={s} />
                    <span className="arc-stage__name">{s.label}</span>
                    <span className="arc-stage__time">{clock(s.t)}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="arc-sheet__env">
              <p className="arc-sheet__label">Environmental trace</p>
              <EnvTrace entry={entry} />
            </div>
          </section>
        </div>
      </article>

      <nav className="arc-specimen__actions" aria-label="Specimen">
        <a href="#archive">← Life Archive</a>
        <span>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Remove ${entry.name}, No. ${number} from your archive? This cannot be undone.`)) onRemove(entry.key)
            }}
          >
            Remove
          </button>
          <a href="#world-final">Born another</a>
        </span>
      </nav>
    </div>
  )
}
