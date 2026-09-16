import { useEffect, useRef } from 'react'

/**
 * 2D particle view — draws shared particle buffers on one canvas.
 * Physics runs in App via particleSystem.step (central rAF).
 */
export default function ParticleFlowCanvas({
  particleSystem,
  particleCount = 500,
  particleSize = 1.6,
  trailLength = 0.65,
  overMap = false,
  className,
}) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const paramsRef = useRef({ particleSize, trailLength, particleCount, overMap })
  paramsRef.current = { particleSize, trailLength, particleCount, overMap }

  const drawRef = useRef(() => {})

  drawRef.current = () => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !particleSystem) return

    particleSystem.ensureCount(paramsRef.current.particleCount)

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

    const trail = Math.min(1, Math.max(0, paramsRef.current.trailLength))
    const fade = trail <= 0.001 ? 1 : 0.04 + (1 - trail) * 0.35
    if (paramsRef.current.overMap) {
      // Soft veil so trails persist without burying the shared map underneath.
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.28, fade * 0.45)})`
    } else {
      ctx.fillStyle = `rgba(0, 0, 0, ${fade})`
    }
    ctx.fillRect(0, 0, size, size)

    const pad = Math.round(size * (paramsRef.current.overMap ? 0.08 : 0.06))
    const inner = size - pad * 2
    const radius = Math.max(0.5, paramsRef.current.particleSize)
    const x = particleSystem.getPosX()
    const y = particleSystem.getPosY()
    const n = particleSystem.getCount()

    ctx.fillStyle = '#ff1493'
    for (let i = 0; i < n; i++) {
      ctx.beginPath()
      ctx.arc(pad + x[i] * inner, pad + y[i] * inner, radius, 0, Math.PI * 2)
      ctx.fill()
    }

    if (!paramsRef.current.overMap) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
      ctx.lineWidth = 1
      ctx.strokeRect(pad + 0.5, pad + 0.5, inner - 1, inner - 1)
    }
  }

  useEffect(() => {
    if (!particleSystem) return undefined
    const bound = () => drawRef.current()
    particleSystem._draw2d = bound
    particleSystem.ensureCount(particleCount)
    bound()
    return () => {
      if (particleSystem._draw2d === bound) particleSystem._draw2d = null
    }
  }, [particleSystem, particleCount])

  useEffect(() => {
    const canvas = canvasRef.current
    if (overMap && canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
    drawRef.current()
  }, [particleSize, trailLength, overMap])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined
    const ro = new ResizeObserver(() => drawRef.current())
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={containerRef} className={className}>
      <canvas ref={canvasRef} aria-label="Particle flow on curl wind field" />
    </div>
  )
}
