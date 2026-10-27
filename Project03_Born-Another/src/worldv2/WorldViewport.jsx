import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import WebGLCanvas from '../WebGLCanvas.jsx'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import {
  createWorldGeometry,
  disposeWorldGeometry,
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
import { sampleTurbulenceFromLife } from './turbulenceField.js'
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
import { findLifeFieldRegion } from './life/lifeEngine.js'
import { resolveRenderDpr, STUDIES_MAX_PIXELS } from '../renderBudget.js'

function useWorldDpr(maxPixels = STUDIES_MAX_PIXELS) {
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

const CRYSTAL_DEBUG =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('crystalDebug')

/**
 * Visual-only death / late-life appearance from existing Life Engine outputs.
 * Does not alter simulation state 鈥?Restart + replay restore living look
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
/** Stable exterior orbit pivot — organism body rests at world origin. */
const ORGANISM_PIVOT = new THREE.Vector3(0, 0, 0)
/** Clear of the membrane wall, looking into the cavity. */
const INTERIOR_POSITION = new THREE.Vector3(0, 0.04, 0.18)
const INTERIOR_LOOK_AT = new THREE.Vector3(0.55, 0.08, -0.35)
const TRANSITION_DURATION = 1.35
const CAMERA_NEAR = 0.025
const CAMERA_FAR = 240
const CAMERA_WALK_SPEED = 5.4
const CAMERA_SPRINT_SPEED = 14
const CAMERA_LOOK_SENSITIVITY = 0.0042
const CAMERA_ORBIT_SENSITIVITY = 0.005
const CAMERA_PITCH_LIMIT = Math.PI * 0.46
const CAMERA_ORBIT_PHI_MIN = 0.14
const CAMERA_ORBIT_PHI_MAX = Math.PI - 0.14
const CAMERA_ORBIT_RADIUS_MIN = 4.2
const CAMERA_ORBIT_RADIUS_MAX = 36
const CAMERA_MOVE_DAMPING = 9
const CAMERA_LOOK_DAMPING = 16
const CAMERA_WHEEL_DAMPING = 11
const CAMERA_DRAG_THRESHOLD = 4
const WORLD_UP = new THREE.Vector3(0, 1, 0)
const ZERO = new THREE.Vector3()

function sphericalFromOffset(offset, out = { theta: 0, phi: Math.PI / 2, radius: 1 }) {
  const radius = Math.max(1e-4, offset.length())
  out.radius = radius
  out.theta = Math.atan2(offset.x, offset.z)
  out.phi = Math.acos(
    THREE.MathUtils.clamp(offset.y / radius, -1, 1),
  )
  return out
}

function offsetFromSpherical(theta, phi, radius, target = new THREE.Vector3()) {
  const sinPhi = Math.sin(phi)
  return target.set(
    radius * sinPhi * Math.sin(theta),
    radius * Math.cos(phi),
    radius * sinPhi * Math.cos(theta),
  )
}

/** Default exterior spherical pose derived from EXTERIOR_POSITION. */
function createDefaultOrbitState() {
  const spherical = sphericalFromOffset(
    EXTERIOR_POSITION.clone().sub(ORGANISM_PIVOT),
  )
  return {
    theta: spherical.theta,
    phi: spherical.phi,
    radius: spherical.radius,
    revision: 0,
  }
}

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

/**
 * D 鈥?Shader: screen-space grade over the B 鈥?Dark frame
 * (soft invert 鈫?milky lift 鈫?pastel residual). Pass-through when uEnabled = 0.
 */
const SHADER_STUDY_GRADE = {
  uniforms: {
    tDiffuse: { value: null },
    uEnabled: { value: 0 },
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
    uniform float uEnabled;
    varying vec2 vUv;

    void main() {
      vec3 src = texture2D(tDiffuse, vUv).rgb;
      if (uEnabled < 0.001) {
        gl_FragColor = vec4(src, 1.0);
        return;
      }

      // Soft photographic invert of the dark bloomed frame.
      vec3 inv = 1.0 - src;
      inv = pow(max(inv, vec3(0.0)), vec3(0.9));

      // Lift blacks toward paper gray; keep soft charcoal in former highlights.
      vec3 paper = vec3(0.9, 0.89, 0.875);
      inv = mix(paper, inv, 0.82);
      inv = mix(inv, paper, 0.08);

      // Keep a muted pastel cast from inverted chroma (yellow / mint / mauve).
      float luma = dot(inv, vec3(0.2126, 0.7152, 0.0722));
      vec3 pastel = mix(vec3(luma), inv, 0.58);
      pastel += vec3(0.018, 0.012, 0.008);
      pastel = clamp(pastel, 0.0, 1.0);

      gl_FragColor = vec4(mix(src, pastel, clamp(uEnabled, 0.0, 1.0)), 1.0);
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
  // D 鈥?Shader reuses B 鈥?Dark scene background; milky look is post only.
  if (study === 'dark' || study === 'shader') return new THREE.Color('#000000')

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

function WorldEnvironment({
  view,
  backgroundStudy,
  appearancePreset = 'world',
  /** When true, clear alpha so Studies `.stage` page gradient shows through. */
  seamlessPageBackground = false,
}) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const interior = view !== 'exterior'
  const ethereal = appearancePreset === 'final-form'
  const background = useMemo(
    () =>
      seamlessPageBackground ? null : createWorldBackground(backgroundStudy),
    [backgroundStudy, seamlessPageBackground],
  )

  useLayoutEffect(() => {
    const environment = createEnvironment(gl)
    // R3F owns the Scene object; this component owns and restores its world-only setup.
    // oxlint-disable-next-line react(immutability)
    scene.environment = environment
    scene.environmentIntensity = ethereal
      ? backgroundStudy === 'light'
        ? 0.28
        : 0.4
      : backgroundStudy === 'light'
        ? 0.95
        : 1.15
    return () => {
      if (scene.environment === environment) scene.environment = null
      environment.dispose()
    }
  }, [gl, scene, backgroundStudy, ethereal])

  useLayoutEffect(() => {
    // Background studies are isolated from the PMREM environment and lighting.
    // oxlint-disable-next-line react(immutability)
    scene.background = background
    if (seamlessPageBackground) {
      /* Match Studies body fill for fog; page CSS gradient shows through clear. */
      scene.fog = new THREE.FogExp2(0xc3c7d0, ethereal ? 0.016 : 0.012)
      gl.setClearColor(0x000000, 0)
    } else {
      const light = backgroundStudy === 'light'
      scene.fog = light
        ? new THREE.FogExp2(0xd9dee2, ethereal ? 0.018 : 0.014)
        : new THREE.FogExp2(0x010405, 0.028)
      gl.setClearColor(light ? 0xd9dee2 : 0x010405, 1)
    }
    return () => {
      if (scene.background === background) scene.background = null
      scene.fog = null
      if (background?.isTexture) background.dispose()
    }
  }, [
    background,
    backgroundStudy,
    ethereal,
    gl,
    scene,
    seamlessPageBackground,
  ])

  return (
    <>
      <directionalLight
        color="#e8ffff"
        intensity={
          interior ? 0.45 : ethereal ? (backgroundStudy === 'light' ? 0.55 : 0.9) : 2.4
        }
        position={[4, 6, 5]}
      />
      <directionalLight
        color="#ff7096"
        intensity={
          interior ? 0.25 : ethereal ? (backgroundStudy === 'light' ? 0.28 : 0.45) : 1.1
        }
        position={[-5, -2, 4]}
      />
      <ambientLight
        color={ethereal ? '#f2f4f6' : '#000000'}
        intensity={ethereal ? (backgroundStudy === 'light' ? 0.62 : 0.2) : 0}
      />
      <pointLight
        color="#4de5ed"
        intensity={interior ? 3.5 : ethereal ? 0.02 : 0.08}
        distance={6}
        position={[0.8, 0.5, 0.2]}
      />
      <pointLight
        color="#ff658f"
        intensity={interior ? 2.8 : ethereal ? 0.015 : 0.06}
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
  life = null,
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
    const turb = sampleTurbulenceFromLife(
      shaped[0],
      shaped[1],
      shaped[2],
      life,
    )
    const root = deformRadialPoint(
      shaped[0],
      shaped[1],
      shaped[2],
      deformations,
      turb,
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

/**
 * Local-space surface anchor for a growth site (same path as crystal roots).
 * Used by Playground close-up follow; keep in sync with SpatialGrowthSites.
 */
function growthSiteLocalAnchor(world, site, life, extraRadialOffset = null) {
  if (!world || !site?.direction) return null
  const morph = formMorphAmount(life?.variables?.growth ?? 1)
  const outwardNormal = new THREE.Vector3().fromArray(site.direction).normalize()
  const restRadius = world.radiusAt(outwardNormal)
  const shapedRadius = morphRestRadius(restRadius, morph)
  const restPoint = [
    site.direction[0] * shapedRadius,
    site.direction[1] * shapedRadius,
    site.direction[2] * shapedRadius,
  ]
  const playgroundExtra =
    typeof extraRadialOffset === 'function'
      ? extraRadialOffset(restPoint[0], restPoint[1], restPoint[2])
      : 0
  const extra =
    playgroundExtra +
    sampleTurbulenceFromLife(
      restPoint[0],
      restPoint[1],
      restPoint[2],
      life,
    )
  return primaryCrystalAnchor(
    site,
    restRadius,
    life?.outputs?.form?.localDeformations ?? [],
    0,
    morph,
    extra,
  )
}

function SpatialGrowthSites({
  world,
  sites,
  deformations,
  life,
  restOutside,
  extraRadialOffset = null,
}) {
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
    const restRadius = world.radiusAt(outwardNormal)
    const shapedRadius = morphRestRadius(restRadius, morph)
    const restPoint = [
      site.direction[0] * shapedRadius,
      site.direction[1] * shapedRadius,
      site.direction[2] * shapedRadius,
    ]
    const playgroundExtra =
      typeof extraRadialOffset === 'function'
        ? extraRadialOffset(restPoint[0], restPoint[1], restPoint[2])
        : 0
    const extra =
      playgroundExtra +
      sampleTurbulenceFromLife(
        restPoint[0],
        restPoint[1],
        restPoint[2],
        life,
      )
    const surface = new THREE.Vector3().fromArray(
      primaryCrystalAnchor(
        site,
        restRadius,
        deformations,
        0,
        morph,
        extra,
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
      life,
    )
    return [...fromLife, ...fromBaked]
  }, [transforms, restOutside, seed, age, decay, growth, deformations, life])

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

function WorldOrganism({
  view,
  life,
  onStimulus,
  deformAmplitudeScale = 1,
  deformFrequencyScale = 1,
  sharedTimeRef = null,
  /** Optional (life, elapsedSeconds) => life for Playground temperature compare. */
  resolveLifeForRender = null,
  /** Breath radial amp when using shared compare clock (World keeps 0.0035). */
  breathAmplitude = 0.0035,
  /** Optional (x,y,z) => radial offset — distributed temperature spatial field. */
  extraRadialOffset = null,
  /** Optional (x,y,z) => influence −1…1 for diagnostic vertex tint. */
  influenceOverlay = null,
  /** Playground diagnostic: opaque gray + wireframe; hides decorative materials. */
  geometryDebug = false,
  /** World-space translation; local membrane / stimulus space stays organism-local. */
  position = null,
  /** When false, skip slow exterior spin (Playground close-up studies). */
  autoRotate = true,
  /** Playground: growth site id whose deformed root updates orbitPivotRef. */
  followGrowthSiteId = null,
  /** Playground: locked growth site ids — pivot = centroid of present members. */
  followGrowthSiteIds = null,
  /**
   * Playground: when set, only these spatial growth site ids render.
   * null = World default (all sites). Exp03 Study 01 hides off-cluster crystals.
   */
  visibleGrowthSiteIds = null,
  /**
   * When false, hide spatial + baked crystal meshes (Final Form Lab soft look).
   * Default true — World / other experiments unchanged.
   */
  showSpatialCrystals = true,
  /**
   * 'world' (default) — Physical membrane materials.
   * 'final-form' — Exp05 ethereal / barely-visible body (Explore-like).
   */
  appearancePreset = 'world',
  /**
   * Playground: optional node or (ctx) => node inside the organism group.
   * ctx = { world, life, rest }.
   */
  organismOverlay = null,
  /**
   * How followGrowthSiteId(s) write orbitPivotRef:
   * 'live' (default) — update every frame while membrane/sites move.
   * 'once' — Exp03 Study 01: capture cluster centroid once, then stop so
   *          Growth Time scrubbing never reframes the camera.
   */
  followGrowthSiteMode = 'live',
  /** Fired once when followGrowthSiteMode='once' settles the pivot. */
  onFollowPivotSettled = null,
  /** Mutable [x,y,z] world pivot written each frame when following a site. */
  orbitPivotRef = null,
  /**
   * Optional (seed) => world geometry. Playground Morphology Lab injects a
   * rest-shape field; World / Exp01–03 omit this and keep createWorldGeometry.
   */
  createGeometry = null,
  /** Bump when morphology params change so rest geometry rebuilds. */
  geometryRevision = 0,
}) {
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
  const normalsTick = useRef(0)
  const lifeRef = useRef(life)
  const resolveRef = useRef(resolveLifeForRender)
  const extraRadialRef = useRef(extraRadialOffset)
  const influenceRef = useRef(influenceOverlay)
  const followSiteRef = useRef(followGrowthSiteId)
  const followSitesRef = useRef(followGrowthSiteIds)
  const followModeRef = useRef(followGrowthSiteMode)
  const followOnceDoneRef = useRef(false)
  const onFollowPivotSettledRef = useRef(onFollowPivotSettled)
  const visibleSitesRef = useRef(visibleGrowthSiteIds)
  const orbitPivotOutRef = useRef(orbitPivotRef)
  const createGeometryRef = useRef(createGeometry)
  const _followWorld = useRef(new THREE.Vector3())
  const _followAccum = useRef(new THREE.Vector3())
  lifeRef.current = life
  resolveRef.current = resolveLifeForRender
  extraRadialRef.current = extraRadialOffset
  influenceRef.current = influenceOverlay
  followSiteRef.current = followGrowthSiteId
  followSitesRef.current = followGrowthSiteIds
  followModeRef.current = followGrowthSiteMode === 'once' ? 'once' : 'live'
  onFollowPivotSettledRef.current = onFollowPivotSettled
  visibleSitesRef.current = visibleGrowthSiteIds
  orbitPivotOutRef.current = orbitPivotRef
  createGeometryRef.current = createGeometry

  useEffect(() => {
    followOnceDoneRef.current = false
  }, [followGrowthSiteId, followGrowthSiteIds, followGrowthSiteMode])
  const ampScale = Number.isFinite(deformAmplitudeScale)
    ? deformAmplitudeScale
    : 1
  const freqScale = Number.isFinite(deformFrequencyScale)
    ? Math.max(1e-3, deformFrequencyScale)
    : 1
  const breathAmp = Number.isFinite(breathAmplitude)
    ? breathAmplitude
    : 0.0035

  useEffect(() => {
    const factory = createGeometryRef.current
    const next =
      typeof factory === 'function'
        ? factory(life.seed)
        : createWorldGeometry(life.seed)
    const rest = captureWorldRestState(next)
    // Geometry is created after mount so StrictMode's test mount is also disposed.
    // oxlint-disable-next-line react(set-state-in-effect)
    setBundle({ world: next, rest })
    return () => disposeWorldGeometry(next)
  }, [life.seed, geometryRevision])

  const applyDisplayLife = (elapsed, { updateNormals }) => {
    if (!bundle) return
    const source = lifeRef.current
    const resolve = resolveRef.current
    const displayLife =
      typeof resolve === 'function' ? resolve(source, elapsed) : source
    applyLifeToWorld(bundle.world, bundle.rest, displayLife, {
      updateNormals,
      extraRadialOffset: extraRadialRef.current,
      influenceOverlay: influenceRef.current,
    })
  }

  useLayoutEffect(() => {
    if (!bundle) return
    // Playground passes resolveLifeForRender / extraRadialOffset and refreshes
    // in useFrame — skip here so life-step React updates do not hitch the frame.
    if (
      typeof resolveRef.current === 'function' ||
      typeof extraRadialRef.current === 'function'
    ) {
      return
    }
    // World: keep membrane + baked crystal anchors on the same life sample.
    // Recompute normals every other life sample while playing — main-thread win.
    normalsTick.current += 1
    const sharedTime = sharedTimeRef?.current
    const elapsed = typeof sharedTime === 'number' ? sharedTime : 0
    applyDisplayLife(elapsed, {
      updateNormals: normalsTick.current % 2 === 1,
    })
  }, [
    bundle,
    life,
    deformAmplitudeScale,
    deformFrequencyScale,
    extraRadialOffset,
    influenceOverlay,
  ])

  useFrame(({ clock }, delta) => {
    if (!group.current) return
    const visual = lifeVisualState(life)
    const sharedTime = sharedTimeRef?.current
    const elapsed =
      typeof sharedTime === 'number' ? sharedTime : clock.elapsedTime
    const source = lifeRef.current
    const resolve = resolveRef.current
    const displayLife =
      typeof resolve === 'function' ? resolve(source, elapsed) : source
    // Playground: refresh temporal ambient + spatial / turbulence each frame.
    if (
      (typeof resolve === 'function' ||
        typeof extraRadialRef.current === 'function') &&
      bundle
    ) {
      normalsTick.current += 1
      applyDisplayLife(elapsed, {
        updateNormals: normalsTick.current % 2 === 1,
      })
    }
    // Slow exterior turn while alive; death freezes the remnant in place.
    // Shared clock → absolute yaw so dual compare viewports stay matched.
    if (autoRotate && view === 'exterior' && !life.dead) {
      if (typeof sharedTime === 'number') {
        group.current.rotation.y = elapsed * 0.045
      } else {
        group.current.rotation.y += delta * 0.045
      }
    }
    const breath =
      1 +
      Math.sin(elapsed * 0.62 * freqScale) *
        breathAmp *
        ampScale *
        visual.motion
    group.current.scale.setScalar(
      (displayLife?.outputs?.form?.scale ?? life.outputs.form.scale) * breath,
    )

    /* Playground close-up: orbit pivot on locked growth site(s). */
    const followIds = followSitesRef.current
    const followId = followSiteRef.current
    const pivotOut = orbitPivotOutRef.current
    const followOnceDone =
      followModeRef.current === 'once' && followOnceDoneRef.current
    const idList = Array.isArray(followIds)
      ? followIds
      : followId != null
        ? [followId]
        : null
    if (
      !followOnceDone &&
      idList?.length &&
      pivotOut &&
      bundle?.world &&
      Array.isArray(pivotOut.current)
    ) {
      const sites = displayLife?.outputs?.surface?.spatialGrowthSites ?? []
      const wanted = new Set(idList)
      _followAccum.current.set(0, 0, 0)
      let counted = 0
      for (const site of sites) {
        if (!wanted.has(site.id)) continue
        const local = growthSiteLocalAnchor(
          bundle.world,
          site,
          displayLife,
          extraRadialRef.current,
        )
        if (!local) continue
        _followWorld.current.set(local[0], local[1], local[2])
        group.current.localToWorld(_followWorld.current)
        _followAccum.current.add(_followWorld.current)
        counted += 1
      }
      if (counted > 0) {
        _followAccum.current.multiplyScalar(1 / counted)
        pivotOut.current[0] = _followAccum.current.x
        pivotOut.current[1] = _followAccum.current.y
        pivotOut.current[2] = _followAccum.current.z
        if (followModeRef.current === 'once') {
          followOnceDoneRef.current = true
          onFollowPivotSettledRef.current?.([
            pivotOut.current[0],
            pivotOut.current[1],
            pivotOut.current[2],
          ])
        }
      }
    }

    const presence = visual.membrane
    const fade = 1 - presence
    // Geometry Debug uses static opaque materials — skip presence fades.
    if (geometryDebug) return
    /* Final Form Lab: hold an ethereal body — never ramp to solid World gloss. */
    if (appearancePreset === 'final-form') {
      if (skinMaterial.current) {
        const material = skinMaterial.current
        material.transparent = true
        /* Soft ghost body — readable on light gray, never solid World gloss. */
        material.opacity = 0.22 * THREE.MathUtils.lerp(0.65, 1, presence)
        material.depthWrite = false
        material.roughness = 0.88
        material.metalness = 0
        material.clearcoat = 0
        material.iridescence = 0.06 * presence
        material.envMapIntensity = 0.12
        material.transmission = 0.55
        material.thickness = 0.28
        material.color.setRGB(0.92, 0.88, 0.9)
      }
      if (shellMaterial.current) {
        const material = shellMaterial.current
        material.visible = true
        material.transparent = true
        material.opacity = 0.1 * presence
        material.transmission = 0.7
        material.iridescence = 0.08
        material.envMapIntensity = 0.16
        material.clearcoat = 0
        material.depthWrite = false
        material.color.set('#c8eef2')
      }
      if (liningMaterial.current) {
        const material = liningMaterial.current
        material.transparent = true
        material.opacity = 0.08 * presence
        material.depthWrite = false
        material.emissiveIntensity = 0.03
        material.iridescence = 0
        material.envMapIntensity = 0.06
        material.roughness = 0.92
        material.metalness = 0
        material.clearcoat = 0
      }
      return
    }
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

  const worldPosition = Array.isArray(position)
    ? position
    : position && Number.isFinite(position.x)
      ? [position.x, position.y, position.z]
      : [0, 0, 0]

  return (
    <group position={worldPosition}>
    <group
      ref={group}
      rotation={[0.04, 0.22, -0.08]}
      onPointerDown={beginExteriorInteraction}
      onPointerMove={moveExteriorInteraction}
      onPointerUp={endExteriorInteraction}
      onPointerCancel={endExteriorInteraction}
    >
      {geometryDebug ? (
        <>
          <mesh geometry={world.surface} renderOrder={0}>
            <meshStandardMaterial
              color="#9a9a9a"
              roughness={0.88}
              metalness={0}
              envMapIntensity={0}
              side={THREE.FrontSide}
            />
          </mesh>
          <mesh geometry={world.surface} renderOrder={1}>
            <meshBasicMaterial
              color="#1a1a1a"
              wireframe
              transparent
              opacity={0.4}
              depthWrite={false}
            />
          </mesh>
        </>
      ) : (
        <>
          <mesh geometry={world.surface} renderOrder={0}>
            {appearancePreset === 'final-form' ? (
              <meshPhysicalMaterial
                ref={skinMaterial}
                color="#f0e6ea"
                roughness={0.88}
                metalness={0}
                transmission={0.55}
                thickness={0.28}
                ior={1.28}
                clearcoat={0}
                iridescence={0.06}
                envMapIntensity={0.12}
                transparent
                opacity={0.22}
                depthWrite={false}
                side={THREE.FrontSide}
              />
            ) : (
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
            )}
          </mesh>

          <mesh
            geometry={world.surface}
            scale={1.022}
            renderOrder={2}
          >
            <meshPhysicalMaterial
              ref={shellMaterial}
              color={appearancePreset === 'final-form' ? '#c8eef2' : '#9eeff1'}
              roughness={appearancePreset === 'final-form' ? 0.55 : 0.12}
              metalness={0}
              transmission={appearancePreset === 'final-form' ? 0.82 : 0.38}
              thickness={0.16}
              ior={1.36}
              attenuationColor="#5fb9c2"
              attenuationDistance={2.8}
              iridescence={appearancePreset === 'final-form' ? 0.06 : 0.34}
              iridescenceIOR={1.32}
              iridescenceThicknessRange={[160, 520]}
              clearcoat={appearancePreset === 'final-form' ? 0 : 1}
              clearcoatRoughness={0.07}
              envMapIntensity={appearancePreset === 'final-form' ? 0.12 : 1.45}
              transparent
              opacity={appearancePreset === 'final-form' ? 0.1 : 0.18}
              depthWrite={false}
              side={THREE.FrontSide}
            />
          </mesh>

          <mesh geometry={world.surface} scale={0.994} renderOrder={0}>
            <meshPhysicalMaterial
              ref={liningMaterial}
              color="#ffffff"
              vertexColors={appearancePreset !== 'final-form'}
              emissive={
                appearancePreset === 'final-form' ? '#000000' : '#061a20'
              }
              emissiveIntensity={appearancePreset === 'final-form' ? 0.02 : 0.14}
              roughness={appearancePreset === 'final-form' ? 0.95 : 0.68}
              metalness={0}
              clearcoat={appearancePreset === 'final-form' ? 0 : 0.52}
              clearcoatRoughness={0.22}
              iridescence={appearancePreset === 'final-form' ? 0 : 0.16}
              envMapIntensity={appearancePreset === 'final-form' ? 0.05 : 0.48}
              transparent={appearancePreset === 'final-form'}
              opacity={appearancePreset === 'final-form' ? 0.04 : 1}
              depthWrite={appearancePreset !== 'final-form'}
              side={THREE.BackSide}
            />
          </mesh>

          {CRYSTAL_DEBUG || !showSpatialCrystals ? null : (
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
          {showSpatialCrystals ? (
            <SpatialGrowthSites
              world={world}
              sites={
                Array.isArray(visibleGrowthSiteIds)
                  ? life.outputs.surface.spatialGrowthSites.filter((site) =>
                      visibleGrowthSiteIds.includes(site.id),
                    )
                  : life.outputs.surface.spatialGrowthSites
              }
              deformations={life.outputs.form.localDeformations}
              life={life}
              restOutside={bundle.rest.outside}
              extraRadialOffset={extraRadialOffset}
            />
          ) : null}
          {typeof organismOverlay === 'function'
            ? organismOverlay({ world, life, rest: bundle.rest })
            : organismOverlay}
          <TouchFeedback
            world={world}
            feedback={touchFeedback}
            morph={formMorphAmount(life.variables.growth)}
          />
        </>
      )}
    </group>
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
 * World camera:
 * - Exterior: orbit around organism pivot (no look-pan; organism stays centered).
 * - Interior / explore: free-look + WASD (unchanged).
 * Enter / Exit still lerps between scripted poses.
 */
function WorldFlyCamera({
  view,
  onReset,
  sharedOrbitRef = null,
  /** Optional [x,y,z] exterior orbit look-at (default world origin). */
  orbitPivot = null,
  /** Mutable [x,y,z] — preferred over orbitPivot when present (live follow). */
  orbitPivotRef = null,
  /** Optional exterior orbit radius clamps (Playground close-up). */
  orbitRadiusMin = null,
  orbitRadiusMax = null,
  /**
   * 'orbit' (default) — full exterior orbit drag.
   * 'macro' — lock yaw, vertical tilt, wheel zoom.
   * 'observe' — framing locked, wheel zoom only.
   * 'inspect' — Exp03 Study 01 modeling-viewport: left orbit, middle pan,
   *             wheel zoom; pivot is user-owned (no auto-reframe).
   */
  exteriorControlMode = 'orbit',
}) {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const viewRef = useRef(view)
  viewRef.current = view
  const controlModeRef = useRef(exteriorControlMode)
  controlModeRef.current =
    exteriorControlMode === 'macro' ||
    exteriorControlMode === 'observe' ||
    exteriorControlMode === 'inspect'
      ? exteriorControlMode
      : 'orbit'
  const panRight = useRef(new THREE.Vector3())
  const panUp = useRef(new THREE.Vector3())
  const pivotRef = useRef(ORGANISM_PIVOT.clone())
  const radiusMinRef = useRef(CAMERA_ORBIT_RADIUS_MIN)
  const radiusMaxRef = useRef(CAMERA_ORBIT_RADIUS_MAX)
  radiusMinRef.current = Number.isFinite(orbitRadiusMin)
    ? orbitRadiusMin
    : CAMERA_ORBIT_RADIUS_MIN
  radiusMaxRef.current = Number.isFinite(orbitRadiusMax)
    ? orbitRadiusMax
    : CAMERA_ORBIT_RADIUS_MAX
  /** Macro: lock frontal yaw; phi tilts around the locked base angle. */
  const MACRO_TILT_RANGE = 0.72
  const MACRO_TILT_SENSITIVITY = 0.0048
  const macroAnglesLocked = useRef(false)
  const macroTheta = useRef(0)
  const macroPhi = useRef(Math.PI / 2)
  const macroPhiBase = useRef(Math.PI / 2)
  const syncPivotFromProps = () => {
    const live = orbitPivotRef?.current
    if (Array.isArray(live) && live.length >= 3) {
      pivotRef.current.set(
        Number(live[0]) || 0,
        Number(live[1]) || 0,
        Number(live[2]) || 0,
      )
      return
    }
    if (Array.isArray(orbitPivot) && orbitPivot.length >= 3) {
      pivotRef.current.set(
        Number(orbitPivot[0]) || 0,
        Number(orbitPivot[1]) || 0,
        Number(orbitPivot[2]) || 0,
      )
      return
    }
    pivotRef.current.copy(ORGANISM_PIVOT)
  }
  syncPivotFromProps()
  const outsideQuaternion = useRef(
    lookQuaternion(EXTERIOR_POSITION, ORGANISM_PIVOT),
  )
  const insideQuaternion = useRef(
    lookQuaternion(INTERIOR_POSITION, INTERIOR_LOOK_AT),
  )
  const targetQuaternion = useRef(new THREE.Quaternion())
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))
  const forward = useRef(new THREE.Vector3())
  const right = useRef(new THREE.Vector3())
  const wish = useRef(new THREE.Vector3())
  const velocity = useRef(new THREE.Vector3())
  const wheel = useRef(new THREE.Vector3())
  const orbitOffset = useRef(new THREE.Vector3())
  const localOrbit = useRef(createDefaultOrbitState())
  const appliedOrbitRevision = useRef(-1)
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
    button: 0,
    mode: 'orbit',
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

  const readOrbitState = () => sharedOrbitRef?.current ?? localOrbit.current

  const writeOrbitState = (partial) => {
    const target = sharedOrbitRef?.current ?? localOrbit.current
    if (partial.theta != null) target.theta = partial.theta
    if (partial.phi != null) target.phi = partial.phi
    if (partial.radius != null) target.radius = partial.radius
    target.revision = (target.revision ?? 0) + 1
    if (!sharedOrbitRef) localOrbit.current = target
  }

  const applyExteriorOrbit = () => {
    syncPivotFromProps()
    const orbit = readOrbitState()
    const framed =
      controlModeRef.current === 'macro' ||
      controlModeRef.current === 'observe'
    if (framed && !macroAnglesLocked.current) {
      macroTheta.current = orbit.theta
      const basePhi = THREE.MathUtils.clamp(
        orbit.phi,
        CAMERA_ORBIT_PHI_MIN,
        CAMERA_ORBIT_PHI_MAX,
      )
      macroPhiBase.current = basePhi
      macroPhi.current = basePhi
      macroAnglesLocked.current = true
    }
    const theta = framed ? macroTheta.current : orbit.theta
    const phi = THREE.MathUtils.clamp(
      framed ? macroPhi.current : orbit.phi,
      CAMERA_ORBIT_PHI_MIN,
      CAMERA_ORBIT_PHI_MAX,
    )
    const radius = THREE.MathUtils.clamp(
      orbit.radius,
      radiusMinRef.current,
      radiusMaxRef.current,
    )
    if (!framed) {
      orbit.theta = theta
      orbit.phi = phi
    } else {
      /* Keep shared state readable for HUD / reset without rewriting yaw. */
      orbit.phi = phi
    }
    orbit.radius = radius
    offsetFromSpherical(theta, phi, radius, orbitOffset.current)
    const pivot = pivotRef.current
    camera.position.copy(pivot).add(orbitOffset.current)
    camera.lookAt(pivot)
    const pose = yawPitchFromQuaternion(camera.quaternion, euler.current)
    yaw.current = pose.yaw
    pitch.current = pose.pitch
    appliedOrbitRevision.current = orbit.revision ?? 0
  }

  const panOrbitPivot = (deltaX, deltaY) => {
    const live = orbitPivotRef?.current
    if (!Array.isArray(live) || live.length < 3) return
    const orbit = readOrbitState()
    const scale = Math.max(0.35, orbit.radius) * 0.00165
    panRight.current.set(1, 0, 0).applyQuaternion(camera.quaternion)
    panUp.current.set(0, 1, 0).applyQuaternion(camera.quaternion)
    live[0] +=
      -deltaX * scale * panRight.current.x + deltaY * scale * panUp.current.x
    live[1] +=
      -deltaX * scale * panRight.current.y + deltaY * scale * panUp.current.y
    live[2] +=
      -deltaX * scale * panRight.current.z + deltaY * scale * panUp.current.z
    applyExteriorOrbit()
  }

  const unlockMacroAngles = () => {
    macroAnglesLocked.current = false
  }

  const snapToExterior = () => {
    if (
      controlModeRef.current === 'macro' ||
      controlModeRef.current === 'observe' ||
      controlModeRef.current === 'inspect'
    ) {
      /* Exp03 owns framing in sharedOrbitRef — do not jump to World defaults. */
      unlockMacroAngles()
      velocity.current.set(0, 0, 0)
      wheel.current.set(0, 0, 0)
      applyExteriorOrbit()
      return
    }
    const defaults = createDefaultOrbitState()
    writeOrbitState(defaults)
    velocity.current.set(0, 0, 0)
    wheel.current.set(0, 0, 0)
    applyExteriorOrbit()
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
    if (!sharedOrbitRef?.current) {
      const defaults = createDefaultOrbitState()
      if (sharedOrbitRef) sharedOrbitRef.current = defaults
      else localOrbit.current = defaults
    }
    snapToExterior()
  }, [camera])

  useEffect(() => {
    if (view !== 'entering' && view !== 'exiting') {
      if (view === 'exterior') applyExteriorOrbit()
      else syncLookFromCamera()
      return undefined
    }
    transition.current = {
      view,
      elapsed: 0,
      fromPosition: camera.position.clone(),
      fromQuaternion: camera.quaternion.clone(),
    }
    if (view === 'entering') {
      const pose = yawPitchFromQuaternion(
        insideQuaternion.current,
        euler.current,
      )
      yaw.current = pose.yaw
      pitch.current = pose.pitch
      // Enter button steals focus; WASD only works while the canvas is focused.
      gl.domElement.tabIndex = 0
      gl.domElement.focus({ preventScroll: true })
    }
    return undefined
  }, [camera, gl, view])

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
      drag.current.mode = 'orbit'
    }

    const onFocus = () => {
      focused.current = true
    }
    const onBlur = () => {
      focused.current = false
      clearMotion()
    }
    if (document.activeElement === element) focused.current = true

    /* Block browser autoscroll / middle-click default on the canvas. */
    const onMouseDown = (event) => {
      if (event.button === 1) event.preventDefault()
    }
    const onAuxClick = (event) => {
      event.preventDefault()
    }

    const onPointerDown = (event) => {
      const inspect = controlModeRef.current === 'inspect'
      if (event.button === 1) {
        event.preventDefault()
        if (!inspect || viewRef.current !== 'exterior') return
      } else if (event.button !== 0) {
        return
      }
      element.focus({ preventScroll: true })
      element.setPointerCapture?.(event.pointerId)
      drag.current = {
        pointerId: event.pointerId,
        button: event.button,
        mode: event.button === 1 ? 'pan' : 'orbit',
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

      if (viewRef.current === 'exterior') {
        if (
          controlModeRef.current === 'inspect' &&
          drag.current.mode === 'pan'
        ) {
          panOrbitPivot(deltaX, deltaY)
          return
        }
        if (
          controlModeRef.current === 'macro' ||
          controlModeRef.current === 'observe'
        ) {
          /* Observe: framing locked (zoom only). Macro: vertical tilt. */
          if (controlModeRef.current === 'observe') {
            return
          }
          if (!macroAnglesLocked.current) applyExteriorOrbit()
          const lo = Math.max(
            CAMERA_ORBIT_PHI_MIN,
            macroPhiBase.current - MACRO_TILT_RANGE,
          )
          const hi = Math.min(
            CAMERA_ORBIT_PHI_MAX,
            macroPhiBase.current + MACRO_TILT_RANGE,
          )
          macroPhi.current = THREE.MathUtils.clamp(
            macroPhi.current - deltaY * MACRO_TILT_SENSITIVITY,
            lo,
            hi,
          )
          const orbit = readOrbitState()
          writeOrbitState({
            theta: macroTheta.current,
            phi: macroPhi.current,
            radius: orbit.radius,
          })
          applyExteriorOrbit()
          return
        }
        // Orbit / inspect: full orbit around current pivot.
        const orbit = readOrbitState()
        writeOrbitState({
          theta: orbit.theta - deltaX * CAMERA_ORBIT_SENSITIVITY,
          phi: THREE.MathUtils.clamp(
            orbit.phi - deltaY * CAMERA_ORBIT_SENSITIVITY,
            CAMERA_ORBIT_PHI_MIN,
            CAMERA_ORBIT_PHI_MAX,
          ),
          radius: orbit.radius,
        })
        applyExteriorOrbit()
        return
      }

      yaw.current -= deltaX * CAMERA_LOOK_SENSITIVITY
      pitch.current = THREE.MathUtils.clamp(
        pitch.current - deltaY * CAMERA_LOOK_SENSITIVITY,
        -CAMERA_PITCH_LIMIT,
        CAMERA_PITCH_LIMIT,
      )
    }
    const onPointerUp = (event) => {
      if (drag.current.pointerId !== event.pointerId) return
      element.releasePointerCapture?.(event.pointerId)
      drag.current.pointerId = null
      drag.current.looking = false
      drag.current.mode = 'orbit'
    }
    const onWheel = (event) => {
      event.preventDefault()
      const pixels =
        event.deltaMode === 1
          ? event.deltaY * 16
          : event.deltaMode === 2
            ? event.deltaY * element.clientHeight
            : event.deltaY

      if (viewRef.current === 'exterior') {
        const orbit = readOrbitState()
        const dollyScale =
          controlModeRef.current === 'macro' ||
          controlModeRef.current === 'observe' ||
          controlModeRef.current === 'inspect'
            ? 0.012
            : 0.02
        writeOrbitState({
          theta: orbit.theta,
          phi: orbit.phi,
          radius: THREE.MathUtils.clamp(
            orbit.radius + pixels * dollyScale,
            radiusMinRef.current,
            radiusMaxRef.current,
          ),
        })
        applyExteriorOrbit()
        return
      }

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
        // Exterior is orbit-only; keep WASD for interior explore.
        if (viewRef.current === 'exterior') return
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
    element.addEventListener('mousedown', onMouseDown)
    element.addEventListener('auxclick', onAuxClick)
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
      element.removeEventListener('mousedown', onMouseDown)
      element.removeEventListener('auxclick', onAuxClick)
      element.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      element.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      clearMotion()
    }
  }, [camera, gl, onReset, sharedOrbitRef, orbitPivotRef])

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
      if (progress >= 1) {
        camera.position.copy(destinationPosition)
        camera.quaternion.copy(destinationQuaternion)
        if (!entering) {
          const defaults = createDefaultOrbitState()
          writeOrbitState(defaults)
          applyExteriorOrbit()
        } else {
          syncLookFromCamera()
        }
      } else {
        camera.position.lerpVectors(
          current.fromPosition,
          destinationPosition,
          progress,
        )
        camera.quaternion
          .copy(current.fromQuaternion)
          .slerp(destinationQuaternion, progress)
      }
      velocity.current.set(0, 0, 0)
      wheel.current.set(0, 0, 0)
      return
    }

    if (view === 'exterior') {
      // Always re-apply so live orbitPivotRef follow stays glued to the site.
      applyExteriorOrbit()
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

function WorldPostprocessing({
  view,
  backgroundStudy,
  geometryDebug = false,
  appearancePreset = 'world',
}) {
  const session = useRef(null)
  const get = useThree((state) => state.get)
  const size = useThree((state) => state.size)
  const shaderStudy = backgroundStudy === 'shader' && !geometryDebug
  const softBloom = appearancePreset === 'final-form'

  useLayoutEffect(() => {
    const { gl, scene, camera, size: currentSize } = get()
    const composer = new EffectComposer(gl)
    composer.setPixelRatio(gl.getPixelRatio())
    composer.setSize(currentSize.width, currentSize.height)
    composer.addPass(new RenderPass(scene, camera))
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(
        Math.max(1, currentSize.width * 0.5),
        Math.max(1, currentSize.height * 0.5),
      ),
      softBloom ? 0.12 : 0.34,
      softBloom ? 0.55 : 0.42,
      softBloom ? 0.92 : 0.8,
    )
    composer.addPass(bloom)
    const output = new OutputPass()
    composer.addPass(output)
    const finish = new ShaderPass(FINISH_SHADER)
    composer.addPass(finish)
    // D 鈥?Shader only: grade the shared B 鈥?Dark frame into the milky look.
    const shaderGrade = new ShaderPass(SHADER_STUDY_GRADE)
    shaderGrade.enabled = false
    composer.addPass(shaderGrade)
    session.current = { composer, bloom, output, finish, shaderGrade }

    return () => {
      session.current = null
      bloom.dispose()
      output.dispose()
      finish.dispose()
      shaderGrade.dispose()
      composer.dispose()
    }
  }, [get])

  useLayoutEffect(() => {
    const current = session.current
    if (!current) return
    const { gl } = get()
    current.composer.setPixelRatio(gl.getPixelRatio())
    current.composer.setSize(size.width, size.height)
    // Bloom stays half-res; main scene remains full canvas resolution.
    current.bloom.resolution.set(
      Math.max(1, size.width * 0.5),
      Math.max(1, size.height * 0.5),
    )
  }, [get, size.height, size.width])

  useLayoutEffect(() => {
    const current = session.current
    if (!current?.shaderGrade) return
    current.shaderGrade.enabled = shaderStudy
    current.shaderGrade.uniforms.uEnabled.value = shaderStudy ? 1 : 0
  }, [shaderStudy])

  useLayoutEffect(() => {
    const current = session.current
    if (!current) return
    // Geometry Debug: strip bloom / finish grade so silhouette reads clearly.
    current.bloom.enabled = !geometryDebug
    current.finish.enabled = !geometryDebug && !softBloom
    if (current.bloom) {
      current.bloom.strength = softBloom ? 0.12 : 0.34
      current.bloom.radius = softBloom ? 0.55 : 0.42
      current.bloom.threshold = softBloom ? 0.92 : 0.8
    }
  }, [geometryDebug, softBloom])

  useFrame(({ clock }) => {
    const current = session.current
    if (!current) return
    const interior = view === 'interior' || view === 'exiting'
    if (!geometryDebug) {
      current.finish.uniforms.uTime.value = clock.elapsedTime % 100
      current.finish.uniforms.uInterior.value = THREE.MathUtils.damp(
        current.finish.uniforms.uInterior.value,
        interior ? 1 : 0,
        3,
        1 / 60,
      )
    }
    current.composer.render()
  }, 1)

  return null
}

function WorldScene({
  view,
  life,
  onStimulus,
  backgroundStudy,
  onCameraReset,
  deformAmplitudeScale = 1,
  deformFrequencyScale = 1,
  sharedTimeRef = null,
  sharedOrbitRef = null,
  resolveLifeForRender = null,
  breathAmplitude = 0.0035,
  extraRadialOffset = null,
  influenceOverlay = null,
  geometryDebug = false,
  /**
   * Optional multi-organism list for a shared Canvas (Experiment 02).
   * When null/empty, behaves as World / Exp01 single-organism scene.
   * Each entry: { id, life, onStimulus, position?, resolveLifeForRender?, ... }
   */
  organisms = null,
  orbitPivot = null,
  orbitPivotRef = null,
  orbitRadiusMin = null,
  orbitRadiusMax = null,
  autoRotate = true,
  followGrowthSiteId = null,
  followGrowthSiteIds = null,
  visibleGrowthSiteIds = null,
  showSpatialCrystals = true,
  appearancePreset = 'world',
  seamlessPageBackground = false,
  organismOverlay = null,
  followGrowthSiteMode = 'live',
  onFollowPivotSettled = null,
  exteriorControlMode = 'orbit',
  createGeometry = null,
  geometryRevision = 0,
}) {
  const multi =
    Array.isArray(organisms) && organisms.length > 0 ? organisms : null
  const organismList = multi
    ? multi
    : life
      ? [
          {
            id: `life-${life.seed}`,
            life,
            onStimulus,
            deformAmplitudeScale,
            deformFrequencyScale,
            resolveLifeForRender,
            breathAmplitude,
            extraRadialOffset,
            influenceOverlay,
            geometryDebug,
            position: [0, 0, 0],
            autoRotate,
            followGrowthSiteId,
            followGrowthSiteIds,
            visibleGrowthSiteIds,
            showSpatialCrystals,
            appearancePreset,
            organismOverlay,
            followGrowthSiteMode,
            onFollowPivotSettled,
            orbitPivotRef,
            createGeometry,
            geometryRevision,
          },
        ]
      : []

  return (
    <>
      <WorldEnvironment
        view={view}
        backgroundStudy={backgroundStudy}
        appearancePreset={appearancePreset}
        seamlessPageBackground={seamlessPageBackground}
      />
      {organismList.map((org) => {
        if (!org?.life) return null
        const orgDebug = org.geometryDebug ?? geometryDebug
        return (
          <WorldOrganism
            key={org.id ?? `life-${org.life.seed}`}
            view={view}
            life={org.life}
            onStimulus={org.onStimulus}
            deformAmplitudeScale={
              org.deformAmplitudeScale ?? deformAmplitudeScale
            }
            deformFrequencyScale={
              org.deformFrequencyScale ?? deformFrequencyScale
            }
            sharedTimeRef={sharedTimeRef}
            resolveLifeForRender={
              org.resolveLifeForRender ?? resolveLifeForRender
            }
            breathAmplitude={org.breathAmplitude ?? breathAmplitude}
            extraRadialOffset={org.extraRadialOffset ?? extraRadialOffset}
            influenceOverlay={
              orgDebug
                ? null
                : (org.influenceOverlay ?? influenceOverlay)
            }
            geometryDebug={orgDebug}
            position={org.position}
            autoRotate={org.autoRotate ?? autoRotate}
            followGrowthSiteId={org.followGrowthSiteId ?? followGrowthSiteId}
            followGrowthSiteIds={
              org.followGrowthSiteIds ?? followGrowthSiteIds
            }
            visibleGrowthSiteIds={
              org.visibleGrowthSiteIds ?? visibleGrowthSiteIds
            }
            showSpatialCrystals={
              org.showSpatialCrystals ?? showSpatialCrystals
            }
            appearancePreset={org.appearancePreset ?? appearancePreset}
            organismOverlay={org.organismOverlay ?? organismOverlay}
            followGrowthSiteMode={
              org.followGrowthSiteMode ?? followGrowthSiteMode
            }
            onFollowPivotSettled={
              org.onFollowPivotSettled ?? onFollowPivotSettled
            }
            orbitPivotRef={org.orbitPivotRef ?? orbitPivotRef}
            createGeometry={org.createGeometry ?? createGeometry}
            geometryRevision={org.geometryRevision ?? geometryRevision}
          />
        )
      })}
      <WorldFlyCamera
        view={view}
        onReset={onCameraReset}
        sharedOrbitRef={sharedOrbitRef}
        orbitPivot={orbitPivot}
        orbitPivotRef={orbitPivotRef}
        orbitRadiusMin={orbitRadiusMin}
        orbitRadiusMax={orbitRadiusMax}
        exteriorControlMode={exteriorControlMode}
      />
      <WorldPostprocessing
        view={view}
        backgroundStudy={backgroundStudy}
        geometryDebug={geometryDebug}
        appearancePreset={appearancePreset}
      />
    </>
  )
}

export { TRANSITION_DURATION }

/**
 * Shared World organism viewport (Canvas + scene + post).
 * Used by the World tab and MEMORY LAB. Does not own life state or page chrome.
 */
export function WorldViewport({
  view,
  life,
  onStimulus,
  backgroundStudy = 'dark',
  onCameraReset,
  className = 'world-v2__viewport',
  /** Optional membrane breath / bump amplitude scale (default 1 = World behavior). */
  deformAmplitudeScale = 1,
  /** Optional breath frequency + spatial sharpness scale (default 1). */
  deformFrequencyScale = 1,
  /** Shared seconds clock for dual-viewport sync (Playground compare). */
  sharedTimeRef = null,
  /** Shared exterior orbit { theta, phi, radius, revision } for A/B sync. */
  sharedOrbitRef = null,
  /** Playground: (life, elapsed) => display life with ambient / temp deform. */
  resolveLifeForRender = null,
  breathAmplitude = 0.0035,
  extraRadialOffset = null,
  influenceOverlay = null,
  /** Playground only: opaque gray geometry diagnostic (World stays styled). */
  geometryDebug = false,
  /**
   * Multi-organism shared scene (Experiment 02). When provided, `life` /
   * `onStimulus` single-organism props are ignored. One Canvas + one composer.
   */
  organisms = null,
  /** Exterior orbit look-at; default [0,0,0]. */
  orbitPivot = null,
  /** Mutable [x,y,z] live pivot (Playground growth-site follow). */
  orbitPivotRef = null,
  /** Optional exterior orbit radius clamps (defaults: 4.2 … 36). */
  orbitRadiusMin = null,
  orbitRadiusMax = null,
  /** Optional camera start position override (array). */
  cameraPosition = null,
  /** Slow exterior body spin (World / Exp01–02 default). */
  autoRotate = true,
  /** Playground: keep orbit pivot on this spatial growth site while membrane deforms. */
  followGrowthSiteId = null,
  /** Playground: locked site id list — pivot = centroid (Study 01 cluster). */
  followGrowthSiteIds = null,
  /** Playground: render only these growth site ids (null = all). */
  visibleGrowthSiteIds = null,
  /** When false, hide crystal meshes (Final Form Lab). Default true. */
  showSpatialCrystals = true,
  /** 'world' | 'final-form' — Exp05 ethereal body; default preserves World. */
  appearancePreset = 'world',
  /**
   * Exp05: transparent WebGL clear so Studies `.stage` page gradient shows.
   * Default false — World / other experiments keep opaque clear.
   */
  seamlessPageBackground = false,
  /** Playground: node or (ctx) => node inside organism group. */
  organismOverlay = null,
  /** 'live' (default) or 'once' — see WorldOrganism. */
  followGrowthSiteMode = 'live',
  onFollowPivotSettled = null,
  /**
   * Exterior controls: 'orbit' (World default), 'macro' (tilt + zoom),
   * 'observe' (zoom only), or 'inspect' (Exp03 — orbit / pan / zoom).
   */
  exteriorControlMode = 'orbit',
  /** Optional (seed) => world; Morphology Lab rest-shape injection. */
  createGeometry = null,
  geometryRevision = 0,
}) {
  const worldDpr = useWorldDpr()
  const startCamera = Array.isArray(cameraPosition)
    ? cameraPosition
    : EXTERIOR_POSITION.toArray()
  const lightClear = backgroundStudy === 'light'
  return (
    <WebGLCanvas
      className={className}
      camera={{
        position: startCamera,
        fov: 34,
        near: CAMERA_NEAR,
        far: CAMERA_FAR,
      }}
      dpr={worldDpr}
      gl={{
        antialias: true,
        alpha: seamlessPageBackground,
        powerPreference: 'default',
      }}
      onCreated={({ gl }) => {
        if (seamlessPageBackground) {
          gl.setClearColor(0x000000, 0)
          gl.toneMapping = THREE.AgXToneMapping
          gl.toneMappingExposure = 1.02
        } else {
          gl.setClearColor(lightClear ? 0xd9dee2 : 0x010405, 1)
          gl.toneMapping = THREE.AgXToneMapping
          gl.toneMappingExposure = lightClear ? 1.02 : 1.12
        }
      }}
    >
      <WorldScene
        view={view}
        life={life}
        onStimulus={onStimulus}
        backgroundStudy={backgroundStudy}
        onCameraReset={onCameraReset}
        deformAmplitudeScale={deformAmplitudeScale}
        deformFrequencyScale={deformFrequencyScale}
        sharedTimeRef={sharedTimeRef}
        sharedOrbitRef={sharedOrbitRef}
        resolveLifeForRender={resolveLifeForRender}
        breathAmplitude={breathAmplitude}
        extraRadialOffset={extraRadialOffset}
        influenceOverlay={influenceOverlay}
        geometryDebug={geometryDebug}
        organisms={organisms}
        orbitPivot={orbitPivot}
        orbitPivotRef={orbitPivotRef}
        orbitRadiusMin={orbitRadiusMin}
        orbitRadiusMax={orbitRadiusMax}
        autoRotate={autoRotate}
        followGrowthSiteId={followGrowthSiteId}
        followGrowthSiteIds={followGrowthSiteIds}
        visibleGrowthSiteIds={visibleGrowthSiteIds}
        showSpatialCrystals={showSpatialCrystals}
        appearancePreset={appearancePreset}
        seamlessPageBackground={seamlessPageBackground}
        organismOverlay={organismOverlay}
        followGrowthSiteMode={followGrowthSiteMode}
        onFollowPivotSettled={onFollowPivotSettled}
        exteriorControlMode={exteriorControlMode}
        createGeometry={createGeometry}
        geometryRevision={geometryRevision}
      />
    </WebGLCanvas>
  )
}
