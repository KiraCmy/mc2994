import { useEffect, useState } from 'react'
import FossilPlate from './FossilPlate.jsx'
import { FOSSIL_AMMONITE } from './habitatFossil.js'

/**
 * Exp07 end of life: the habitat has faded, the crystallized husk remains,
 * and it is identified as a prehistoric creature (museum-plate overlay).
 * The plate turns over to a real fossil photograph (click / Enter).
 */
export default function FossilReveal({ fossil = FOSSIL_AMMONITE, onBornAnother, onLinger, onSave = null, saved = false, onOpenArchive = null }) {
  const photo = fossil.photo
  const [side, setSide] = useState('plate')
  const [photoState, setPhotoState] = useState('idle')
  useEffect(() => {
    setSide('plate')
    setPhotoState('idle')
  }, [fossil.id])
  const canFlip = Boolean(photo) && photoState !== 'failed'
  const showPhoto = canFlip && side === 'photo'
  const flip = () => {
    if (!canFlip) return
    if (photoState === 'idle') setPhotoState('loading')
    setSide((s) => (s === 'plate' ? 'photo' : 'plate'))
  }
  return (
    <section className="exp07-reveal" aria-labelledby="exp07-reveal-name">
      <span className="exp07-reveal__leader" aria-hidden="true" />
      <div className="exp07-reveal__card">
        <figure className={`exp07-reveal__figure${showPhoto ? ' is-photo' : ''}`}>
          {canFlip ? (
            <button
              type="button"
              className="exp07-reveal__flip"
              aria-pressed={showPhoto}
              aria-label={showPhoto ? 'Show the drawing' : `Show a photograph of a ${fossil.name} fossil`}
              onClick={flip}
            />
          ) : null}
          <FossilPlate id={fossil.id} />
          {photo && photoState !== 'idle' && photoState !== 'failed' ? (
            <img
              className={`exp07-reveal__photo${photoState === 'ready' ? ' is-ready' : ''}`}
              src={photo.src}
              alt={photo.caption}
              decoding="async"
              onLoad={() => setPhotoState('ready')}
              onError={() => {
                setPhotoState('failed')
                setSide('plate')
              }}
            />
          ) : null}
          <span className="exp07-reveal__mark" aria-hidden="true" />
          {canFlip ? (
            <figcaption className="exp07-reveal__flipcap">
              {showPhoto ? (photoState === 'ready' ? 'Drawing' : 'Loading photograph…') : 'Photograph'}
            </figcaption>
          ) : null}
        </figure>
        {showPhoto && photoState === 'ready' ? (
          <p className="exp07-reveal__credit">
            {photo.caption}.{' '}
            <a href={photo.page} target="_blank" rel="noreferrer">
              {photo.credit}
            </a>
          </p>
        ) : null}
        <p className="exp07-reveal__eyebrow">Remains identified</p>
        <h2 id="exp07-reveal-name" className="exp07-reveal__name">
          “{fossil.name}”
          <span>{fossil.latin} · {fossil.epithet}</span>
        </h2>
        <ul className="exp07-reveal__facts">
          <li>{fossil.appeared}</li>
          <li>{fossil.vanished}</li>
          <li>{fossil.span}</li>
        </ul>
        <p className="exp07-reveal__cause">
          <b>Why it vanished</b>
          {fossil.cause}
        </p>
        <p className="exp07-reveal__echo">{fossil.echo}</p>
        <div className="exp07-reveal__actions">
          {onSave ? (
            saved ? (
              <button type="button" className="exp07-reveal__ghost is-saved" onClick={onOpenArchive ?? undefined}>
                ✓ In your archive
              </button>
            ) : (
              <button type="button" className="exp07-reveal__ghost" onClick={onSave}>
                Save to archive
              </button>
            )
          ) : null}
          <button type="button" className="exp07-reveal__primary" onClick={onBornAnother}>
            Born another
          </button>
          <button type="button" className="exp07-reveal__ghost" onClick={onLinger}>
            Stay with the remains
          </button>
        </div>
      </div>
      <p className="exp07-reveal__hint" aria-hidden="true">
        <span className="exp07-reveal__dot" />
        Drag to turn the remains
      </p>
    </section>
  )
}
