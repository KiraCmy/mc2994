import { useCallback, useEffect, useMemo, useState } from 'react'
import { ALBUM_EVENT, listCaptures, removeCapture } from '../playground/finalHabitat/album.js'
import './album.css'

/** "10 Nov 2026 · 21:27" in the viewer's locale. */
function when(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const date = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return `${date} · ${time}`
}

function waterLine(env = {}) {
  const f = (v) => (Number.isFinite(v) ? v.toFixed(2) : '—')
  return `T ${f(env.temperature)} · M ${f(env.moisture)} · Tu ${f(env.turbulence)}`
}

/**
 * The album: moments of the world the viewer captured in World Final, as
 * they were (no text on them). A grid of frames; one opens full-size with
 * its time and water, to step through, download or remove.
 */
export default function AlbumView() {
  const [shots, setShots] = useState(null)
  const [open, setOpen] = useState(-1)

  const load = useCallback(() => {
    listCaptures().then(setShots)
  }, [])
  useEffect(() => {
    load()
    window.addEventListener(ALBUM_EVENT, load)
    return () => window.removeEventListener(ALBUM_EVENT, load)
  }, [load])

  /* Object URLs for the stored pictures, released when they change. */
  const urls = useMemo(() => (shots ?? []).map((s) => URL.createObjectURL(s.blob)), [shots])
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])

  const count = shots?.length ?? 0
  const step = useCallback((d) => setOpen((i) => (i < 0 || !count ? i : (i + d + count) % count)), [count])
  useEffect(() => {
    if (open < 0) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(-1)
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, step])

  const remove = async (shot) => {
    if (!window.confirm('Remove this moment from your album? This cannot be undone.')) return
    await removeCapture(shot.key)
    setOpen(-1)
    load()
  }

  const current = open >= 0 && shots ? shots[open] : null

  return (
    <section className="arc-album" aria-labelledby="arc-album-title">

      {shots && count === 0 ? (
        <div className="arc-overview__empty">
          <p>No moments yet. In World Final, press “Capture the world” when the water looks the way you want to keep it.</p>
          <a className="arc-button" href="#world-final">Enter World Final</a>
        </div>
      ) : null}

      {count ? (
        <ol className="arc-album__grid">
          {shots.map((s, i) => (
            <li key={s.key}>
              <button type="button" className="arc-album__cell" onClick={() => setOpen(i)} aria-label={`Open the moment from ${when(s.savedAt)}`}>
                <img src={urls[i]} alt="" loading="lazy" />
                <span className="arc-album__time">{when(s.savedAt)}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : null}

      {current ? (
        <div className="arc-album__view" role="dialog" aria-modal="true" aria-label="Moment" onClick={() => setOpen(-1)}>
          <figure className="arc-album__figure" onClick={(e) => e.stopPropagation()}>
            <img src={urls[open]} alt={`The world on ${when(current.savedAt)}`} />
            <figcaption>
              <span>{when(current.savedAt)}</span>
              <span>{waterLine(current.environment)}</span>
              <span className="arc-album__actions">
                <a href={urls[open]} download={`born-another-${current.key}.${current.blob.type.includes('webp') ? 'webp' : 'jpg'}`}>
                  Download
                </a>
                <button type="button" onClick={() => remove(current)}>
                  Remove
                </button>
              </span>
            </figcaption>
          </figure>
          {count > 1 ? (
            <>
              <button type="button" className="arc-album__nav is-prev" aria-label="Previous moment" onClick={(e) => (e.stopPropagation(), step(-1))}>
                ←
              </button>
              <button type="button" className="arc-album__nav is-next" aria-label="Next moment" onClick={(e) => (e.stopPropagation(), step(1))}>
                →
              </button>
            </>
          ) : null}
          <button type="button" className="arc-album__close" aria-label="Close" onClick={() => setOpen(-1)}>
            Close ✕
          </button>
        </div>
      ) : null}
    </section>
  )
}
