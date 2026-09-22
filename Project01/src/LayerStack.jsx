import { useMemo } from 'react'
import { DoubleSide } from 'three'
import { generateLayerPlanes } from './generateLayerPlanes.js'

function LayerPlane({ position, width, height, color, opacity, renderOrder }) {
  return (
    <mesh position={position} renderOrder={renderOrder}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        side={DoubleSide}
      />
    </mesh>
  )
}

/**
 * Procedural stack of translucent rectangles.
 * Rotated as a group so the default view matches the reference diagonal.
 */
export default function LayerStack({
  layerCount,
  layerSpacing,
  scaleProgression,
  startColor,
  endColor,
  opacity,
}) {
  const layers = useMemo(
    () =>
      generateLayerPlanes({
        layerCount,
        layerSpacing,
        scaleProgression,
        startColor,
        endColor,
        opacity,
      }),
    [layerCount, layerSpacing, scaleProgression, startColor, endColor, opacity],
  )

  return (
    <group rotation={[-0.42, 0.55, 0.18]}>
      {layers.map((layer) => (
        <LayerPlane key={layer.id} {...layer} />
      ))}
    </group>
  )
}
