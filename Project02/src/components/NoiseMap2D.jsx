import { useEffect, useRef } from 'react'

/**
 * 2D curl-noise map:
 * - dots: plotted field with structural grid + magenta ticks
 * - height: continuous grayscale from shared noiseMap.height (same as 3D Terrain)
 */
export default function NoiseMap2D({
  noiseMap,
  className,
  captureApiRef = null,
  displayMode = 'dots',
}) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!captureApiRef) return undefined
    captureApiRef.current = {
      capturePng: () => {
        const canvas = canvasRef.current
        if (!canvas) return null
        return canvas.toDataURL('image/png')
      },
    }
    return () => {
      if (captureApiRef.current) captureApiRef.current = null
    }
  }, [captureApiRef])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !noiseMap) return

    const draw = () => {
      const { resolution: res, mag, vx, vy, height } = noiseMap
      const heightField = height ?? mag
      const w = container.clientWidth || 280
      const h = container.clientHeight || 280
      const size = Math.max(1, Math.min(w, h))
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

      const pad = Math.round(size * 0.08)
      const inner = size - pad * 2
      const denom = Math.max(1, res - 1)

      if (displayMode === 'height') {
        const image = ctx.createImageData(res, res)
        const { data } = image
        for (let j = 0; j < res; j++) {
          for (let i = 0; i < res; i++) {
            const g = Math.max(0, Math.min(255, Math.round(heightField[j * res + i] * 255)))
            const idx = (j * res + i) * 4
            data[idx] = g
            data[idx + 1] = g
            data[idx + 2] = g
            data[idx + 3] = 255
          }
        }

        const tile = document.createElement('canvas')
        tile.width = res
        tile.height = res
        const tctx = tile.getContext('2d')
        if (!tctx) return
        tctx.putImageData(image, 0, 0)

        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(tile, pad, pad, inner, inner)

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
        ctx.lineWidth = 1
        ctx.strokeRect(pad + 0.5, pad + 0.5, inner - 1, inner - 1)
        return
      }

      const gridCount = Math.min(res, 9)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
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

      ctx.fillStyle = '#f4f4f4'
      for (let j = 0; j < res; j++) {
        for (let i = 0; i < res; i++) {
          const idx = j * res + i
          const x = pad + (i / denom) * inner
          const y = pad + (j / denom) * inner
          const r = 0.48 + mag[idx] * 2.4
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      const step = Math.max(2, Math.floor(res / 10))
      ctx.strokeStyle = '#ff1493'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let j = step / 2; j < res; j += step) {
        for (let i = step / 2; i < res; i += step) {
          const idx = Math.floor(j) * res + Math.floor(i)
          const x = pad + (i / denom) * inner
          const y = pad + (j / denom) * inner
          const len = 4 + mag[idx] * 8
          const ang = Math.atan2(vy[idx], vx[idx])
          const dx = Math.cos(ang) * len
          const dy = -Math.sin(ang) * len
          ctx.moveTo(x - dx * 0.25, y - dy * 0.25)
          ctx.lineTo(x + dx * 0.45, y + dy * 0.45)
        }
      }
      ctx.stroke()

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
      ctx.strokeRect(pad + 0.5, pad + 0.5, inner - 1, inner - 1)
      ctx.beginPath()
      ctx.moveTo(pad, size * 0.5)
      ctx.lineTo(size - pad, size * 0.5)
      ctx.moveTo(size * 0.5, pad)
      ctx.lineTo(size * 0.5, size - pad)
      ctx.stroke()
    }

    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(container)
    return () => ro.disconnect()
  }, [noiseMap, displayMode])

  return (
    <div ref={containerRef} className={className}>
      <canvas
        ref={canvasRef}
        aria-label={displayMode === 'height' ? '2D noise height map' : '2D curl noise map'}
      />
    </div>
  )
}
