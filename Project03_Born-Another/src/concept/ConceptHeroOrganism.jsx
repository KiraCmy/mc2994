import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  createWorldGeometry,
  disposeWorldGeometry,
  WORLD_V2_SEED,
} from '../worldv2/worldGeometry.js'
import {
  applyLifeToWorld,
  captureWorldRestState,
} from '../worldv2/life/worldLifeAdapter.js'
import {
  LIFE_TOTAL_STEPS,
  replayLife,
} from '../worldv2/life/lifeEngine.js'

/** Fixed mature presentation state — deterministic, no live Life Engine ticking. */
const CONCEPT_SEED = WORLD_V2_SEED
const CONCEPT_AGE = 0.56
const CONCEPT_STEP = Math.round(CONCEPT_AGE * LIFE_TOTAL_STEPS)

/** Macro crop: ~2.1× closer than the previous full-body framing (z≈11.8). */
const HERO_CAMERA_POSITION = [1.15, 0.42, 5.55]
const HERO_CAMERA_TARGET = [0.55, 0.08, 0.15]
const HERO_FOV = 30
/** Organism shifted so the silhouette bleeds off the right / bottom edge. */
const HERO_ORGANISM_OFFSET = [-0.85, -0.55, 0.1]
const HERO_TILT = [0.18, -0.32, 0.06]
const HERO_SPIN = 0.012
const HERO_DRIFT = 0.018

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false,
  )
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!query) return undefined
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/**
 * Soft editorial environment: cool cyan / violet / pink panels plus a warm
 * amber accent so crystal facets pick up varied reflections without neon.
 */
function createConceptEnvironment(renderer) {
  const scene = new THREE.Scene()
  scene.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(30, 24, 12),
      new THREE.MeshBasicMaterial({ color: 0xf4f3ef, side: THREE.BackSide }),
    ),
  )

  function panel(width, height, color, intensity, position) {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity),
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
    mesh.position.fromArray(position)
    mesh.lookAt(0, 0, 0)
    scene.add(mesh)
  }

  panel(16, 10, 0xffffff, 2.4, [0, 13, 2])
  panel(9, 5, 0xd8fbff, 2.8, [4, 7, 9])
  panel(3, 11, 0x9ae8ef, 2.1, [12, 1, 2])
  panel(7, 4, 0xffc0d4, 1.7, [-9, -3, 7])
  panel(5, 8, 0xc8b4ff, 1.5, [-8, 5, -5])
  panel(4, 3, 0xffd7a8, 1.4, [6, -6, 5])
  panel(2, 9, 0xffffff, 2.2, [-2, 0, 11])

  const pmrem = new THREE.PMREMGenerator(renderer)
  const texture = pmrem.fromScene(scene, 0.055).texture
  pmrem.dispose()
  scene.traverse((object) => {
    object.geometry?.dispose()
    object.material?.dispose()
  })
  return texture
}

function ConceptCamera() {
  const camera = useThree((state) => state.camera)

  useLayoutEffect(() => {
    camera.position.fromArray(HERO_CAMERA_POSITION)
    camera.fov = HERO_FOV
    camera.near = 0.08
    camera.far = 60
    camera.lookAt(...HERO_CAMERA_TARGET)
    camera.updateProjectionMatrix()
  }, [camera])

  return null
}

function ConceptLights() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)

  useLayoutEffect(() => {
    const environment = createConceptEnvironment(gl)
    scene.environment = environment
    scene.environmentIntensity = 0.82
    scene.background = null
    return () => {
      if (scene.environment === environment) scene.environment = null
      environment.dispose()
    }
  }, [gl, scene])

  return (
    <>
      <hemisphereLight color="#f8fbff" groundColor="#ebe7df" intensity={0.85} />
      <ambientLight color="#f5f4f0" intensity={0.55} />
      {/* Soft key — keep speculars gentle on light paper */}
      <directionalLight color="#fff8f2" intensity={0.85} position={[4, 6, 5]} />
      {/* Icy cyan rim */}
      <directionalLight color="#9fe8ef" intensity={0.38} position={[-4, 3, -3]} />
      {/* Lavender / pink fill for iridescent facets */}
      <directionalLight color="#e2c8ff" intensity={0.28} position={[-5, -2, 4]} />
      <directionalLight color="#ffb7c9" intensity={0.22} position={[3, -3, 4]} />
      {/* Occasional warm amber kiss */}
      <directionalLight color="#ffd09a" intensity={0.18} position={[2, -5, 2]} />
    </>
  )
}

function WorldV2ConceptOrganism({ reducedMotion }) {
  const group = useRef(null)
  const drift = useRef(0)
  const bundle = useMemo(() => {
    const world = createWorldGeometry(CONCEPT_SEED)
    const rest = captureWorldRestState(world)
    const life = replayLife({
      seed: CONCEPT_SEED,
      history: [],
      step: CONCEPT_STEP,
    })
    applyLifeToWorld(world, rest, life)
    return { world, life }
  }, [])

  useEffect(
    () => () => {
      disposeWorldGeometry(bundle.world)
    },
    [bundle],
  )

  useFrame((_, delta) => {
    if (!group.current || reducedMotion) return
    const dt = Math.min(delta, 0.1)
    group.current.rotation.y += dt * HERO_SPIN
    drift.current += dt
    group.current.rotation.x =
      HERO_TILT[0] + Math.sin(drift.current * 0.11) * HERO_DRIFT
    group.current.rotation.z =
      HERO_TILT[2] + Math.cos(drift.current * 0.09) * HERO_DRIFT * 0.6
  })

  const { world, life } = bundle
  const scale = life.outputs.form.scale

  return (
    <group position={HERO_ORGANISM_OFFSET} rotation={HERO_TILT}>
      <group ref={group} scale={scale}>
        {/* Soft membrane — lighter, more translucent, less heavy specular */}
        <mesh geometry={world.surface} renderOrder={0}>
          <meshPhysicalMaterial
            color="#f7fbfc"
            vertexColors
            roughness={0.52}
            metalness={0.02}
            clearcoat={0.35}
            clearcoatRoughness={0.28}
            iridescence={0.38}
            iridescenceIOR={1.26}
            iridescenceThicknessRange={[120, 420]}
            envMapIntensity={0.55}
            transparent
            opacity={0.78}
            depthWrite={false}
            side={THREE.FrontSide}
          />
        </mesh>

        <mesh geometry={world.surface} scale={1.016} renderOrder={2}>
          <meshPhysicalMaterial
            color="#c9f4f5"
            roughness={0.22}
            metalness={0}
            transmission={0.42}
            thickness={0.14}
            ior={1.34}
            attenuationColor="#9fd4d8"
            attenuationDistance={3.2}
            iridescence={0.48}
            iridescenceIOR={1.3}
            iridescenceThicknessRange={[140, 560]}
            clearcoat={0.55}
            clearcoatRoughness={0.18}
            envMapIntensity={0.7}
            transparent
            opacity={0.16}
            depthWrite={false}
            side={THREE.FrontSide}
          />
        </mesh>

        <mesh geometry={world.surface} scale={0.995} renderOrder={0}>
          <meshPhysicalMaterial
            color="#eef6f7"
            vertexColors
            emissive="#3d6a72"
            emissiveIntensity={0.035}
            roughness={0.78}
            metalness={0.01}
            clearcoat={0.2}
            clearcoatRoughness={0.4}
            iridescence={0.22}
            envMapIntensity={0.35}
            transparent
            opacity={0.55}
            depthWrite={false}
            side={THREE.BackSide}
          />
        </mesh>

        {/* Crystals — cool glass with prismatic response to tinted lights */}
        <mesh geometry={world.outside} renderOrder={3}>
          <meshPhysicalMaterial
            color="#f3f8ff"
            transmission={0.58}
            thickness={1.35}
            ior={1.6}
            dispersion={5.4}
            roughness={0.1}
            metalness={0}
            iridescence={1}
            iridescenceIOR={1.33}
            iridescenceThicknessRange={[160, 920]}
            attenuationColor={0xd9ebe8}
            attenuationDistance={2.4}
            clearcoat={0.85}
            clearcoatRoughness={0.08}
            specularIntensity={0.75}
            envMapIntensity={1.05}
            flatShading
            side={THREE.FrontSide}
          />
        </mesh>

        <mesh geometry={world.inside} renderOrder={3}>
          <meshPhysicalMaterial
            color="#f6fffc"
            transmission={0.5}
            thickness={1.05}
            ior={1.58}
            dispersion={4.6}
            roughness={0.12}
            metalness={0}
            iridescence={0.95}
            iridescenceIOR={1.33}
            iridescenceThicknessRange={[160, 880]}
            attenuationColor={0xc5f0e4}
            attenuationDistance={2.1}
            clearcoat={0.8}
            clearcoatRoughness={0.1}
            envMapIntensity={0.95}
            emissive="#7ad8c8"
            emissiveIntensity={0.025}
            flatShading
            side={THREE.FrontSide}
          />
        </mesh>

        <mesh geometry={world.minerals} renderOrder={1}>
          <meshStandardMaterial
            color="#c4a46a"
            metalness={0.86}
            roughness={0.36}
            flatShading
            envMapIntensity={1.05}
          />
        </mesh>
      </group>
    </group>
  )
}

/**
 * Section 01 hero: atmospheric macro glimpse of the World V2 organism.
 * Presentation-only camera / materials — World page unchanged.
 */
export default function ConceptHeroOrganism({ className = '' }) {
  const wrapRef = useRef(null)
  const [visible, setVisible] = useState(true)
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    )
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={wrapRef}
      className={className}
      role="img"
      aria-label="Close glimpse of Born Another organism — translucent membrane and crystal facets"
    >
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        camera={{
          position: HERO_CAMERA_POSITION,
          fov: HERO_FOV,
          near: 0.08,
          far: 60,
        }}
        dpr={[1, 1.6]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor(0x000000, 0)
          gl.toneMapping = THREE.AgXToneMapping
          gl.toneMappingExposure = 0.98
          camera.lookAt(...HERO_CAMERA_TARGET)
        }}
        style={{ pointerEvents: 'none', touchAction: 'pan-y' }}
      >
        <ConceptCamera />
        <ConceptLights />
        <WorldV2ConceptOrganism reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  )
}
