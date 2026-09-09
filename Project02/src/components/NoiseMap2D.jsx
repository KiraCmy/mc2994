import { useEffect, useRef } from 'react'

/**
 * 2D curl-noise map rendered as a plotted field:
 * thin structural grid + scaled white dots + sparse annotation ticks.
 */
export default function NoiseMap2D({ noiseMap, className }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !noiseMap) return

    const { resolution: res, mag, vx, vy } = noiseMap
    const size = Math.min(canvas.clientWidth || 280, canvas.clientHeight || 280)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.floor(size * dpr)
    canvas.height = Math.floor(size * dpr)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)

    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, size, size)

    const pad = Math.round(size * 0.08)
    const inner = size - pad * 2
    const gridCount = Math.min(res, 9)

    // Poster-like structural grid
    ctx.strokeStyle = '#5f5f5f'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 0; i < gridCount; i++) {
      const t = i / Math.max(1, gridCount - 1)
      const x = pad + t * inner
      const y = pad + t * inner
      ctx.moveTo(x, pad)
      ctx.lineTo(x, size - pad)
      ctx.moveTo(pad, y)
      ctx.lineTo(size - pad, y)
    }
    ctx.stroke()

    // Dot matrix sampled from the map
    ctx.fillStyle = '#f4f4f4'
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const idx = j * res + i
        const x = pad + (i / Math.max(1, res - 1)) * inner
        const y = pad + (j / Math.max(1, res - 1)) * inner
        const r = 0.8 + mag[idx] * 4.6
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Sparse directional strokes as annotation
    const step = Math.max(2, Math.floor(res / 10))
    ctx.strokeStyle = '#e040a0'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let j = step / 2; j < res; j += step) {
      for (let i = step / 2; i < res; i += step) {
        const idx = Math.floor(j) * res + Math.floor(i)
        const x = pad + (i / Math.max(1, res - 1)) * inner
        const y = pad + (j / Math.max(1, res - 1)) * inner
        const len = 4 + mag[idx] * 8
        const ang = Math.atan2(vy[idx], vx[idx])
        const dx = Math.cos(ang) * len
        const dy = -Math.sin(ang) * len
        ctx.moveTo(x - dx * 0.25, y - dy * 0.25)
        ctx.lineTo(x + dx * 0.45, y + dy * 0.45)
      }
    }
    ctx.stroke()

    // Outer frame and axis hairlines
    ctx.strokeStyle = '#2d2d2d'
    ctx.strokeRect(pad + 0.5, pad + 0.5, inner - 1, inner - 1)
    ctx.beginPath()
    ctx.moveTo(pad, size * 0.5)
    ctx.lineTo(size - pad, size * 0.5)
    ctx.moveTo(size * 0.5, pad)
    ctx.lineTo(size * 0.5, size - pad)
    ctx.stroke()
  }, [noiseMap])

  return (
    <div className={className}>
      <canvas ref={canvasRef} aria-label="2D curl noise map" />
    </div>
  )
}
