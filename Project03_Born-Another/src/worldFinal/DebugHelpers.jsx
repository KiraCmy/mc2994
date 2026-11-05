/**
 * World Final — temporary orientation diagnostics (axes, XZ grid, markers).
 * Grid floats above the highest terrain point so it never intersects or
 * z-fights with the seabed.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { normalizeWorldFinalConfig, WORLD_FINAL_TERRAIN_EXTENT } from './config.js'
import { driftPose, explorePose, overviewPose } from './cameraPoses.js'
import { heightAt } from './heightField.js'

function maxTerrainHeight(cfg) {
  const R = cfg.basinRadius * WORLD_FINAL_TERRAIN_EXTENT
  let max = -Infinity
  for (let ix = 0; ix <= 64; ix += 1) {
    for (let iz = 0; iz <= 64; iz += 1) {
      const x = -R + (ix / 64) * 2 * R
      const z = -R + (iz / 64) * 2 * R
      max = Math.max(max, heightAt(x, z, cfg))
    }
  }
  return max
}

function PoseMarker({ pose, color }) {
  const arrow = useMemo(() => {
    const dir = pose.target.clone().sub(pose.position).normalize()
    return new THREE.ArrowHelper(dir, new THREE.Vector3(), 32, color, 7, 4)
  }, [pose, color])

  return (
    <group position={pose.position.toArray()}>
      <mesh>
        <sphereGeometry args={[2.4, 12, 12]} />
        <meshBasicMaterial color={color} fog={false} />
      </mesh>
      <primitive object={arrow} />
    </group>
  )
}

export default function DebugHelpers({ config, visible = true }) {
  const cfg = useMemo(() => normalizeWorldFinalConfig(config), [config])
  const poses = useMemo(
    () => ({
      drift: driftPose(cfg),
      explore: explorePose(cfg),
      overview: overviewPose(cfg),
    }),
    [cfg],
  )
  const gridY = useMemo(() => maxTerrainHeight(cfg) + 1, [cfg])

  const grid = useMemo(() => {
    const helper = new THREE.GridHelper(cfg.basinRadius * 2, 20, '#c45a7a', '#8f88a0')
    helper.material.transparent = true
    helper.material.opacity = 0.45
    helper.material.depthWrite = false
    return helper
  }, [cfg.basinRadius])

  if (!visible) return null

  return (
    <group name="world-final-debug">
      <axesHelper args={[cfg.basinRadius * 0.35]} position={[0, gridY, 0]} />
      <primitive object={grid} position={[0, gridY, 0]} />
      <PoseMarker pose={poses.drift} color="#7ec8e8" />
      <PoseMarker pose={poses.explore} color="#5ecf9a" />
      <PoseMarker pose={poses.overview} color="#f0c060" />
    </group>
  )
}
