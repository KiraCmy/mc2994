import { useCallback, useEffect, useMemo, useState } from 'react'
import SiteHeader from '../SiteHeader.jsx'
import SiteHud from '../SiteHud.jsx'
import { useAutoHideHeader } from '../useAutoHideHeader.js'
import FossilPlate from '../playground/finalHabitat/FossilPlate.jsx'
import { loadArchive, removeSpecimen } from '../playground/finalHabitat/archive.js'
import { ALBUM_EVENT, countCaptures } from '../playground/finalHabitat/album.js'
import AlbumView from './AlbumView.jsx'
import ArchiveBackdrop from './ArchiveBackdrop.jsx'
import SpecimenCard from './SpecimenCard.jsx'
import { exportSpecimenCard } from './specimenCard.js'
import { lastWords, specimenNumber } from './archiveText.js'
import './archive.css'

/** `#archive/<key>` → key (or null for the overview). */
function keyFromHash() {
  if (typeof window === 'undefined') return null
  const m = window.location.hash.match(/^#\/?archive\/(.+)$/)
  return m ? decodeURIComponent(m[1]) : null
}
const hrefFor = (key) => `#archive/${encodeURIComponent(key)}`
/** `#archive/album`: the album of captured moments (not a specimen key). */
const ALBUM = 'album'

const pad3 = (n) => String(n).padStart(3, '0')

/**
 * The archive's heading, set where the end-of-life sheet sets its own: an
 * eyebrow that is also the Lives / Album switch, the title, a hairline and a
 * short line about what is kept here.
 */
function ArchiveHead({ current, lives, moments }) {
  const album = current === 'album'
  return (
    <header className="arc-head">
      <nav className="arc-head__eyebrow" aria-label="Archive">
        <span>Archive</span>
        <i aria-hidden="true">/</i>
        <a href="#archive" aria-current={album ? undefined : 'page'}>
          Lives <b>{pad3(lives)}</b>
        </a>
        <a href={`#archive/${ALBUM}`} aria-current={album ? 'page' : undefined}>
          Album <b>{pad3(moments)}</b>
        </a>
      </nav>
      <div className="arc-head__row">
        <h1 id={album ? 'arc-album-title' : 'arc-title'} className="arc-head__title">
          {album ? 'Album' : 'Life Archive'}
        </h1>
        <p className="arc-head__lede">
          {album ? (
            <>
              Moments of the world,
              <br />
              as you saw them.
            </>
          ) : (
            <>
              A collection of lives
              <br />
              that once emerged,
              <br />
              evolved, and faded.
            </>
          )}
        </p>
      </div>
    </header>
  )
}

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

  const isAlbum = selected === ALBUM
  const specimen = useMemo(() => (isAlbum ? null : entries.find((e) => e.key === selected) ?? null), [entries, selected, isAlbum])
  const [moments, setMoments] = useState(0)
  useEffect(() => {
    const refresh = () => countCaptures().then(setMoments)
    refresh()
    window.addEventListener(ALBUM_EVENT, refresh)
    return () => window.removeEventListener(ALBUM_EVENT, refresh)
  }, [])
  useEffect(() => {
    document.querySelector('.archive-page__scroller')?.scrollTo?.(0, 0)
  }, [selected])

  const remove = useCallback((key) => {
    setEntries(removeSpecimen(key))
    window.location.hash = '#archive'
  }, [])

  return (
    <div className={`archive-page${specimen ? ' is-specimen' : ''}`}>
      <ArchiveBackdrop />
      <SiteHud className="archive-page__hud" hidden={hidden} scrolled={scrolled}>
        <SiteHeader modeId={modeId} onSelectMode={onSelectMode} />
      </SiteHud>
      <main className={`archive-page__scroller${specimen ? '' : ' is-list'}`} ref={scrollerRef}>
        {specimen ? (
          <SpecimenView entry={specimen} number={specimenNumber(entries, specimen.key)} onRemove={remove} />
        ) : (
          <div className="arc-page">
            <ArchiveHead current={isAlbum ? 'album' : 'lives'} lives={entries.length} moments={moments} />
            {isAlbum ? <AlbumView /> : <Overview entries={entries} missing={Boolean(selected)} />}
            <ArchiveFoot entries={entries} moments={moments} album={isAlbum} />
          </div>
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
  return (
    <section className="arc-overview" aria-labelledby="arc-title">
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
            const no = pad3(entries.length - i)
            return (
              <li key={e.key}>
                <a className="arc-cell" href={hrefFor(e.key)} title={w ? `“${w.text}”` : undefined}>
                  <span className="arc-cell__stage">
                    <Remains entry={e} className="arc-cell__remains" style={{ '--arc-scale': pose.scale }} />
                  </span>
                  <span className="arc-cell__name">{e.name}</span>
                  <span className="arc-cell__meta">No. {no}</span>
                </a>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

/** Under the collection: what is kept, and where. */
function ArchiveFoot({ entries, moments, album }) {
  const species = new Set(entries.map((e) => e.fossilId)).size
  const watched = entries.reduce((sum, e) => sum + (e.watched || 0), 0)
  const parts = album
    ? [`${moments} ${moments === 1 ? 'moment' : 'moments'}`]
    : [`${entries.length} kept`, `${species} species`, ...(watched ? [`${minutes(watched)} witnessed`] : [])]
  return (
    <footer className="arc-foot">
      <span>
        <i aria-hidden="true" />
        {parts.join(' — ')}
      </span>
      <span>Born Another — kept in this browser</span>
    </footer>
  )
}

/* ------------------------------------------------------------------ */

/**
 * One kept life: its specimen card in the middle of the dimmed archive, and
 * the choices outside the card (back, export the card as a PNG, remove,
 * born another).
 */
function SpecimenView({ entry, number, onRemove }) {
  const [exporting, setExporting] = useState(false)
  const exportCard = async () => {
    if (exporting) return
    setExporting(true)
    try {
      await exportSpecimenCard(entry, number)
    } finally {
      setExporting(false)
    }
  }
  return (
    <div className="arc-cardpage">
      <SpecimenCard entry={entry} number={number} />
      <nav className="arc-cardpage__actions" aria-label="Specimen">
        <a href="#archive" className="arc-cardpage__link">
          ← Life Archive
        </a>
        <button type="button" className="arc-cardpage__export" onClick={exportCard} disabled={exporting} aria-busy={exporting}>
          <svg viewBox="0 0 14 14" aria-hidden="true">
            <path d="M7 1.5v7M4 6l3 3 3-3M1.5 10v2.5h11V10" />
          </svg>
          {exporting ? 'Exporting…' : 'Export card'}
        </button>
        <span className="arc-cardpage__more">
          <button
            type="button"
            className="arc-cardpage__link"
            onClick={() => {
              if (window.confirm(`Remove ${entry.name}, No. ${number} from your archive? This cannot be undone.`)) onRemove(entry.key)
            }}
          >
            Remove
          </button>
          <a href="#world-final" className="arc-cardpage__link">
            Born another
          </a>
        </span>
      </nav>
    </div>
  )
}
