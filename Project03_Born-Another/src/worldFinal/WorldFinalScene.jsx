/**
 * World Final — seabed + camera controller in one transparent Canvas.
 *
 * Background integration mirrors Playground Experiment 04: the canvas is
 * created with alpha and cleared to transparent black, scene.background is
 * null, and the page's .playground-page--exp05 CSS gradient (behind header
 * and canvas alike) is the visible atmosphere. Terrain hazes toward that
 * gradient's horizon color, then fades to alpha (seabedMaterial.js).
 */
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import WebGLCanvas from '../WebGLCanvas.jsx'
import { resolveRenderDpr, STUDIES_MAX_PIXELS } from '../renderBudget.js'
import { normalizeWorldFinalConfig, WORLD_FINAL_CAMERA_FOV } from './config.js'
import DebugHelpers from './DebugHelpers.jsx'
import DriftCamera from './DriftCamera.jsx'
import SeabedTerrain from './SeabedTerrain.jsx'
import { poseForMode } from './cameraPoses.js'

function useWorldFinalDpr(maxPixels = STUDIES_MAX_PIXELS) {
  const [dpr, setDpr] = useState(() => {
    if (typeof window === 'undefined') return 1
    return resolveRenderDpr(
      window.innerWidth,
      window.innerHeight,
      window.devicePixelRatio,
      maxPixels,
    )
  })

  useEffect(() => {
    const update = () => {
      setDpr(
        resolveRenderDpr(
          window.innerWidth,
          window.innerHeight,
          window.devicePixelRatio,
          maxPixels,
        ),
      )
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [maxPixels])

  return dpr
}

/**
 * FogExp2 supplies only density + view depth to the patched terrain shader;
 * its color is never used.
 */
function SceneHaze({ fogDensity, fogEnabled }) {
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    scene.background = null
    scene.fog = fogEnabled ? new THREE.FogExp2(0x000000, fogDensity) : null
    return () => {
      scene.fog = null
    }
  }, [fogDensity, fogEnabled, scene])

  return null
}

export default function WorldFinalScene({
  config,
  className = 'exp05-viewport',
  resetEpoch = 0,
  cameraMode = 'explore',
  showHelpers = false,
  fogEnabled = true,
  materialMode = 'shaded',
  onDebugSample = null,
  onRequestDrift = null,
}) {
  const dpr = useWorldFinalDpr()
  /* Slider drags rebuild the mesh at low priority; terrain and camera share
     the same deferred config so ground clearance never disagrees with it. */
  const deferredConfig = useDeferredValue(config)
  const cfg = useMemo(() => normalizeWorldFinalConfig(deferredConfig), [deferredConfig])
  /* Initial position only — DriftCamera owns the camera after mount. */
  const [initialPosition] = useState(() =>
    poseForMode(cameraMode, cfg).position.toArray(),
  )
  /* Diagnostic material only: Overview sits several hundred units out and
     plain FogExp2 would erase the basin. The shaded seabed offsets its haze
     by camera altitude instead (seabedMaterial.js). */
  const effectiveFog = fogEnabled && cameraMode !== 'overview'

  return (
    <WebGLCanvas
      className={className}
      camera={{
        position: initialPosition,
        fov: WORLD_FINAL_CAMERA_FOV,
        near: 0.35,
        far: cfg.basinRadius * 8,
        up: [0, 1, 0],
      }}
      dpr={dpr}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor(0x000000, 0)
        gl.toneMapping = THREE.NoToneMapping
        scene.background = null
      }}
    >
      <SceneHaze fogDensity={cfg.fogDensity} fogEnabled={effectiveFog} />

      {/* Neutral lights for the diagnostic material only; the shaded seabed
          lights itself from atmosphere.js. */}
      <hemisphereLight args={['#f2eef6', '#a8a0b8', 0.5]} />
      <directionalLight position={[160, 70, 40]} intensity={1.0} color="#fff8fb" />
      <directionalLight position={[-70, 50, -60]} intensity={0.3} color="#d4e0f0" />
      <ambientLight intensity={0.26} color="#e8e2ec" />

      <SeabedTerrain config={cfg} materialMode={materialMode} hazeEnabled={fogEnabled} />
      <DebugHelpers config={cfg} visible={showHelpers} />
      <DriftCamera
        config={cfg}
        resetEpoch={resetEpoch}
        cameraMode={cameraMode}
        onDebugSample={onDebugSample}
        onRequestDrift={onRequestDrift}
      />
    </WebGLCanvas>
  )
}
