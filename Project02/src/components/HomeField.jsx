import { useEffect, useRef } from 'react'
import { generateCurlNoiseMap } from '../noise/generateNoiseMap.js'

const MASK_BLOBS = [
  { x: 0.66, y: 0.46, rx: 0.46, ry: 0.5, p: 1 },
  { x: 0.8, y: 0.3, rx: 0.32, ry: 0.34, p: 0.92 },
  { x: 0.78, y: 0.7, rx: 0.34, ry: 0.38, p: 0.9 },
  { x: 0.5, y: 0.5, rx: 0.28, ry: 0.32, p: 0.82 },
  { x: 0.36, y: 0.32, rx: 0.22, ry: 0.2, p: 0.62 },
  { x: 0.22, y: 0.52, rx: 0.18, ry: 0.16, p: 0.5 },
  { x: 0.38, y: 0.74, rx: 0.24, ry: 0.2, p: 0.58 },
  { x: 0.52, y: 0.18, rx: 0.2, ry: 0.16, p: 0.5 },
]

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function edgeNoise(u, v) {
  return (
    hash2(u * 3.1, v * 2.7) * 0.5 +
    hash2(u * 6.4, v * 5.8) * 0.32 +
    hash2(u * 12.2, v * 11.6) * 0.18
  )
}

function smoothstep(t) {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

/** Visual silhouette only — does not change the generated curl field. */
function organicCover(u, v) {
  const warp = (edgeNoise(u, v) - 0.5) * 0.36
  let cover = 0
  for (let i = 0; i < MASK_BLOBS.length; i++) {
    const b = MASK_BLOBS[i]
    const d = Math.hypot((u - b.x) / b.rx, (v - b.y) / b.ry) + warp
    cover = Math.max(cover, smoothstep(1 - d) * b.p)
  }
  const rim = Math.min(smoothstep((1 - u) / 0.1), smoothstep(v / 0.1), smoothstep((1 - v) / 0.12), 1)
  return cover * rim
}

/**
 * Full-bleed curl-noise field for the homepage.
 * Density and voids come from magnitude, in the same plotted-dot language as the 2D map.
 */
export default function HomeField({ className }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const timeRef = useRef(0.6)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return undefined

    const generate = () => {
      mapRef.current = generateCurlNoiseMap({
        resolution: 80,
        scale: 2.6,
        octaves: 3,
        strength: 1.2,
        time: timeRef.current,
        shapeOp: 'none',
        shapeAmount: 0,
      })
    }

    const draw = () => {
      const noiseMap = mapRef.current
      if (!noiseMap) return

      const w = container.clientWidth || 960
      const h = container.clientHeight || 640
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const fieldX = Math.round(w * 0.02)
      const fieldY = Math.round(h * 0.06)
      const fieldW = Math.max(1, w - fieldX - Math.round(w * 0.05))
      const fieldH = Math.max(1, h - fieldY - Math.round(h * 0.07))
      const { resolution: res, mag, vx, vy } = noiseMap
      const denom = Math.max(1, res - 1)

      for (let j = 0; j < res; j++) {
        for (let i = 0; i < res; i++) {
          const idx = j * res + i
          const u = i / denom
          const v = j / denom
          const cover = organicCover(u, v)
          const m = mag[idx]
          if (m < 0.04 || cover < 0.06) continue
          const x = fieldX + u * fieldW
          const y = fieldY + v * fieldH
          const r = (0.5 + mag[idx] * 3.25) * (0.5 + cover * 0.55)
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          const a = Math.min(1, (0.34 + m * 0.82) * Math.max(cover, 0.42))
          ctx.fillStyle = mag[idx] > 0.68
            ? `rgba(255, 20, 147, ${a})`
            : `rgba(255, 255, 255, ${a})`
          ctx.fill()
        }
      }

      const step = Math.max(3, Math.floor(res / 9))
      ctx.lineWidth = 1
      for (let j = step / 2; j < res; j += step) {
        for (let i = step / 2; i < res; i += step) {
          const idx = Math.floor(j) * res + Math.floor(i)
          const u = i / denom
          const v = j / denom
          const cover = organicCover(u, v)
          const m = mag[idx]
          if (m < 0.18 || cover < 0.22) continue
          const x = fieldX + u * fieldW
          const y = fieldY + v * fieldH
          const len = (4 + m * 7) * cover
          const ang = Math.atan2(vy[idx], vx[idx])
          const dx = Math.cos(ang) * len
          const dy = -Math.sin(ang) * len
          ctx.strokeStyle = `rgba(255, 20, 147, ${Math.min(1, (0.48 + m * 0.52) * Math.max(cover, 0.5))})`
          ctx.beginPath()
          ctx.moveTo(x - dx * 0.2, y - dy * 0.2)
          ctx.lineTo(x + dx * 0.55, y + dy * 0.55)
          ctx.stroke()
        }
      }
    }

    generate()
    draw()

    let raf = 0
    let last = performance.now()
    const loop = (now) => {
      if (now - last > 70) {
        timeRef.current += 0.02
        generate()
        draw()
        last = now
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const ro = new ResizeObserver(draw)
    ro.observe(container)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <div ref={containerRef} className={className}>
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  )
}
