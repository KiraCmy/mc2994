import { useEffect, useMemo, useRef, useState } from 'react'
import { CARD_W, cardData, drawSpecimenCard, loadCardAssets } from './specimenCard.js'

/**
 * One kept life as a portrait specimen card (4:5), drawn on a canvas at the
 * screen's pixel density — the same drawing the PNG export uses. The text it
 * shows is repeated below for screen readers.
 */
export default function SpecimenCard({ entry, number }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const data = useMemo(() => cardData(entry, number), [entry, number])
  const [assets, setAssets] = useState(null)

  useEffect(() => {
    let alive = true
    setAssets(null)
    loadCardAssets(entry).then((a) => alive && setAssets(a))
    return () => {
      alive = false
    }
  }, [entry])

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return undefined
    const draw = () => {
      const w = wrap.clientWidth
      if (!w) return
      const dpr = Math.min(3, window.devicePixelRatio || 1)
      const px = Math.round(w * dpr)
      canvas.width = px
      canvas.height = Math.round((px * 5) / 4)
      drawSpecimenCard(canvas.getContext('2d'), px, data, assets)
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [data, assets])

  const env = data.env
  return (
    <figure ref={wrapRef} className="arc-card" data-card-width={CARD_W}>
      <canvas ref={canvasRef} className="arc-card__canvas" role="img" aria-label={`Archive card ${data.no}: ${data.name}`} />
      <figcaption className="arc-card__text">
        <p>
          Archive card {data.no}. {data.name}, a life that could have been.
        </p>
        <dl>
          <dt>Species</dt>
          <dd>{data.latin}</dd>
          <dt>Lifespan</dt>
          <dd>{data.lifespan}</dd>
          <dt>Environment</dt>
          <dd>
            Temperature {env.temperature.toFixed(2)}, moisture {env.moisture.toFixed(2)}, turbulence {env.turbulence.toFixed(2)}
          </dd>
          <dt>Final condition</dt>
          <dd>{data.condition}</dd>
          <dt>Last words</dt>
          <dd>{data.last ? `“${data.last.text}”` : 'No words'}</dd>
        </dl>
      </figcaption>
    </figure>
  )
}
