import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

let studioTexture = null
let studioRenderer = null
let studioBuilt = 0

/** Bump when the panel layout changes so a hot reload rebuilds the PMREM. */
const STUDIO_REVISION = 2

const PAGE_GRAY = 0xc5c9d1

function addPanel(env, width, height, color, intensity, position, map = null) {
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(intensity),
    side: THREE.DoubleSide,
    map,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
  mesh.position.set(position[0], position[1], position[2])
  mesh.lookAt(0, 0, 0)
  env.add(mesh)
}

function cyanPinkPanel() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 16
  const context = canvas.getContext('2d')
  const gradient = context.createLinearGradient(0, 0, 256, 0)
  gradient.addColorStop(0, '#3ec8d4')
  gradient.addColorStop(0.4, '#7ad4de')
  gradient.addColorStop(0.7, '#e7a0b4')
  gradient.addColorStop(1, '#ffd0dc')
  context.fillStyle = gradient
  context.fillRect(0, 0, 256, 16)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * The crystal demo's panel studio. The rainbow panel is cyan-to-pink.
 * Assigned only while the Material tab is active.
 */
function getOrganismStudio(renderer) {
  if (studioTexture && studioRenderer === renderer && studioBuilt === STUDIO_REVISION) {
    return studioTexture
  }
  studioTexture?.dispose()
  studioTexture = null
  const env = new THREE.Scene()
  env.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(40, 32, 16),
      new THREE.MeshBasicMaterial({ color: 0x030304, side: THREE.BackSide }),
    ),
  )
  addPanel(env, 14, 6, 0xffffff, 7, [2, 14, 6])
  addPanel(env, 2, 18, 0xf2f6ff, 5, [14, 2, 4])
  addPanel(env, 16, 5, 0xffffff, 3.2, [-12, -6, 6], cyanPinkPanel())
  addPanel(env, 6, 10, 0x6a4cff, 1.6, [-10, 6, -8])
  addPanel(env, 8, 3, 0xd8ffc8, 1.4, [6, -10, -6])
  addPanel(env, 1.2, 12, 0xffffff, 6, [-4, 0, 14])

  const pmrem = new THREE.PMREMGenerator(renderer)
  studioTexture = pmrem.fromScene(env, 0.015).texture
  pmrem.dispose()
  env.traverse((object) => {
    object.geometry?.dispose()
    object.material?.dispose()
    if (object.material?.map) object.material.map.dispose()
  })
  studioRenderer = renderer
  studioBuilt = STUDIO_REVISION
  return studioTexture
}

function transmissionTargetTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')
  const cells = 12
  const cell = canvas.width / cells
  const colors = ['#111111', '#f4f4f4', '#ff2a6a', '#14d4e0', '#ffe14a', '#6a4cff']
  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      context.fillStyle = colors[(x + y) % colors.length]
      context.fillRect(x * cell, y * cell, cell, cell)
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function TransmissionTarget() {
  const map = useMemo(() => transmissionTargetTexture(), [])
  const group = useRef(null)
  const camera = useThree((state) => state.camera)
  const lookTarget = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const object = group.current
    if (!object) return
    const distance = camera.position.length()
    if (distance < 1e-4) return
    object.position.copy(camera.position).multiplyScalar(-8 / distance)
    lookTarget.copy(camera.position)
    object.lookAt(lookTarget)
  })
  return (
    <group ref={group}>
      <mesh frustumCulled={false}>
        <planeGeometry args={[4.6, 4.6]} />
        <meshBasicMaterial map={map} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

export default function OrganismStudio({ active = false, showTransmissionTarget = false }) {
  const scene = useThree((state) => state.scene)
  const gl = useThree((state) => state.gl)

  useLayoutEffect(() => {
    const toneMapping = gl.toneMapping
    const exposure = gl.toneMappingExposure
    const previousBackground = scene.background
    if (!active) {
      if (scene.environment === studioTexture) scene.environment = null
      return undefined
    }
    scene.environment = getOrganismStudio(gl)
    scene.environmentIntensity = 1.1
    scene.background = new THREE.Color(PAGE_GRAY)
    gl.toneMapping = THREE.AgXToneMapping
    gl.toneMappingExposure = 1.15
    return () => {
      if (scene.environment === studioTexture) scene.environment = null
      scene.background = previousBackground
      gl.toneMapping = toneMapping
      gl.toneMappingExposure = exposure
    }
  }, [active, gl, scene])

  if (!active) return null
  return (
    <>
      <directionalLight position={[3, 5, 4]} intensity={2.2} color="#fff1d0" />
      {showTransmissionTarget ? <TransmissionTarget /> : null}
    </>
  )
}
