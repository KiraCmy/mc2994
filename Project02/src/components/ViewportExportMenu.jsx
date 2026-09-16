import { useEffect, useId, useRef, useState } from 'react'
import {
  exportHeightMap,
  exportTerrainGltf,
  exportTerrainObj,
  exportViewportPng,
} from '../export/exportTerrain.js'

export const EXPORT_OPTIONS_FULL = [
  { id: 'png', label: 'PNG Image' },
  { id: 'height', label: 'Height Map' },
  { id: 'obj', label: '3D Mesh (OBJ)' },
  { id: 'gltf', label: '3D Mesh (GLTF)' },
]

export const EXPORT_OPTIONS_SCREENSHOT = [{ id: 'png', label: 'PNG Image' }]

/**
 * Compact export control for visualization viewports.
 * Sits inside the viz stage, separate from VIEW / DISPLAY and the parameter panel.
 */
export default function ViewportExportMenu({
  noiseMap,
  displace,
  gridScale,
  capturePng,
  options = EXPORT_OPTIONS_FULL,
  filePrefix = 'viewport',
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return undefined

    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const runExport = async (id) => {
    setOpen(false)
    if (id === 'png') {
      exportViewportPng(capturePng, filePrefix)
      return
    }
    if (id === 'height') {
      exportHeightMap(noiseMap, filePrefix)
      return
    }
    if (id === 'obj') {
      exportTerrainObj(noiseMap, displace, gridScale, filePrefix)
      return
    }
    if (id === 'gltf') {
      await exportTerrainGltf(noiseMap, displace, gridScale, filePrefix)
    }
  }

  return (
    <div ref={rootRef} className={`viewport-export${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="viewport-export-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        EXPORT ↓
      </button>
      {open ? (
        <div id={menuId} className="viewport-export-menu" role="menu" aria-label="Export">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="menuitem"
              className="viewport-export-item"
              onClick={() => runExport(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
