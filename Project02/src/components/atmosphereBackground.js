import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/** Dark, low-sat backdrop: blue-gray → dusty mauve with a soft center lift. */
export function createAtmosphereBackgroundTexture(size = 512) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const vertical = ctx.createLinearGradient(0, 0, 0, size)
  vertical.addColorStop(0, '#11131B')
  vertical.addColorStop(0.48, '#1D1B26')
  vertical.addColorStop(1, '#29232B')
  ctx.fillStyle = vertical
  ctx.fillRect(0, 0, size, size)

  // Soft radial lift behind the terrain — no hard bands, no pink
  const cx = size * 0.5
  const cy = size * 0.46
  const radial = ctx.createRadialGradient(cx, cy, size * 0.04, cx, cy, size * 0.7)
  radial.addColorStop(0, 'rgba(62, 56, 70, 0.2)')
  radial.addColorStop(0.4, 'rgba(45, 42, 54, 0.1)')
  radial.addColorStop(1, 'rgba(17, 19, 27, 0)')
  ctx.fillStyle = radial
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

/** Sets scene.background to the atmosphere texture and disposes on unmount. */
export function AtmosphereBackground() {
  const scene = useThree((state) => state.scene)

  useEffect(() => {
    const texture = createAtmosphereBackgroundTexture()
    if (!texture) return undefined
    scene.background = texture
    return () => {
      if (scene.background === texture) scene.background = null
      texture.dispose()
    }
  }, [scene])

  return null
}
