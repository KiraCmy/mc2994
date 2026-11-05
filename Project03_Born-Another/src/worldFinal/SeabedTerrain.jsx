/**
 * World Final — seabed mesh. Identity transform; elevation lives in the
 * vertex buffer only (see buildSeabedGeometry).
 *
 * materialMode:
 *   shaded     — underwater lighting + haze (seabedMaterial.js)
 *   diagnostic — temporary neutral gray, double-sided, wireframe overlay
 *                (missing faces vs. shading artifacts)
 *   normals    — MeshNormalMaterial, front-side (winding / normal check)
 *
 * Shaded and diagnostic fade to transparent with distance and at the plane
 * edge so the Exp04 page background shows through.
 */
import { useEffect, useLayoutEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { buildSeabedGeometry } from './buildSeabedGeometry.js'
import { normalizeWorldFinalConfig } from './config.js'
import {
  createSeabedMaterial,
  hazeOffsetForCamera,
  updateSeabedMaterial,
} from './seabedMaterial.js'
import { createTerrainFadeCompiler, edgeFadeRadii } from './terrainFade.js'

/** Only these keys change the mesh; camera / atmosphere tweaks must not rebuild it. */
const GEOMETRY_KEYS = [
  'seed',
  'basinRadius',
  'basinDepth',
  'basinWidth',
  'basinAsymmetry',
  'ridgeHeight',
  'ridgeSpacing',
  'surfaceDetail',
  'gridRes',
]

export default function SeabedTerrain({ config, materialMode = 'shaded', hazeEnabled = true }) {
  const cfg = useMemo(() => normalizeWorldFinalConfig(config), [config])
  const geometryKey = GEOMETRY_KEYS.map((k) => cfg[k]).join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(() => buildSeabedGeometry(cfg), [geometryKey])

  useEffect(
    () => () => {
      geometry.dispose()
    },
    [geometry],
  )

  const seabedMaterial = useMemo(() => createSeabedMaterial(), [])
  useEffect(() => () => seabedMaterial.dispose(), [seabedMaterial])
  useLayoutEffect(() => {
    updateSeabedMaterial(seabedMaterial, cfg, { hazeEnabled })
  }, [seabedMaterial, cfg, hazeEnabled])

  useFrame(({ camera, clock }) => {
    const u = seabedMaterial.uniforms
    u.uHazeOffset.value = hazeOffsetForCamera(camera.position.y, cfg)
    u.uTime.value = clock.elapsedTime
  })

  const edgeUniform = useMemo(() => ({ value: new THREE.Vector2() }), [])
  edgeUniform.value.set(...edgeFadeRadii(cfg.basinRadius))
  const onBeforeCompile = useMemo(
    () => createTerrainFadeCompiler(edgeUniform),
    [edgeUniform],
  )

  if (materialMode === 'shaded') {
    return (
      <group name="world-final-seabed">
        <mesh geometry={geometry} material={seabedMaterial} frustumCulled={false} />
      </group>
    )
  }

  return (
    <group name="world-final-seabed">
      <mesh geometry={geometry} frustumCulled={false}>
        {materialMode === 'normals' && (
          <meshNormalMaterial side={THREE.FrontSide} />
        )}
        {materialMode === 'diagnostic' && (
          <meshStandardMaterial
            key="diagnostic"
            color="#9c9ca2"
            roughness={0.9}
            metalness={0}
            side={THREE.DoubleSide}
            transparent
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
            onBeforeCompile={onBeforeCompile}
          />
        )}
      </mesh>
      {materialMode === 'diagnostic' && (
        <mesh geometry={geometry} frustumCulled={false} renderOrder={1}>
          <meshBasicMaterial
            color="#2e2c38"
            wireframe
            transparent
            opacity={0.28}
            depthWrite={false}
            fog={false}
            onBeforeCompile={onBeforeCompile}
          />
        </mesh>
      )}
    </group>
  )
}
