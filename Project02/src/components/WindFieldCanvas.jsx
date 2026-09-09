import { useEffect, useRef } from 'react'
import { sampleField } from '../noise/generateNoiseMap.js'

/**
 * Wind field viz: short directional lines from shared curl-noise (vx, vy, mag).
 * Vectors are drawn directly from noiseMap — never stored in React state.
 */
export default function WindFieldCanvas({
  noiseMap,
  windStrength = 1,
  vectorDensity = 24,
  className,
}) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !noiseMap) return

    const draw = () => {
      const w = container.clientWidth || 480
      const h = container.clientHeight || 480
      const size = Math.min(w, h)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)

      canvas.width = Math.floor(size * dpr)
      canvas.height = Math.floor(size * dpr)
      canvas.style.width = `${size}px`
      canvas.style.height = `${size}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size, size)
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, size, size)

      const pad = Math.round(size * 0.06)
      const inner = size - pad * 2
      const { resolution: res, vx, vy, mag } = noiseMap
      const density = Math.max(4, Math.min(64, Math.floor(vectorDensity)))
      const gain = Math.max(0.05, windStrength)

      // Soft structural grid
      ctx.strokeStyle = '#2d2d2d'
      ctx.lineWidth = 1
      ctx.beginPath()
      const gridN = 8
      for (let i = 0; i <= gridN; i++) {
        const t = i / gridN
        const x = pad + t * inner
        const y = pad + t * inner
        ctx.moveTo(x, pad)
        ctx.lineTo(x, size - pad)
        ctx.moveTo(pad, y)
        ctx.lineTo(size - pad, y)
      }
      ctx.stroke()

      const denom = Math.max(1, density - 1)
      for (let j = 0; j < density; j++) {
        for (let i = 0; i < density; i++) {
          const u = i / denom
          const v = j / denom
          const cx = sampleField(vx, res, u, v)
          const cy = sampleField(vy, res, u, v)
          const m = sampleField(mag, res, u, v)

          const x = pad + u * inner
          const y = pad + v * inner
          const ang = Math.atan2(cy, cx)
          const len = (3 + m * 14) * gain
          const alpha = Math.min(1, 0.25 + m * 0.75 * Math.min(1.5, gain))

          const dx = Math.cos(ang) * len
          const dy = -Math.sin(ang) * len

          ctx.strokeStyle = `rgba(224, 64, 160, ${alpha})`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(x - dx * 0.35, y - dy * 0.35)
          ctx.lineTo(x + dx * 0.65, y + dy * 0.65)
          ctx.stroke()
        }
      }

      ctx.strokeStyle = '#2d2d2d'
      ctx.strokeRect(pad + 0.5, pad + 0.5, inner - 1, inner - 1)
    }

    draw()

    const ro = new ResizeObserver(draw)
    ro.observe(container)
    return () => ro.disconnect()
  }, [noiseMap, windStrength, vectorDensity])

  return (
    <div ref={containerRef} className={className}>
      <canvas ref={canvasRef} aria-label="Wind field from curl noise" />
    </div>
  )
}
