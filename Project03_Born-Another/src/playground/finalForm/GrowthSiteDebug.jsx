import { useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { createExp05SurfaceEvaluator } from './exp05SurfaceEvaluator.js'

const UP = new THREE.Vector3(0, 1, 0)

/**
 * Temporary debug: growth-site anchors + short normal ticks.
 * Disabled by default — pass debugAnchors on ExploreLifeScene to enable.
 */
export default function GrowthSiteDebug({
  life,
  morphStrength = 1,
  deformationStrength = 1,
  lobeAmplitude = 1,
  enabled = false,
}) {
  const seed = life?.seed

  const evaluator = useMemo(
    () => createExp05SurfaceEvaluator({ seed }),
    [seed],
  )

  useLayoutEffect(
    () => () => {
      evaluator.dispose()
    },
    [evaluator],
  )

  const markers = useMemo(() => {
    if (!enabled || !life) return []
    const sites = life.outputs?.surface?.spatialGrowthSites ?? []
    const opts = {
      finiteDifferenceNormal: false,
      morphStrength,
      deformationStrength,
      lobeAmplitude,
    }
    const normal = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    return sites
      .map((site) => {
        const seated = evaluator.evaluate(site.direction, life, opts)
        if (!seated) return null
        normal
          .set(seated.normal[0], seated.normal[1], seated.normal[2])
          .normalize()
        quat.setFromUnitVectors(UP, normal)
        return {
          id: site.id,
          position: seated.position,
          mid: [
            seated.position[0] + seated.normal[0] * 0.09,
            seated.position[1] + seated.normal[1] * 0.09,
            seated.position[2] + seated.normal[2] * 0.09,
          ],
          quaternion: quat.clone(),
        }
      })
      .filter(Boolean)
  }, [enabled, life, evaluator, morphStrength, deformationStrength, lobeAmplitude])

  if (!enabled || markers.length === 0) return null

  return (
    <group renderOrder={20}>
      {markers.map((marker) => (
        <group key={`site-debug-${marker.id}`}>
          <mesh position={marker.position}>
            <sphereGeometry args={[0.028, 10, 10]} />
            <meshBasicMaterial
              color="#ff3344"
              depthTest={false}
              toneMapped={false}
            />
          </mesh>
          <mesh position={marker.mid} quaternion={marker.quaternion}>
            <boxGeometry args={[0.008, 0.18, 0.008]} />
            <meshBasicMaterial
              color="#44ffaa"
              depthTest={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}
