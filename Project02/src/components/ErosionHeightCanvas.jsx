import { useEffect, useRef } from 'react'

/**
 * 2D grayscale view of the erosion height field only (no rain / water overlay).
 */
export default function ErosionHeightCanvas({ erosionTerrain, version = 0, className }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const tileRef = useRef(null)
  const drawRef = useRef(() => {})

  drawRef.current = () => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !erosionTerrain?.isReady()) return

    const res = erosionTerrain.getResolution()
    const heights = erosionTerrain.getHeights()
    if (!heights || res < 2) return

    const w = container.clientWidth || 480
    const h = container.clientHeight || 480
    const size = Math.min(w, h)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    if (canvas.width !== Math.floor(size * dpr) || canvas.height !== Math.floor(size * dpr)) {
      canvas.width = Math.floor(size * dpr)
      canvas.height = Math.floor(size * dpr)
      canvas.style.width = `${size}px`
      canvas.style.height = `${size}px`
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let tile = tileRef.current
    if (!tile || tile.width !== res) {
      tile = document.createElement('canvas')
      tile.width = res
      tile.height = res
      tileRef.current = tile
    }
    const tctx = tile.getContext('2d')
    if (!tctx) return

    let hMin = Infinity
    let hMax = -Infinity
    for (let k = 0; k < heights.length; k++) {
      hMin = Math.min(hMin, heights[k])
      hMax = Math.max(hMax, heights[k])
    }
    const span = Math.max(1e-6, hMax - hMin)

    const image = tctx.createImageData(res, res)
    const { data } = image
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const cell = j * res + i
        const t = (heights[cell] - hMin) / span
        const g = Math.round(40 + t * 200)
        const idx = cell * 4
        data[idx] = g
        data[idx + 1] = g
        data[idx + 2] = g
        data[idx + 3] = 255
      }
    }
    tctx.putImageData(image, 0, 0)

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, size, size)

    const pad = Math.round(size * 0.06)
    const inner = size - pad * 2
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(tile, pad, pad, inner, inner)

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
    ctx.lineWidth = 1
    ctx.strokeRect(pad + 0.5, pad + 0.5, inner - 1, inner - 1)
  }

  useEffect(() => {
    if (!erosionTerrain) return undefined
    const bound = () => drawRef.current()
    erosionTerrain._draw2d = bound
    bound()
    return () => {
      if (erosionTerrain._draw2d === bound) erosionTerrain._draw2d = null
    }
  }, [erosionTerrain, version])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined
    const ro = new ResizeObserver(() => drawRef.current())
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={containerRef} className={className}>
      <canvas ref={canvasRef} aria-label="Hydraulic erosion height field" />
    </div>
  )
}
