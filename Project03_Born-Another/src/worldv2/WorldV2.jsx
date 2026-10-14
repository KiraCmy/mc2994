import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import SiteHeader from '../SiteHeader.jsx'
import SiteHud from '../SiteHud.jsx'
import {
  createWorldGeometry,
  disposeWorldGeometry,
  WORLD_V2_SEED,
} from './worldGeometry.js'
import {
  applyLifeToWorld,
  branchAttachAlong,
  captureWorldRestState,
  deformRadialPoint,
  formMorphAmount,
  morphRestPoint,
  morphRestRadius,
  primaryCrystalAnchor,
  secondaryCrystalAttachPoint,
} from './life/worldLifeAdapter.js'
import {
  createPrimaryCrystalGeometrySet,
  crystalProfileForSite,
  primaryCrystalRenderMetrics,
} from './primaryCrystalGeometry.js'
import {
  crystalRootAndLength,
  secondaryFacingDirection,
  surfaceGrowthAxes,
} from './crystalOrientation.js'
import {
  bakedCrystalId,
  buildDissolveParticles,
  crystalDissolveOpacity,
  crystalDissolveProgress,
  crystalDissolveScale,
} from './crystalDissolution.js'
import {
  findLifeFieldRegion,
  replayLife,
} from './life/lifeEngine.js'
import { useLifeEngine } from './life/useLifeEngine.js'
import './worldV2.css'

const CRYSTAL_DEBUG =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('crystalDebug')

/**
 * Visual-only death / late-life appearance from existing Life Engine outputs.
 * Does not alter simulation state — Restart + replay restore living look
 * because these factors are derived each frame from life.
 */
function lifeVisualState(life) {
  const vitality = life.outputs.form.vitality
  const integrity = life.outputs.form.integrity
  const decay = life.variables.decay
  const mineral = life.variables.mineral
  // Decay window + vitality fade already begin before AGE=1; dead settles the floor.
  const membrane = THREE.MathUtils.clamp(
    integrity * (0.18 + vitality * 0.82) * (1 - decay * 0.62),
    life.dead ? 0.05 : 0.1,
    1,
  )
  const motion = life.dead ? 0 : vitality
  return {
    membrane,
    motion,
    vitality,
    integrity,
    decay,
    mineral,
    dead: life.dead,
  }
}

// Opposite side of the sphere so the key lights sit behind the body and read
// as a bright top-right rim at the default exterior start.
const EXTERIOR_POSITION = new THREE.Vector3(-0.24, 0.12, -13.2)
const INTERIOR_POSITION = new THREE.Vector3(0, 0.02, 0.04)
const TRANSITION_DURATION = 2.25
const CAMERA_NEAR = 0.025
const CAMERA_FAR = 240
const CAMERA_WALK_SPEED = 5.4
const CAMERA_SPRINT_SPEED = 14
const CAMERA_LOOK_SENSITIVITY = 0.0042
const CAMERA_PITCH_LIMIT = Math.PI * 0.46
const CAMERA_MOVE_DAMPING = 9
const CAMERA_LOOK_DAMPING = 16
const CAMERA_WHEEL_DAMPING = 11
const CAMERA_DRAG_THRESHOLD = 4
const WORLD_UP = new THREE.Vector3(0, 1, 0)
const ZERO = new THREE.Vector3()

const FINISH_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uInterior: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uInterior;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 center = vUv - 0.5;
      float distanceFromCenter = dot(center, center);
      vec2 offset = center * distanceFromCenter * mix(0.006, 0.012, uInterior);
      vec3 color = vec3(
        texture2D(tDiffuse, vUv + offset).r,
        texture2D(tDiffuse, vUv).g,
        texture2D(tDiffuse, vUv - offset).b
      );
      color *= 1.0 - distanceFromCenter * mix(0.42, 0.62, uInterior);
      color += (hash(vUv * 1000.0 + uTime) - 0.5) * 0.018;
      gl_FragColor = vec4(color, 1.0);
    }
  `,
}

function easeInOutCubic(value) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2
}

function lookQuaternion(position, target) {
  const camera = new THREE.PerspectiveCamera()
  camera.position.copy(position)
  camera.lookAt(target)
  return camera.quaternion.clone()
}

function createEnvironment(renderer) {
  const scene = new THREE.Scene()
  scene.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(30, 24, 12),
      new THREE.MeshBasicMaterial({ color: 0x020506, side: THREE.BackSide }),
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

  panel(11, 5, 0xe8ffff, 6.5, [2, 10, 7])
  panel(2, 13, 0x63dce4, 4.2, [10, 1, 2])
  panel(8, 3, 0xff729b, 3.8, [-8, -5, 6])
  panel(4, 8, 0x6b4cff, 2.2, [-8, 5, -5])
  panel(1, 9, 0xffffff, 5.5, [-3, 0, 10])

  const pmrem = new THREE.PMREMGenerator(renderer)
  const texture = pmrem.fromScene(scene, 0.02).texture
  pmrem.dispose()
  scene.traverse((object) => {
    object.geometry?.dispose()
    object.material?.dispose()
  })
  return texture
}

function createWorldBackground(study) {
  if (study === 'light') return new THREE.Color('#d9dee2')
  if (study === 'dark') return new THREE.Color('#000000')
  if (study === 'shader') return new THREE.Color('#c5c9d1')

  const canvas = document.createElement('canvas')
  canvas.width = 2
  canvas.height = 256
  const context = canvas.getContext('2d')
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height)
  gradient.addColorStop(0, '#566775')
  gradient.addColorStop(1, '#171e2a')
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

function WorldEnvironment({ view, backgroundStudy }) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const interior = view !== 'exterior'
  const background = useMemo(
    () => createWorldBackground(backgroundStudy),
    [backgroundStudy],
  )

  useLayoutEffect(() => {
    const environment = createEnvironment(gl)
    // R3F owns the Scene object; this component owns and restores its world-only setup.
    // oxlint-disable-next-line react(immutability)
    scene.environment = environment
    scene.environmentIntensity = 1.15
    scene.fog = new THREE.FogExp2(0x010405, 0.028)
    return () => {
      if (scene.environment === environment) scene.environment = null
      scene.fog = null
      environment.dispose()
    }
  }, [gl, scene])

  useLayoutEffect(() => {
    // Background studies are isolated from the PMREM environment and lighting.
    // oxlint-disable-next-line react(immutability)
    scene.background = background
    return () => {
      if (scene.background === background) scene.background = null
      if (background.isTexture) background.dispose()
    }
  }, [background, scene])

  return (
    <>
      <directionalLight
        color="#e8ffff"
        intensity={interior ? 0.45 : 2.4}
        position={[4, 6, 5]}
      />
      <directionalLight
        color="#ff7096"
        intensity={interior ? 0.25 : 1.1}
        position={[-5, -2, 4]}
      />
      <pointLight
        color="#4de5ed"
        intensity={interior ? 3.5 : 0.08}
        distance={6}
        position={[0.8, 0.5, 0.2]}
      />
      <pointLight
        color="#ff658f"
        intensity={interior ? 2.8 : 0.06}
        distance={5}
        position={[-1.1, -0.6, -0.5]}
      />
    </>
  )
}

function CrystalHierarchyLink({ attachPoint, childRoot }) {
  const lineRef = useRef(null)

  useLayoutEffect(() => {
    const line = lineRef.current
    if (!line) return
    line.geometry.setFromPoints([attachPoint, childRoot])
  }, [attachPoint, childRoot])

  return (
    <group>
      <line ref={lineRef} renderOrder={5}>
        <bufferGeometry />
        <lineBasicMaterial color="#fbbf24" />
      </line>
      <mesh position={attachPoint} renderOrder={5}>
        <sphereGeometry args={[0.018, 10, 10]} />
        <meshBasicMaterial color="#5eead4" />
      </mesh>
      <mesh position={childRoot} renderOrder={5}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshBasicMaterial color="#fbbf24" />
      </mesh>
    </group>
  )
}

function DebugArrow({ origin, direction, color, length = 0.28 }) {
  const axis = useMemo(() => {
    const vector = direction.clone().normalize()
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      vector,
    )
    return { quaternion, tip: origin.clone().addScaledVector(vector, length) }
  }, [origin, direction, length])

  return (
    <group>
      <mesh position={origin.clone().lerp(axis.tip, 0.5)} quaternion={axis.quaternion} renderOrder={6}>
        <cylinderGeometry args={[0.006, 0.006, length, 6]} />
        <meshBasicMaterial color={color} depthTest={false} />
      </mesh>
      <mesh
        position={axis.tip}
        quaternion={axis.quaternion}
        renderOrder={6}
      >
        <coneGeometry args={[0.018, 0.05, 8]} />
        <meshBasicMaterial color={color} depthTest={false} />
      </mesh>
    </group>
  )
}

function collectBakedDissolveEmitters(
  restOutside,
  seed,
  age,
  decay,
  growth,
  deformations,
) {
  if (!restOutside?.origins || !restOutside?.directions) return []
  const morph = formMorphAmount(growth)
  const { origins, directions, positions } = restOutside
  const clusters = new Map()

  for (let offset = 0; offset < origins.length; offset += 3) {
    const ox = origins[offset]
    const oy = origins[offset + 1]
    const oz = origins[offset + 2]
    const id = bakedCrystalId(ox, oy, oz)
    let cluster = clusters.get(id)
    if (!cluster) {
      let ax = directions[offset]
      let ay = directions[offset + 1]
      let az = directions[offset + 2]
      const axisLen = Math.hypot(ax, ay, az) || 1
      cluster = {
        id,
        ox,
        oy,
        oz,
        ax: ax / axisLen,
        ay: ay / axisLen,
        az: az / axisLen,
        tipAlong: 0.22,
      }
      clusters.set(id, cluster)
    }
    const dx = positions[offset] - cluster.ox
    const dy = positions[offset + 1] - cluster.oy
    const dz = positions[offset + 2] - cluster.oz
    cluster.tipAlong = Math.max(
      cluster.tipAlong,
      dx * cluster.ax + dy * cluster.ay + dz * cluster.az,
    )
  }

  const emitters = []
  for (const cluster of clusters.values()) {
    const progress = crystalDissolveProgress(seed, cluster.id, age, decay)
    if (progress <= 0.001) continue
    const shaped = morphRestPoint(cluster.ox, cluster.oy, cluster.oz, morph)
    const root = deformRadialPoint(
      shaped[0],
      shaped[1],
      shaped[2],
      deformations,
    )
    emitters.push({
      id: cluster.id,
      root,
      axis: [cluster.ax, cluster.ay, cluster.az],
      length: cluster.tipAlong * (0.55 + morph * 0.45),
      width: cluster.tipAlong * 0.3,
      progress,
    })
  }
  return emitters
}

function CrystalDissolveDust({ seed, age, decay, emitters }) {
  const dust = useMemo(
    () => buildDissolveParticles(seed, age, decay, emitters),
    [seed, age, decay, emitters],
  )
  const geometry = useMemo(() => {
    const next = new THREE.BufferGeometry()
    next.setAttribute(
      'position',
      new THREE.BufferAttribute(
        dust.count ? dust.positions : new Float32Array([0, 0, 0]),
        3,
      ),
    )
    next.setAttribute(
      'color',
      new THREE.BufferAttribute(
        dust.count ? dust.colors : new Float32Array([0, 0, 0]),
        3,
      ),
    )
    next.setDrawRange(0, dust.count)
    return next
  }, [dust])

  useEffect(
    () => () => {
      geometry.dispose()
    },
    [geometry],
  )

  if (dust.count === 0) return null

  return (
    <points geometry={geometry} frustumCulled={false} renderOrder={5}>
      <pointsMaterial
        size={0.07}
        sizeAttenuation
        vertexColors
        transparent
        opacity={1}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

function SpatialGrowthSites({ world, sites, deformations, life, restOutside }) {
  const geometries = useMemo(() => createPrimaryCrystalGeometrySet(), [])
  const livingGlow = life ? lifeVisualState(life).vitality : 1
  const seed = life?.seed ?? 0
  const age = life?.age ?? 0
  const decay = life?.variables?.decay ?? 0
  const growth = life?.variables?.growth ?? 0

  useEffect(
    () => () => {
      for (const geometry of geometries) geometry.dispose()
    },
    [geometries],
  )

  const visibleSites = CRYSTAL_DEBUG ? sites.slice(0, 1) : sites

  const transforms = visibleSites.flatMap((site) => {
    const crystal = site.crystal
    if (!crystal) return []
    const metrics = primaryCrystalRenderMetrics(crystal, site)
    const outwardNormal = new THREE.Vector3().fromArray(site.direction).normalize()
    const {
      exteriorAxis,
      interiorAxis,
      outwardNormal: outward,
      inwardNormal,
    } = surfaceGrowthAxes(
      crystal.growthDirection ?? crystal.direction,
      outwardNormal.toArray(),
    )
    const exteriorGrowth = new THREE.Vector3().fromArray(exteriorAxis)
    const interiorGrowth = new THREE.Vector3().fromArray(interiorAxis)
    const faceOut = new THREE.Vector3().fromArray(outward)
    const faceIn = new THREE.Vector3().fromArray(inwardNormal)

    // Follow the deformed membrane; do not laterally shove off the nucleation site.
    const morph = formMorphAmount(life?.variables?.growth ?? 1)
    const surface = new THREE.Vector3().fromArray(
      primaryCrystalAnchor(
        site,
        world.radiusAt(outwardNormal),
        deformations,
        0,
        morph,
      ),
    )

    const exteriorPlacement = crystalRootAndLength({
      surface: surface.toArray(),
      facingNormal: outward,
      growthAxis: exteriorAxis,
      length: metrics.length,
      embed: metrics.embed * 0.55,
    })
    const interiorPlacement = crystalRootAndLength({
      surface: surface.toArray(),
      facingNormal: inwardNormal,
      growthAxis: interiorAxis,
      length: metrics.length,
      embed: metrics.innerOffset,
    })
    const outsideRoot = new THREE.Vector3().fromArray(exteriorPlacement.root)
    const insideRoot = new THREE.Vector3().fromArray(interiorPlacement.root)

    const makeTransform = (record, axis, root, length, recordMetrics, dissolve) => {
      const recordProfile = crystalProfileForSite({ id: record.id })
      const quaternion = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        axis,
      )
      quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          (record.roll ?? site.roll) + recordProfile.sides * 0.17,
        ),
      )
      const shrink = crystalDissolveScale(dissolve)
      return {
        geometry: geometries[Math.abs(record.id | 0) % geometries.length],
        position: root,
        quaternion,
        axis: axis.clone(),
        scale: new THREE.Vector3(
          recordMetrics.width * shrink,
          length * shrink,
          recordMetrics.depth * shrink,
        ),
      }
    }

    const primaryDissolve = crystalDissolveProgress(seed, crystal.id, age, decay)
    const primary = {
      id: crystal.id,
      role: 'primary',
      parentId: null,
      attachPoint: null,
      childRoot: null,
      dissolve: primaryDissolve,
      debug: {
        surface: surface.clone(),
        outward: faceOut.clone(),
        exteriorAxis: exteriorGrowth.clone(),
        interiorAxis: interiorGrowth.clone(),
      },
      outside: makeTransform(
        crystal,
        exteriorGrowth,
        outsideRoot,
        exteriorPlacement.visualLength,
        metrics,
        primaryDissolve,
      ),
      inside: makeTransform(
        crystal,
        interiorGrowth,
        insideRoot,
        interiorPlacement.visualLength,
        metrics,
        primaryDissolve,
      ),
    }

    const branches = (crystal.branches ?? []).map((branch) => {
      const branchMetrics = primaryCrystalRenderMetrics(branch, site)
      const exteriorBranchAxis = new THREE.Vector3().fromArray(
        secondaryFacingDirection(
          branch.direction ?? branch.growthDirection,
          exteriorAxis,
          outward,
        ),
      )
      const interiorBranchAxis = exteriorBranchAxis.clone().negate()
      const outsideAlong = branchAttachAlong(
        branch.attachDistance,
        crystal.length,
        exteriorPlacement.visualLength,
      )
      const insideAlong = branchAttachAlong(
        branch.attachDistance,
        crystal.length,
        interiorPlacement.visualLength,
      )
      const outsideAttach = new THREE.Vector3().fromArray(
        secondaryCrystalAttachPoint(
          outsideRoot.toArray(),
          exteriorGrowth.toArray(),
          outsideAlong,
        ),
      )
      const insideAttach = new THREE.Vector3().fromArray(
        secondaryCrystalAttachPoint(
          insideRoot.toArray(),
          interiorGrowth.toArray(),
          insideAlong,
        ),
      )
      // Seat on the parent shaft; only a tiny nest along the child axis.
      const nest = Math.min(0.012, branchMetrics.length * 0.08)
      const exteriorChildRoot = outsideAttach
        .clone()
        .addScaledVector(exteriorBranchAxis, -nest)
      const interiorChildRoot = insideAttach
        .clone()
        .addScaledVector(interiorBranchAxis, -nest)
      const branchDissolve = crystalDissolveProgress(seed, branch.id, age, decay)
      return {
        id: branch.id,
        role: 'secondary',
        parentId: branch.parentId,
        attachPoint: outsideAttach.clone(),
        childRoot: exteriorChildRoot,
        dissolve: branchDissolve,
        outside: makeTransform(
          branch,
          exteriorBranchAxis,
          exteriorChildRoot,
          branchMetrics.length + nest,
          branchMetrics,
          branchDissolve,
        ),
        inside: makeTransform(
          branch,
          interiorBranchAxis,
          interiorChildRoot,
          branchMetrics.length + nest,
          branchMetrics,
          branchDissolve,
        ),
      }
    })

    return [primary, ...branches]
  })

  const dissolveEmitters = useMemo(() => {
    const fromLife = transforms
      .filter((entry) => entry.dissolve > 0.001)
      .map((entry) => ({
        id: entry.id,
        root: entry.outside.position.toArray(),
        axis: entry.outside.axis.toArray(),
        length: entry.outside.scale.y,
        width: entry.outside.scale.x,
        progress: entry.dissolve,
      }))
    const fromBaked = collectBakedDissolveEmitters(
      restOutside,
      seed,
      age,
      decay,
      growth,
      deformations,
    )
    return [...fromLife, ...fromBaked]
  }, [transforms, restOutside, seed, age, decay, growth, deformations])

  const hierarchyLinks = CRYSTAL_DEBUG
    ? transforms.filter(
        (entry) =>
          entry.role === 'secondary' && entry.attachPoint && entry.childRoot,
      )
    : []
  const debugPrimary = CRYSTAL_DEBUG
    ? transforms.find((entry) => entry.role === 'primary')
    : null

  return (
    <>
      {transforms.map(({ id, outside, dissolve }) => {
        const opacity = crystalDissolveOpacity(dissolve)
        if (opacity < 0.02) return null
        return (
          <mesh
            key={`spatial-outside-${id}`}
            geometry={outside.geometry}
            position={outside.position}
            quaternion={outside.quaternion}
            scale={outside.scale}
            renderOrder={3}
          >
            <meshPhysicalMaterial
              color={0xffffff}
              transmission={0.92 * opacity}
              thickness={1.15}
              ior={1.62}
              dispersion={5}
              roughness={0.06}
              metalness={0}
              iridescence={0.85 * opacity}
              iridescenceIOR={1.35}
              iridescenceThicknessRange={[180, 820]}
              attenuationColor={0xe4ecd9}
              attenuationDistance={2.6}
              clearcoat={1 * opacity}
              clearcoatRoughness={0.04}
              specularIntensity={1}
              envMapIntensity={1.25 * opacity}
              transparent={opacity < 0.98}
              opacity={opacity}
              depthWrite={opacity > 0.35}
              flatShading
              side={THREE.FrontSide}
            />
          </mesh>
        )
      })}
      {CRYSTAL_DEBUG
        ? transforms.map(({ id, role, outside, dissolve }) => (
            <mesh
              key={`spatial-outside-wire-${id}`}
              geometry={outside.geometry}
              position={outside.position}
              quaternion={outside.quaternion}
              scale={outside.scale}
              renderOrder={4}
            >
              <meshBasicMaterial
                color={role === 'primary' ? '#5eead4' : '#fbbf24'}
                wireframe
                transparent
                opacity={0.55 * crystalDissolveOpacity(dissolve)}
              />
            </mesh>
          ))
        : null}
      {hierarchyLinks.map((link) => (
        <CrystalHierarchyLink
          key={`hierarchy-${link.id}`}
          attachPoint={link.attachPoint}
          childRoot={link.childRoot}
        />
      ))}
      {debugPrimary?.debug ? (
        <>
          <DebugArrow
            origin={debugPrimary.debug.surface}
            direction={debugPrimary.debug.outward}
            color="#38bdf8"
            length={0.32}
          />
          <DebugArrow
            origin={debugPrimary.outside.position}
            direction={debugPrimary.debug.exteriorAxis}
            color="#5eead4"
            length={0.38}
          />
          <DebugArrow
            origin={debugPrimary.inside.position}
            direction={debugPrimary.debug.interiorAxis}
            color="#c084fc"
            length={0.38}
          />
          <mesh position={debugPrimary.outside.position} renderOrder={5}>
            <sphereGeometry args={[0.02, 10, 10]} />
            <meshBasicMaterial color="#5eead4" />
          </mesh>
        </>
      ) : null}
      {transforms.map(({ id, inside, dissolve }) => {
        const opacity = crystalDissolveOpacity(dissolve)
        if (opacity < 0.02) return null
        return (
          <mesh
            key={`spatial-inside-${id}`}
            geometry={inside.geometry}
            position={inside.position}
            quaternion={inside.quaternion}
            scale={inside.scale}
            renderOrder={3}
          >
            <meshPhysicalMaterial
              color={0xffffff}
              transmission={0.78 * opacity}
              thickness={0.9}
              ior={1.62}
              dispersion={4.2}
              roughness={0.08}
              metalness={0}
              iridescence={0.78 * opacity}
              iridescenceIOR={1.35}
              iridescenceThicknessRange={[180, 820]}
              attenuationColor={0xbfffe8}
              attenuationDistance={2.2}
              clearcoat={1 * opacity}
              clearcoatRoughness={0.04}
              envMapIntensity={1.2 * opacity}
              emissive="#6fffea"
              emissiveIntensity={0.05 * livingGlow * opacity}
              transparent={opacity < 0.98}
              opacity={opacity}
              depthWrite={opacity > 0.35}
              flatShading
              side={THREE.FrontSide}
            />
          </mesh>
        )
      })}
      <CrystalDissolveDust
        seed={seed}
        age={age}
        decay={decay}
        emitters={dissolveEmitters}
      />
    </>
  )
}

function TouchFeedback({ world, feedback, morph = 1 }) {
  const marker = useRef(null)
  const startedAt = useRef(null)

  useEffect(() => {
    startedAt.current = null
    if (marker.current) marker.current.visible = Boolean(feedback)
  }, [feedback])

  useFrame(({ clock }) => {
    if (!marker.current || !feedback) return
    if (startedAt.current === null) startedAt.current = clock.elapsedTime
    const progress = Math.min(
      1,
      (clock.elapsedTime - startedAt.current) / 1.15,
    )
    marker.current.visible = progress < 1
    marker.current.scale.setScalar(0.72 + progress * 0.9)
    marker.current.material.opacity = (1 - progress) * 0.42
  })

  if (!feedback) return null
  const normal = new THREE.Vector3()
    .fromArray(feedback.direction)
    .normalize()
  const surfaceRadius = morphRestRadius(world.radiusAt(normal), morph)
  const position = normal
    .clone()
    .multiplyScalar(surfaceRadius * 1.025 + 0.035)
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    normal,
  )

  return (
    <mesh
      ref={marker}
      position={position}
      quaternion={quaternion}
      renderOrder={5}
    >
      <ringGeometry args={[0.065, 0.095, 32]} />
      <meshBasicMaterial
        color="#b8ffff"
        transparent
        opacity={0.42}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  )
}

function WorldOrganism({ view, life, onStimulus }) {
  const group = useRef(null)
  const skinMaterial = useRef(null)
  const shellMaterial = useRef(null)
  const liningMaterial = useRef(null)
  const feedbackId = useRef(0)
  const exteriorDrag = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    moved: false,
    direction: null,
  })
  const [bundle, setBundle] = useState(null)
  const [touchFeedback, setTouchFeedback] = useState(null)

  useEffect(() => {
    const next = createWorldGeometry(life.seed)
    const rest = captureWorldRestState(next)
    // Geometry is created after mount so StrictMode's test mount is also disposed.
    // oxlint-disable-next-line react(set-state-in-effect)
    setBundle({ world: next, rest })
    return () => disposeWorldGeometry(next)
  }, [life.seed])

  useLayoutEffect(() => {
    if (!bundle) return
    // Keep membrane + baked crystal anchors on the same life sample as LE sites.
    applyLifeToWorld(bundle.world, bundle.rest, life)
  }, [bundle, life])

  useFrame(({ clock }, delta) => {
    if (!group.current) return
    const visual = lifeVisualState(life)
    // Slow exterior turn while alive; death freezes the remnant in place.
    if (view === 'exterior' && !life.dead) {
      group.current.rotation.y += delta * 0.045
    }
    const breath =
      1 + Math.sin(clock.elapsedTime * 0.62) * 0.0035 * visual.motion
    group.current.scale.setScalar(life.outputs.form.scale * breath)

    const presence = visual.membrane
    const fade = 1 - presence
    if (skinMaterial.current) {
      const material = skinMaterial.current
      material.transparent = presence < 0.98
      material.opacity = THREE.MathUtils.lerp(0.1, 1, presence)
      material.depthWrite = presence > 0.28
      material.roughness = THREE.MathUtils.lerp(0.34, 0.78, fade)
      material.metalness = THREE.MathUtils.lerp(0.08, 0.02, fade)
      material.clearcoat = 0.72 * presence
      material.iridescence = 0.24 * presence
      material.envMapIntensity = THREE.MathUtils.lerp(0.35, 1.35, presence)
      material.color.setRGB(
        THREE.MathUtils.lerp(0.62, 1, presence),
        THREE.MathUtils.lerp(0.66, 1, presence),
        THREE.MathUtils.lerp(0.7, 1, presence),
      )
    }
    if (shellMaterial.current) {
      const material = shellMaterial.current
      material.opacity = 0.18 * presence
      material.transmission = 0.38 * presence
      material.iridescence = 0.34 * presence
      material.envMapIntensity = 1.45 * presence
      material.visible = presence > 0.06
    }
    if (liningMaterial.current) {
      const material = liningMaterial.current
      material.transparent = presence < 0.98
      material.opacity = THREE.MathUtils.lerp(0.08, 1, presence)
      material.depthWrite = presence > 0.28
      material.emissiveIntensity = 0.14 * presence
      material.iridescence = 0.16 * presence
      material.envMapIntensity = THREE.MathUtils.lerp(0.12, 0.48, presence)
      material.roughness = THREE.MathUtils.lerp(0.68, 0.86, fade)
    }
  })

  if (!bundle) return null
  const { world } = bundle
  const visual = lifeVisualState(life)

  const introduceStimulus = (direction) => {
    if (life.dead) return
    const mapped = findLifeFieldRegion(life, direction)
    if (!mapped) return
    feedbackId.current += 1
    setTouchFeedback({
      id: feedbackId.current,
      direction,
      region: mapped.region,
    })
    onStimulus(direction)
  }

  const beginExteriorInteraction = (event) => {
    if (view !== 'exterior' || !group.current) return
    event.stopPropagation()
    const localDirection = group.current
      .worldToLocal(event.point.clone())
      .normalize()
      .toArray()
    exteriorDrag.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
      direction: localDirection,
    }
    event.target.setPointerCapture?.(event.pointerId)
  }

  const moveExteriorInteraction = (event) => {
    const drag = exteriorDrag.current
    if (!drag.active || view !== 'exterior' || !group.current) return
    event.stopPropagation()
    if (
      Math.hypot(
        event.clientX - drag.startX,
        event.clientY - drag.startY,
      ) > CAMERA_DRAG_THRESHOLD
    ) {
      drag.moved = true
    }
  }

  const endExteriorInteraction = (event) => {
    const drag = exteriorDrag.current
    if (!drag.active) return
    event.stopPropagation()
    event.target.releasePointerCapture?.(drag.pointerId)
    if (!drag.moved && drag.direction) {
      introduceStimulus(drag.direction)
    }
    exteriorDrag.current = {
      ...drag,
      active: false,
      direction: null,
    }
  }

  return (
    <group
      ref={group}
      rotation={[0.04, 0.22, -0.08]}
      onPointerDown={beginExteriorInteraction}
      onPointerMove={moveExteriorInteraction}
      onPointerUp={endExteriorInteraction}
      onPointerCancel={endExteriorInteraction}
    >
      <mesh geometry={world.surface} renderOrder={0}>
        <meshPhysicalMaterial
          ref={skinMaterial}
          color="#ffffff"
          vertexColors
          roughness={0.34}
          metalness={0.08}
          clearcoat={0.72}
          clearcoatRoughness={0.14}
          iridescence={0.24}
          iridescenceIOR={1.28}
          iridescenceThicknessRange={[120, 430]}
          envMapIntensity={1.35}
          side={THREE.FrontSide}
        />
      </mesh>

      <mesh
        geometry={world.surface}
        scale={1.022}
        renderOrder={2}
      >
        <meshPhysicalMaterial
          ref={shellMaterial}
          color="#9eeff1"
          roughness={0.12}
          metalness={0}
          transmission={0.38}
          thickness={0.16}
          ior={1.36}
          attenuationColor="#5fb9c2"
          attenuationDistance={2.8}
          iridescence={0.34}
          iridescenceIOR={1.32}
          iridescenceThicknessRange={[160, 520]}
          clearcoat={1}
          clearcoatRoughness={0.07}
          envMapIntensity={1.45}
          transparent
          opacity={0.18}
          depthWrite={false}
          side={THREE.FrontSide}
        />
      </mesh>

      <mesh geometry={world.surface} scale={0.994} renderOrder={0}>
        <meshPhysicalMaterial
          ref={liningMaterial}
          color="#ffffff"
          vertexColors
          emissive="#061a20"
          emissiveIntensity={0.14}
          roughness={0.68}
          metalness={0.03}
          clearcoat={0.52}
          clearcoatRoughness={0.22}
          iridescence={0.16}
          envMapIntensity={0.48}
          side={THREE.BackSide}
        />
      </mesh>

      {CRYSTAL_DEBUG ? null : (
        <>
          <mesh geometry={world.outside} renderOrder={3}>
            <meshPhysicalMaterial
              color={0xffffff}
              transmission={0.92}
              thickness={1.15}
              ior={1.62}
              dispersion={5}
              roughness={0.06}
              metalness={0}
              iridescence={0.85}
              iridescenceIOR={1.35}
              iridescenceThicknessRange={[180, 820]}
              attenuationColor={0xe4ecd9}
              attenuationDistance={2.6}
              clearcoat={1}
              clearcoatRoughness={0.04}
              specularIntensity={1}
              envMapIntensity={1.25}
              flatShading
              side={THREE.FrontSide}
            />
          </mesh>

          <mesh geometry={world.inside} renderOrder={3}>
            <meshPhysicalMaterial
              color={0xffffff}
              transmission={0.78}
              thickness={0.9}
              ior={1.62}
              dispersion={4.2}
              roughness={0.08}
              metalness={0}
              iridescence={0.78}
              iridescenceIOR={1.35}
              iridescenceThicknessRange={[180, 820]}
              attenuationColor={0xbfffe8}
              attenuationDistance={2.2}
              clearcoat={1}
              clearcoatRoughness={0.04}
              envMapIntensity={1.2}
              emissive="#6fffea"
              emissiveIntensity={0.05 * visual.vitality}
              flatShading
              side={THREE.FrontSide}
            />
          </mesh>

          <mesh geometry={world.minerals} renderOrder={1}>
            <meshStandardMaterial
              color="#ba9d52"
              metalness={0.92}
              roughness={0.3}
              flatShading
              envMapIntensity={1.45}
            />
          </mesh>
        </>
      )}
      <SpatialGrowthSites
        world={world}
        sites={life.outputs.surface.spatialGrowthSites}
        deformations={life.outputs.form.localDeformations}
        life={life}
        restOutside={bundle.rest.outside}
      />
      <TouchFeedback
        world={world}
        feedback={touchFeedback}
        morph={formMorphAmount(life.variables.growth)}
      />
    </group>
  )
}

function applyYawPitch(target, euler, yaw, pitch) {
  euler.set(pitch, yaw, 0, 'YXZ')
  target.setFromEuler(euler)
  return target
}

function yawPitchFromQuaternion(quaternion, euler) {
  euler.setFromQuaternion(quaternion, 'YXZ')
  return {
    yaw: euler.y,
    pitch: THREE.MathUtils.clamp(euler.x, -CAMERA_PITCH_LIMIT, CAMERA_PITCH_LIMIT),
  }
}

/**
 * Free-fly camera for WORLD V2. Replaces the old CameraRig, which locked the
 * camera to an exterior orbit pose or an interior look-around each frame.
 * Enter / Exit still lerps to the scripted poses, then fly-through resumes.
 */
function WorldFlyCamera({ view, onReset }) {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const outsideQuaternion = useRef(
    lookQuaternion(EXTERIOR_POSITION, new THREE.Vector3()),
  )
  const insideQuaternion = useRef(new THREE.Quaternion())
  const targetQuaternion = useRef(new THREE.Quaternion())
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))
  const forward = useRef(new THREE.Vector3())
  const right = useRef(new THREE.Vector3())
  const wish = useRef(new THREE.Vector3())
  const velocity = useRef(new THREE.Vector3())
  const wheel = useRef(new THREE.Vector3())
  const keys = useRef({
    w: false,
    a: false,
    s: false,
    d: false,
    q: false,
    e: false,
    shift: false,
  })
  const focused = useRef(false)
  const yaw = useRef(0)
  const pitch = useRef(0)
  const drag = useRef({
    pointerId: null,
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
    looking: false,
  })
  const transition = useRef({
    view: null,
    elapsed: 0,
    fromPosition: EXTERIOR_POSITION.clone(),
    fromQuaternion: new THREE.Quaternion(),
  })

  const snapToExterior = () => {
    const pose = yawPitchFromQuaternion(outsideQuaternion.current, euler.current)
    yaw.current = pose.yaw
    pitch.current = pose.pitch
    velocity.current.set(0, 0, 0)
    wheel.current.set(0, 0, 0)
    camera.position.copy(EXTERIOR_POSITION)
    camera.quaternion.copy(outsideQuaternion.current)
  }

  const syncLookFromCamera = () => {
    const pose = yawPitchFromQuaternion(camera.quaternion, euler.current)
    yaw.current = pose.yaw
    pitch.current = pose.pitch
  }

  useLayoutEffect(() => {
    // oxlint-disable-next-line react(immutability)
    camera.near = CAMERA_NEAR
    camera.far = CAMERA_FAR
    camera.updateProjectionMatrix()
    snapToExterior()
  }, [camera])

  useEffect(() => {
    if (view !== 'entering' && view !== 'exiting') {
      syncLookFromCamera()
      return undefined
    }
    transition.current = {
      view,
      elapsed: 0,
      fromPosition: camera.position.clone(),
      fromQuaternion: camera.quaternion.clone(),
    }
    if (view === 'entering') {
      yaw.current = 0
      pitch.current = 0
    }
    return undefined
  }, [camera, view])

  useEffect(() => {
    const element = gl.domElement
    element.tabIndex = 0
    element.setAttribute('aria-label', 'World viewport')
    element.style.outline = 'none'
    element.style.touchAction = 'none'

    const setKey = (code, pressed) => {
      if (code === 'KeyW') keys.current.w = pressed
      else if (code === 'KeyA') keys.current.a = pressed
      else if (code === 'KeyS') keys.current.s = pressed
      else if (code === 'KeyD') keys.current.d = pressed
      else if (code === 'KeyQ') keys.current.q = pressed
      else if (code === 'KeyE') keys.current.e = pressed
      else if (code === 'ShiftLeft' || code === 'ShiftRight') {
        keys.current.shift = pressed
      }
    }

    const clearMotion = () => {
      keys.current.w = false
      keys.current.a = false
      keys.current.s = false
      keys.current.d = false
      keys.current.q = false
      keys.current.e = false
      keys.current.shift = false
      drag.current.pointerId = null
      drag.current.looking = false
    }

    const onFocus = () => {
      focused.current = true
    }
    const onBlur = () => {
      focused.current = false
      clearMotion()
    }
    if (document.activeElement === element) focused.current = true
    const onPointerDown = (event) => {
      if (event.button !== 0) return
      element.focus()
      drag.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        looking: false,
      }
    }
    const onPointerMove = (event) => {
      if (drag.current.pointerId !== event.pointerId) return
      const deltaX = event.clientX - drag.current.x
      const deltaY = event.clientY - drag.current.y
      drag.current.x = event.clientX
      drag.current.y = event.clientY
      if (
        !drag.current.looking &&
        Math.hypot(
          event.clientX - drag.current.startX,
          event.clientY - drag.current.startY,
        ) < CAMERA_DRAG_THRESHOLD
      ) {
        return
      }
      drag.current.looking = true
      yaw.current -= deltaX * CAMERA_LOOK_SENSITIVITY
      pitch.current = THREE.MathUtils.clamp(
        pitch.current - deltaY * CAMERA_LOOK_SENSITIVITY,
        -CAMERA_PITCH_LIMIT,
        CAMERA_PITCH_LIMIT,
      )
    }
    const onPointerUp = (event) => {
      if (drag.current.pointerId !== event.pointerId) return
      drag.current.pointerId = null
      drag.current.looking = false
    }
    const onWheel = (event) => {
      event.preventDefault()
      const pixels =
        event.deltaMode === 1
          ? event.deltaY * 16
          : event.deltaMode === 2
            ? event.deltaY * element.clientHeight
            : event.deltaY
      camera.getWorldDirection(forward.current)
      wheel.current.addScaledVector(forward.current, -pixels * 0.018)
    }
    const onKeyDown = (event) => {
      if (!focused.current && document.activeElement !== element) return
      if (
        event.code === 'KeyW' ||
        event.code === 'KeyA' ||
        event.code === 'KeyS' ||
        event.code === 'KeyD' ||
        event.code === 'KeyQ' ||
        event.code === 'KeyE' ||
        event.code === 'ShiftLeft' ||
        event.code === 'ShiftRight'
      ) {
        event.preventDefault()
        setKey(event.code, true)
        keys.current.shift = event.shiftKey || keys.current.shift
        return
      }
      if (event.code !== 'KeyR' || event.repeat) return
      event.preventDefault()
      snapToExterior()
      onReset?.()
    }
    const onKeyUp = (event) => {
      setKey(event.code, false)
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        keys.current.shift = event.shiftKey
      }
    }

    element.addEventListener('focus', onFocus)
    element.addEventListener('blur', onBlur)
    element.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    element.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      element.removeEventListener('focus', onFocus)
      element.removeEventListener('blur', onBlur)
      element.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      element.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      clearMotion()
    }
  }, [camera, gl, onReset])

  useFrame((_, delta) => {
    const dt = Math.min(0.05, Math.max(0, delta))
    const scripted = view === 'entering' || view === 'exiting'

    if (scripted) {
      const current = transition.current
      current.elapsed += dt
      const progress = easeInOutCubic(
        Math.min(1, current.elapsed / TRANSITION_DURATION),
      )
      const entering = view === 'entering'
      const destinationPosition = entering ? INTERIOR_POSITION : EXTERIOR_POSITION
      const destinationQuaternion = entering
        ? insideQuaternion.current
        : outsideQuaternion.current
      camera.position.lerpVectors(
        current.fromPosition,
        destinationPosition,
        progress,
      )
      camera.quaternion
        .copy(current.fromQuaternion)
        .slerp(destinationQuaternion, progress)
      velocity.current.set(0, 0, 0)
      wheel.current.set(0, 0, 0)
      return
    }

    applyYawPitch(
      targetQuaternion.current,
      euler.current,
      yaw.current,
      pitch.current,
    )
    camera.quaternion.slerp(
      targetQuaternion.current,
      1 - Math.exp(-dt * CAMERA_LOOK_DAMPING),
    )

    camera.getWorldDirection(forward.current)
    right.current.crossVectors(forward.current, WORLD_UP)
    if (right.current.lengthSq() < 1e-8) {
      right.current.set(1, 0, 0).applyQuaternion(camera.quaternion)
    } else {
      right.current.normalize()
    }

    wish.current.set(0, 0, 0)
    focused.current = document.activeElement === gl.domElement
    if (!focused.current) {
      keys.current.w = false
      keys.current.a = false
      keys.current.s = false
      keys.current.d = false
      keys.current.q = false
      keys.current.e = false
      keys.current.shift = false
    } else {
      if (keys.current.w) wish.current.add(forward.current)
      if (keys.current.s) wish.current.sub(forward.current)
      if (keys.current.d) wish.current.add(right.current)
      if (keys.current.a) wish.current.sub(right.current)
      if (keys.current.e) wish.current.add(WORLD_UP)
      if (keys.current.q) wish.current.sub(WORLD_UP)
    }
    if (wish.current.lengthSq() > 1e-8) {
      wish.current.normalize().multiplyScalar(
        keys.current.shift ? CAMERA_SPRINT_SPEED : CAMERA_WALK_SPEED,
      )
    }

    const moveBlend = 1 - Math.exp(-dt * CAMERA_MOVE_DAMPING)
    velocity.current.lerp(wish.current, moveBlend)
    camera.position.addScaledVector(velocity.current, dt)

    const wheelBlend = 1 - Math.exp(-dt * CAMERA_WHEEL_DAMPING)
    camera.position.addScaledVector(wheel.current, wheelBlend)
    wheel.current.lerp(ZERO, wheelBlend)
  })

  return null
}

function WorldPostprocessing({ view }) {
  const session = useRef(null)
  const get = useThree((state) => state.get)
  const size = useThree((state) => state.size)

  useLayoutEffect(() => {
    const { gl, scene, camera, size: currentSize } = get()
    const composer = new EffectComposer(gl)
    composer.setPixelRatio(gl.getPixelRatio())
    composer.setSize(currentSize.width, currentSize.height)
    composer.addPass(new RenderPass(scene, camera))
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(currentSize.width, currentSize.height),
      0.34,
      0.42,
      0.8,
    )
    composer.addPass(bloom)
    const output = new OutputPass()
    composer.addPass(output)
    const finish = new ShaderPass(FINISH_SHADER)
    composer.addPass(finish)
    session.current = { composer, bloom, output, finish }

    return () => {
      session.current = null
      bloom.dispose()
      output.dispose()
      finish.dispose()
      composer.dispose()
    }
  }, [get])

  useLayoutEffect(() => {
    const current = session.current
    if (!current) return
    const { gl } = get()
    current.composer.setPixelRatio(gl.getPixelRatio())
    current.composer.setSize(size.width, size.height)
    current.bloom.resolution.set(size.width, size.height)
  }, [get, size.height, size.width])

  useFrame(({ clock }) => {
    const current = session.current
    if (!current) return
    const interior = view === 'interior' || view === 'exiting'
    current.finish.uniforms.uTime.value = clock.elapsedTime % 100
    current.finish.uniforms.uInterior.value = THREE.MathUtils.damp(
      current.finish.uniforms.uInterior.value,
      interior ? 1 : 0,
      3,
      1 / 60,
    )
    current.composer.render()
  }, 1)

  return null
}

function WorldScene({ view, life, onStimulus, backgroundStudy, onCameraReset }) {
  return (
    <>
      <WorldEnvironment
        view={view}
        backgroundStudy={backgroundStudy}
      />
      <WorldOrganism
        key={life.seed}
        view={view}
        life={life}
        onStimulus={onStimulus}
      />
      <WorldFlyCamera view={view} onReset={onCameraReset} />
      <WorldPostprocessing view={view} />
    </>
  )
}

export default function WorldV2({ modeId, onSelectMode }) {
  const [view, setView] = useState('exterior')
  const [showComparison, setShowComparison] = useState(false)
  const [backgroundStudy, setBackgroundStudy] = useState('dark')
  const {
    life,
    playing,
    togglePlaying,
    restart,
    changeSeed,
    addStimulus,
    seekToAge,
  } = useLifeEngine(WORLD_V2_SEED)
  const [seedDraft, setSeedDraft] = useState(String(WORLD_V2_SEED))
  const transitioning = view === 'entering' || view === 'exiting'
  const interior = view === 'interior' || view === 'exiting'
  const baseline = useMemo(() => {
    if (!import.meta.env.DEV || !showComparison) return null
    return replayLife({
      seed: life.seed,
      history: [],
      step: life.step,
      durationSeconds: life.durationSeconds,
    })
  }, [
    life.durationSeconds,
    life.seed,
    life.step,
    showComparison,
  ])
  const growthRegions = life.spatial.sites
    .map(({ region }) => region)
    .sort((a, b) => a - b)
  const baselineRegions = baseline
    ? baseline.spatial.sites.map(({ region }) => region).sort((a, b) => a - b)
    : []
  const locationsChanged =
    baseline !== null &&
    growthRegions.join(',') !== baselineRegions.join(',')

  useEffect(() => {
    if (!transitioning) return undefined
    const destination = view === 'entering' ? 'interior' : 'exterior'
    const timer = window.setTimeout(
      () => setView(destination),
      TRANSITION_DURATION * 1000,
    )
    return () => window.clearTimeout(timer)
  }, [transitioning, view])

  const toggleView = () => {
    if (transitioning) return
    setView(view === 'exterior' ? 'entering' : 'exiting')
  }

  const resetCameraView = useCallback(() => {
    setView('exterior')
  }, [])

  const commitSeed = () => {
    const nextSeed = Math.max(1, Math.floor(Number(seedDraft) || 1))
    setSeedDraft(String(nextSeed))
    if (nextSeed !== life.seed) changeSeed(nextSeed)
  }

  return (
    <main
      className={`world-v2 world-v2--${view} world-v2--background-${backgroundStudy}`}
      data-life-state={life.dead ? 'dead' : playing ? 'running' : 'paused'}
      data-life-step={life.step}
      data-interventions={life.history.length}
      data-growth-sites={life.spatial.sites.length}
      data-stimulus-regions={life.history
        .map(({ region }) => region)
        .join(',')}
      data-growth-regions={growthRegions.join(',')}
      data-baseline-growth-regions={baselineRegions.join(',')}
    >
      <Canvas
        className="world-v2__viewport"
        camera={{ position: EXTERIOR_POSITION.toArray(), fov: 34, near: CAMERA_NEAR, far: CAMERA_FAR }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x010405, 1)
          gl.toneMapping = THREE.AgXToneMapping
          gl.toneMappingExposure = 1.12
        }}
      >
        <WorldScene
          view={view}
          life={life}
          onStimulus={addStimulus}
          backgroundStudy={backgroundStudy}
          onCameraReset={resetCameraView}
        />
      </Canvas>

      <SiteHud className="world-v2__hud">
        <SiteHeader modeId={modeId} onSelectMode={onSelectMode} />
      </SiteHud>

      <section
        className="world-v2__background-study"
        aria-label="Background Study"
      >
        <span>Background Study</span>
        <div>
          {[
            ['light', 'A — Light'],
            ['dark', 'B — Dark'],
            ['atmospheric', 'C — Atmospheric'],
            ['shader', 'D — Shader'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={backgroundStudy === id ? 'is-active' : ''}
              aria-pressed={backgroundStudy === id}
              onClick={() => setBackgroundStudy(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <div className="world-v2__experience">
        <p>
          {life.dead
            ? 'Mineral remnant'
            : interior
              ? 'Inner world'
              : 'Living specimen'}
        </p>
        <button
          type="button"
          onClick={toggleView}
          disabled={transitioning}
          aria-label={interior ? 'Exit organism' : 'Enter organism'}
        >
          {view === 'entering'
            ? 'Entering'
            : view === 'exiting'
              ? 'Exiting'
              : interior
                ? 'Exit'
                : 'Enter'}
        </button>
        <span>WASD move · QE elevate · drag look · scroll dolly · R reset</span>
      </div>

      <section className="world-v2__life" aria-label="Life Engine controls">
        <div className="world-v2__life-actions">
          <button
            type="button"
            onClick={togglePlaying}
            disabled={life.dead}
          >
            {life.dead ? 'Ended' : playing ? 'Pause' : 'Play'}
          </button>
          <button type="button" onClick={restart}>
            Restart
          </button>
          {import.meta.env.DEV ? (
            <button
              type="button"
              onClick={() => setShowComparison((current) => !current)}
              aria-pressed={showComparison}
            >
              {showComparison ? 'Hide Compare' : 'Compare'}
            </button>
          ) : null}
        </div>
        <label>
          Seed
          <input
            type="number"
            min="1"
            step="1"
            value={seedDraft}
            onChange={(event) => setSeedDraft(event.target.value)}
            onBlur={commitSeed}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur()
              }
            }}
          />
        </label>
        <output>Age {life.age.toFixed(3)}</output>
        {life.dead ? (
          <p className="world-v2__life-ended" aria-live="polite">
            Life ended
          </p>
        ) : null}
        {baseline ? (
          <div className="world-v2__comparison" aria-live="polite">
            <span>
              Baseline sites {baselineRegions.join(', ') || 'none'}
            </span>
            <span>
              Stimulated sites {growthRegions.join(', ') || 'none'}
            </span>
            <span>
              Stimulus regions{' '}
              {life.history.map(({ region }) => region).join(', ') ||
                'none'}
            </span>
            <strong>
              {life.history.length === 0
                ? 'Touch the surface to begin'
                : locationsChanged
                  ? 'Crystal locations changed'
                  : 'Awaiting structural divergence'}
            </strong>
            <button
              type="button"
              onClick={() => changeSeed(life.seed)}
            >
              Reset clean trial
            </button>
          </div>
        ) : null}
      </section>

      <section
        className="world-v2__timeline"
        aria-label="Life timeline"
      >
        <div className="world-v2__timeline-labels">
          <span>Born</span>
          <span>Death</span>
        </div>
        <input
          className="world-v2__timeline-range"
          type="range"
          min="0"
          max="1"
          step="0.001"
          value={life.age}
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={Number(life.age.toFixed(3))}
          aria-valuetext={`Age ${life.age.toFixed(3)}`}
          onPointerDown={() => seekToAge(life.age)}
          onChange={(event) => {
            seekToAge(Number(event.target.value))
          }}
        />
      </section>
    </main>
  )
}
