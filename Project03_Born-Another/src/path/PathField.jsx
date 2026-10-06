import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  buildSurfaceSpline,
  consolidateRestStroke,
  createStrokeId,
} from './pathSpline.js'
import { raycastUnitSphere } from './surfaceDisplace.js'

/**
 * Path drawing + rendering on the deforming BORN ANOTHER surface.
 *
 * Drawing only runs while `drawing` is true (Draw button). Otherwise orbit /
 * zoom stay free. Strokes are rest-space samples so later stages can reuse them.
 */
export default function PathField({
  strokes = [],
  drawing = false,
  onStrokesChange,
  surfaceOffset = 0.045,
  lineRadius = 0.016,
  sampleSpacing = 0.045,
  surfaceSeed = 884731,
  noiseScale = 2.8,
  age = 0.5,
  speed = 0.32,
  pulseSpeed = 1.1,
  displacement = 0.22,
  noiseAmount = 1.55,
  controlsRef = null,
}) {
  const { camera, gl } = useThree()
  const drawingStrokeRef = useRef(false)
  const draftRestRef = useRef([])
  const lastRestRef = useRef(null)
  const pointerIdRef = useRef(null)
  const draftMeshRef = useRef(null)
  const strokesRef = useRef(strokes)
  const onChangeRef = useRef(onStrokesChange)
  const drawingEnabledRef = useRef(drawing)
  strokesRef.current = strokes
  onChangeRef.current = onStrokesChange
  drawingEnabledRef.current = drawing

  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const ndc = useMemo(() => new THREE.Vector2(), [])

  const uniforms = useMemo(
    () => ({
      time: 0,
      age,
      seed: surfaceSeed,
      noiseScale,
      speed,
      pulseSpeed,
      displacement,
      noiseAmount,
    }),
    [],
  )

  useFrame(({ clock }) => {
    uniforms.time = clock.getElapsedTime()
    uniforms.age = age
    uniforms.seed = surfaceSeed
    uniforms.noiseScale = noiseScale
    uniforms.speed = speed
    uniforms.pulseSpeed = pulseSpeed
    uniforms.displacement = displacement
    uniforms.noiseAmount = noiseAmount

    updateRibbonMesh(
      draftMeshRef.current,
      draftRestRef.current,
      uniforms,
      surfaceOffset,
      lineRadius * 0.92,
      4,
    )
  })

  function setOrbitEnabled(enabled) {
    const controls = controlsRef?.current
    if (!controls) return
    controls.enabled = enabled
  }

  // Draw mode owns the pointer: disable orbit while Draw is on.
  useEffect(() => {
    setOrbitEnabled(!drawing)
    gl.domElement.style.cursor = drawing ? 'crosshair' : ''
    if (!drawing) {
      drawingStrokeRef.current = false
      pointerIdRef.current = null
      draftRestRef.current = []
      lastRestRef.current = null
      if (draftMeshRef.current) draftMeshRef.current.visible = false
    }
    return () => {
      setOrbitEnabled(true)
      gl.domElement.style.cursor = ''
    }
  }, [drawing, gl, controlsRef])

  function sampleFromEvent(event) {
    const rect = gl.domElement.getBoundingClientRect()
    ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(ndc, camera)
    return raycastUnitSphere(raycaster.ray.origin, raycaster.ray.direction)
  }

  function appendRest(rest) {
    const last = lastRestRef.current
    if (last) {
      const d = Math.hypot(
        rest[0] - last[0],
        rest[1] - last[1],
        rest[2] - last[2],
      )
      if (d < sampleSpacing) return
    }
    lastRestRef.current = rest
    draftRestRef.current.push(rest)
  }

  function finishStroke() {
    if (!drawingStrokeRef.current) return
    drawingStrokeRef.current = false
    pointerIdRef.current = null

    const consolidated = consolidateRestStroke(
      draftRestRef.current,
      sampleSpacing * 0.85,
    )
    draftRestRef.current = []
    lastRestRef.current = null
    if (draftMeshRef.current) draftMeshRef.current.visible = false

    if (consolidated.length < 2) return
    onChangeRef.current?.([
      ...strokesRef.current,
      { id: createStrokeId(), restPoints: consolidated },
    ])
  }

  useEffect(() => {
    const el = gl.domElement

    function onPointerDown(event) {
      if (!drawingEnabledRef.current) return
      if (event.button !== 0) return
      const rest = sampleFromEvent(event)
      if (!rest) return
      event.preventDefault()
      event.stopImmediatePropagation()
      drawingStrokeRef.current = true
      pointerIdRef.current = event.pointerId
      try {
        el.setPointerCapture(event.pointerId)
      } catch {
        // ignore
      }
      draftRestRef.current = []
      lastRestRef.current = null
      appendRest(rest)
    }

    function onPointerMove(event) {
      if (!drawingStrokeRef.current) return
      if (
        pointerIdRef.current != null &&
        event.pointerId !== pointerIdRef.current
      ) {
        return
      }
      const rest = sampleFromEvent(event)
      if (!rest) return
      event.preventDefault()
      appendRest(rest)
    }

    function onPointerUp(event) {
      if (!drawingStrokeRef.current) return
      if (
        pointerIdRef.current != null &&
        event.pointerId !== pointerIdRef.current
      ) {
        return
      }
      finishStroke()
    }

    // Capture phase so Draw wins over OrbitControls while active.
    el.addEventListener('pointerdown', onPointerDown, true)
    el.addEventListener('pointermove', onPointerMove, true)
    el.addEventListener('pointerup', onPointerUp, true)
    el.addEventListener('pointercancel', onPointerUp, true)
    return () => {
      el.removeEventListener('pointerdown', onPointerDown, true)
      el.removeEventListener('pointermove', onPointerMove, true)
      el.removeEventListener('pointerup', onPointerUp, true)
      el.removeEventListener('pointercancel', onPointerUp, true)
    }
  }, [gl, camera, sampleSpacing, surfaceOffset, lineRadius])

  const draftGeometry = useMemo(() => new THREE.BufferGeometry(), [])

  return (
    <group>
      {strokes.map((stroke) => (
        <PathStrokeRibbon
          key={stroke.id}
          restPoints={stroke.restPoints}
          uniforms={uniforms}
          surfaceOffset={surfaceOffset}
          lineRadius={lineRadius}
        />
      ))}
      <mesh ref={draftMeshRef} visible={false} renderOrder={4}>
        <primitive object={draftGeometry} attach="geometry" />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.9}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

function PathStrokeRibbon({ restPoints, uniforms, surfaceOffset, lineRadius }) {
  const meshRef = useRef(null)
  const geometry = useMemo(() => new THREE.BufferGeometry(), [])

  useFrame(() => {
    updateRibbonMesh(
      meshRef.current,
      restPoints,
      uniforms,
      surfaceOffset,
      lineRadius,
      8,
    )
  })

  useEffect(
    () => () => {
      const mesh = meshRef.current
      if (mesh?.geometry) mesh.geometry.dispose()
    },
    [],
  )

  return (
    <mesh ref={meshRef} renderOrder={4}>
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={0.96}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

function updateRibbonMesh(
  mesh,
  restPoints,
  uniforms,
  surfaceOffset,
  radius,
  divisionsPerSegment,
) {
  if (!mesh) return
  if (!restPoints || restPoints.length < 2) {
    mesh.visible = false
    return
  }

  let pts
  try {
    pts = buildSurfaceSpline(
      restPoints,
      uniforms,
      surfaceOffset,
      divisionsPerSegment,
    )
  } catch {
    mesh.visible = false
    return
  }

  if (!pts || pts.length < 2) {
    mesh.visible = false
    return
  }

  // TubeGeometry needs distinct points.
  const cleaned = [pts[0]]
  for (let i = 1; i < pts.length; i += 1) {
    if (pts[i].distanceToSquared(cleaned[cleaned.length - 1]) > 1e-8) {
      cleaned.push(pts[i])
    }
  }
  if (cleaned.length < 2) {
    mesh.visible = false
    return
  }

  try {
    const curve = new THREE.CatmullRomCurve3(cleaned, false, 'catmullrom', 0.35)
    const tubularSegments = Math.max(12, cleaned.length * 2)
    const next = new THREE.TubeGeometry(
      curve,
      tubularSegments,
      Math.max(0.006, radius),
      8,
      false,
    )
    const prev = mesh.geometry
    mesh.geometry = next
    mesh.visible = true
    if (prev && prev !== next) prev.dispose()
  } catch {
    mesh.visible = false
  }
}
