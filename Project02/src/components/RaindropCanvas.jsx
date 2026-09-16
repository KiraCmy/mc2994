import { useEffect, useRef } from 'react'

/**
 * Magenta raindrops over the 2D erosion height map.
 * Falling drops draw smaller / softer; surface flow draws full dots.
 */
export default function RaindropCanvas({
  raindropSystem,
  rainAmount = 120,
  className,
}) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const amountRef = useRef(rainAmount)
  amountRef.current = rainAmount

  const drawRef = useRef(() => {})

  drawRef.current = () => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !raindropSystem) return

    raindropSystem.ensureCount(amountRef.current)

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

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)

    const pad = Math.round(size * 0.06)
    const inner = size - pad * 2
    const x = raindropSystem.getPosX()
    const y = raindropSystem.getPosY()
    const hy = raindropSystem.getHeightY()
    const phase = raindropSystem.getPhase()
    const n = raindropSystem.getCount()
    if (!x || !y || n === 0) return

    const falling = raindropSystem.PHASE_FALLING

    for (let i = 0; i < n; i++) {
      const px = pad + x[i] * inner
      const py = pad + y[i] * inner
      if (phase && phase[i] === falling) {
        // Hint of altitude: smaller, softer while still in the air
        const alt = hy ? Math.min(1, Math.max(0, hy[i] / 2.5)) : 0.5
        const r = 0.7 + (1 - alt) * 0.7
        ctx.fillStyle = `rgba(255, 20, 147, ${0.22 + (1 - alt) * 0.45})`
        ctx.beginPath()
        ctx.arc(px, py, r, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillStyle = '#ff1493'
        ctx.beginPath()
        ctx.arc(px, py, 1.35, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  useEffect(() => {
    if (!raindropSystem) return undefined
    const bound = () => drawRef.current()
    raindropSystem._draw2d = bound
    raindropSystem.ensureCount(rainAmount)
    bound()
    return () => {
      if (raindropSystem._draw2d === bound) raindropSystem._draw2d = null
    }
  }, [raindropSystem, rainAmount])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined
    const ro = new ResizeObserver(() => drawRef.current())
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={containerRef} className={className}>
      <canvas ref={canvasRef} aria-label="Hydraulic erosion raindrops" />
    </div>
  )
}
