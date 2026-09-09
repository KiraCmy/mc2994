import { useEffect, useRef, useState } from 'react'
import NoiseMap2D from './NoiseMap2D.jsx'

const WIN_W = 220
const WIN_H = 260
/** Keep clear of brand (top-left) and control bar (bottom). */
const SAFE = { left: 280, top: 12, right: 16, bottom: 140 }

function clampPos(x, y) {
  const maxX = Math.max(SAFE.left, window.innerWidth - WIN_W - SAFE.right)
  const maxY = Math.max(SAFE.top, window.innerHeight - WIN_H - SAFE.bottom)
  return {
    x: Math.min(maxX, Math.max(SAFE.left, x)),
    y: Math.min(maxY, Math.max(SAFE.top, y)),
  }
}

function defaultPos() {
  return clampPos(window.innerWidth - WIN_W - SAFE.right, SAFE.top + 8)
}

/**
 * Draggable floating window for the live 2D map over the 3D page.
 * Kept away from the logo and bottom controls.
 */
export default function FloatingMapWindow({ open, onClose, noiseMap, resolution }) {
  const panelRef = useRef(null)
  const dragRef = useRef(null)
  const [pos, setPos] = useState(defaultPos)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (open) setPos(defaultPos())
  }, [open])

  useEffect(() => {
    if (!open) return undefined

    const onMove = (event) => {
      const drag = dragRef.current
      if (!drag) return
      setPos(clampPos(event.clientX - drag.ox, event.clientY - drag.oy))
    }

    const onUp = () => {
      if (!dragRef.current) return
      dragRef.current = null
      setDragging(false)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [open])

  useEffect(() => {
    const onResize = () => setPos((p) => clampPos(p.x, p.y))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (!open) return null

  const startDrag = (event) => {
    if (event.button !== 0) return
    if (event.target.closest('button')) return
    const rect = panelRef.current?.getBoundingClientRect()
    if (!rect) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragRef.current = {
      ox: event.clientX - rect.left,
      oy: event.clientY - rect.top,
    }
    setDragging(true)
  }

  return (
    <div
      ref={panelRef}
      className={`float-window${dragging ? ' is-dragging' : ''}`}
      style={{ left: pos.x, top: pos.y }}
      role="dialog"
      aria-label="Generated 2D noise map"
    >
      <div
        className="float-window-chrome"
        onPointerDown={startDrag}
        title="Drag to reposition"
      >
        <span className="float-window-title">2D MAP · DRAG</span>
        <span className="float-window-meta">
          {resolution}×{resolution}
        </span>
        <button
          type="button"
          className="float-window-close"
          onClick={onClose}
          aria-label="Close 2D map window"
        >
          ×
        </button>
      </div>
      <NoiseMap2D className="float-map" noiseMap={noiseMap} />
    </div>
  )
}
