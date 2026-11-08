import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { createExp05SurfaceEvaluator } from '../finalForm/exp05SurfaceEvaluator.js'
import {
  EXP05_DEFAULT_MORPHOLOGY_TYPE,
  normalizeExp05MorphologyType,
} from '../finalForm/exp05MorphologyTypes.js'
import {
  EXP05_ENV_TEMPERATURE_NEUTRAL,
  normalizeExp05Temperature,
} from '../finalForm/exp05EnvironmentCoupling.js'
import { crystalGrowth, rimeAmount, smoothstep } from './crystallization.js'

/*
 * Exp06 — crystal lattice + rime + shards seated on the Exp05 body.
 * Nucleation sites = the Life Engine's own spatial growth sites, so crystals
 * grow where this organism already grows. Positions come from the shared
 * Exp05 surface evaluator (same field as body / petals / particles).
 * Growth is driven per frame by crystalRef.current.level (0..1).
 */

const MAX_CRYSTALS = 140
const MAX_RIME = 1400
const MAX_SPARKS = 700
const RESEAT_INTERVAL = 0.25
const UP = new THREE.Vector3(0, 1, 0)

function mulberry32(seed) {
  let a = seed >>> 0 || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function norm3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

function randomDir(r) {
  const u = r() * 2 - 1
  const a = r() * Math.PI * 2
  const s = Math.sqrt(1 - u * u)
  return [s * Math.cos(a), u, s * Math.sin(a)]
}

function jitter(dir, amount, r) {
  return norm3([
    dir[0] + (r() - 0.5) * amount,
    dir[1] + (r() - 0.5) * amount,
    dir[2] + (r() - 0.5) * amount,
  ])
}

/** Static layout for one seed + set of growth sites (no surface positions yet). */
function buildPlan(seed, siteDirections) {
  const r = mulberry32((Number(seed) || 1) * 7919 + 13)
  const nuclei = siteDirections.slice(0, 10).map(norm3)
  while (nuclei.length < 6) {
    const d = randomDir(r)
    nuclei.push(norm3([d[0], d[1], d[2] + 0.45]))
  }

  const crystals = []
  for (const nucleus of nuclei) {
    const n = 4 + Math.floor(r() * 6)
    for (let j = 0; j < n && crystals.length < MAX_CRYSTALS; j++) {
      const big = j === 0 ? 1 : r()
      crystals.push({
        dir: jitter(nucleus, 0.32, r),
        tilt: [(r() - 0.5) * 1.1, (r() - 0.5) * 1.1, (r() - 0.5) * 1.1],
        spin: r() * Math.PI,
        len: 0.14 + big * big * 0.5,
        wr: 0.2 + r() * 0.12,
        th: 0.06 + r() * 0.45 + big * 0.18,
      })
    }
  }
  for (let j = 0; j < 18 && crystals.length < MAX_CRYSTALS; j++) {
    crystals.push({
      dir: randomDir(r),
      tilt: [(r() - 0.5) * 0.7, (r() - 0.5) * 0.7, (r() - 0.5) * 0.7],
      spin: r() * Math.PI,
      len: 0.07 + r() * 0.12,
      wr: 0.24 + r() * 0.1,
      th: 0.25 + r() * 0.5,
    })
  }

  const rime = []
  const euler = new THREE.Euler()
  for (let j = 0; j < MAX_RIME; j++) {
    let dir
    if (r() < 0.68) {
      const nucleus = nuclei[Math.floor(r() * nuclei.length)]
      dir = jitter(nucleus, 0.18 + r() * 0.42, r)
    } else {
      dir = randomDir(r)
    }
    euler.set(r() * 6.28, r() * 6.28, r() * 6.28)
    rime.push({
      dir,
      rot: new THREE.Quaternion().setFromEuler(euler),
      size: 0.01 + Math.pow(r(), 2.2) * 0.045,
      off: r() * 0.035,
      th: r() * 0.92,
    })
  }

  return { crystals, rime, nucleiCount: nuclei.length }
}

/** Seat every planned direction on the current body surface. */
function seatPlan(plan, evaluator, life, opts) {
  const dirs = plan.crystals.map((c) => c.dir).concat(plan.rime.map((r) => r.dir))
  const seated = evaluator.evaluateMany(dirs, life, opts)
  const nc = plan.crystals.length
  const cPos = new Float32Array(nc * 3)
  const cAxis = new Float32Array(nc * 3)
  const cQuat = []
  const rPos = new Float32Array(plan.rime.length * 3)
  const rNorm = new Float32Array(plan.rime.length * 3)
  let radiusSum = 0
  let radiusCount = 0
  const axis = new THREE.Vector3()
  const spin = new THREE.Quaternion()

  for (let i = 0; i < dirs.length; i++) {
    const s = seated[i]
    const p = s?.position ?? dirs[i]
    const n = s?.normal ? norm3(s.normal) : dirs[i]
    radiusSum += Math.hypot(p[0], p[1], p[2])
    radiusCount++
    if (i < nc) {
      const c = plan.crystals[i]
      cPos.set(p, i * 3)
      axis.set(n[0] + c.tilt[0] * 0.5, n[1] + c.tilt[1] * 0.5, n[2] + c.tilt[2] * 0.5).normalize()
      cAxis.set([axis.x, axis.y, axis.z], i * 3)
      const q = new THREE.Quaternion().setFromUnitVectors(UP, axis)
      q.premultiply(spin.setFromAxisAngle(axis, c.spin))
      cQuat.push(q)
    } else {
      const k = i - nc
      rPos.set(p, k * 3)
      rNorm.set(n, k * 3)
    }
  }
  return {
    cPos,
    cAxis,
    cQuat,
    rPos,
    rNorm,
    unit: radiusCount ? radiusSum / radiusCount : 1,
  }
}

function createCrystalGeometry() {
  const prism = new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1).toNonIndexed()
  prism.translate(0, 0.5, 0)
  const tip = new THREE.ConeGeometry(0.5, 0.5, 6, 1).toNonIndexed()
  tip.translate(0, 1.25, 0)
  const merged = mergeGeometries([prism, tip])
  merged.computeVertexNormals()
  prism.dispose()
  tip.dispose()
  return merged
}

const sparkVertex = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  uniform float uScale;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale * (14.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
    vAlpha = aAlpha;
  }
`
const sparkFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(1.0, 0.97, 0.99, a * vAlpha);
  }
`

export default function CrystalFormation({
  life,
  crystalRef,
  layers,
  moisture = 0.5,
  turbulence = 0,
  morphStrength = 1,
  deformationStrength = 1,
  lobeAmplitude = 1,
  morphologyType = EXP05_DEFAULT_MORPHOLOGY_TYPE,
  temperature = EXP05_ENV_TEMPERATURE_NEUTRAL,
  sculpturalStrength = 0,
}) {
  const { gl, size } = useThree()
  const seed = life?.seed
  const morphType = normalizeExp05MorphologyType(morphologyType)
  const tempValue = normalizeExp05Temperature(temperature)

  const evaluator = useMemo(
    () =>
      createExp05SurfaceEvaluator({
        seed,
        morphologyType: morphType,
        temperature: tempValue,
        sculpturalStrength,
      }),
    [seed, morphType, tempValue, sculpturalStrength],
  )
  useLayoutEffect(() => () => evaluator.dispose(), [evaluator])

  const sites = life?.outputs?.surface?.spatialGrowthSites
  const siteKey = (sites ?? []).map((s) => s.id).join('|')
  const plan = useMemo(
    () => buildPlan(seed, (sites ?? []).map((s) => s.direction)),
    // siteKey captures the site set; directions are stable per id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed, siteKey],
  )

  /* GPU resources — created once, disposed on unmount. */
  const envMap = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const texture = pmrem.fromScene(room, 0.03).texture
    pmrem.dispose()
    return texture
  }, [gl])
  const crystalGeometry = useMemo(createCrystalGeometry, [])
  const rimeGeometry = useMemo(() => new THREE.OctahedronGeometry(1, 0), [])
  const crystalMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#fff7fb',
        roughness: 0.04,
        metalness: 0,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        side: THREE.DoubleSide,
        iridescence: 0.85,
        iridescenceIOR: 1.45,
        iridescenceThicknessRange: [260, 640],
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        specularIntensity: 1,
        emissive: new THREE.Color('#ffd9e6'),
        emissiveIntensity: 0.06,
        envMap,
        envMapIntensity: 1.35,
        flatShading: true,
      }),
    [envMap],
  )
  const rimeMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#fff8fc',
        roughness: 0.45,
        metalness: 0,
        emissive: new THREE.Color('#ffe1ec'),
        emissiveIntensity: 0.25,
        envMap,
        envMapIntensity: 0.8,
        flatShading: true,
      }),
    [envMap],
  )
  const spark = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    const position = new Float32Array(MAX_SPARKS * 3)
    const aSize = new Float32Array(MAX_SPARKS)
    const aAlpha = new Float32Array(MAX_SPARKS)
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1))
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(aAlpha, 1))
    const material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 1 } },
      vertexShader: sparkVertex,
      fragmentShader: sparkFragment,
      transparent: true,
      depthWrite: false,
    })
    return {
      geometry,
      material,
      position,
      aSize,
      aAlpha,
      vel: new Float32Array(MAX_SPARKS * 3),
      life: new Float32Array(MAX_SPARKS),
      max: new Float32Array(MAX_SPARKS),
      type: new Uint8Array(MAX_SPARKS),
      cursor: 0,
    }
  }, [])

  useEffect(
    () => () => {
      envMap.dispose()
      crystalGeometry.dispose()
      rimeGeometry.dispose()
      crystalMaterial.dispose()
      rimeMaterial.dispose()
      spark.geometry.dispose()
      spark.material.dispose()
    },
    [envMap, crystalGeometry, rimeGeometry, crystalMaterial, rimeMaterial, spark],
  )

  useEffect(() => {
    spark.material.uniforms.uScale.value = gl.getPixelRatio() * (size.height / 900)
  }, [gl, size.height, spark])

  const crystalsRef = useRef(null)
  const rimeRef = useRef(null)
  /* Nothing visible until the first seat (instances default to identity). */
  useLayoutEffect(() => {
    if (crystalsRef.current) crystalsRef.current.count = 0
    if (rimeRef.current) rimeRef.current.count = 0
  }, [])
  const seatRef = useRef({ data: null, key: null, life: null, at: -1 })
  const scratch = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      p: new THREE.Vector3(),
      s: new THREE.Vector3(),
    }),
    [],
  )

  useFrame((state, delta) => {
    const crystals = crystalsRef.current
    const rime = rimeRef.current
    if (!crystals || !rime || !life) return
    const now = state.clock.elapsedTime
    const dt = Math.min(0.05, delta)

    /* Reseat on the body when life / field changes (throttled while playing). */
    const seat = seatRef.current
    const key = `${plan.crystals.length}|${evaluator.seed}|${morphType}|${tempValue}|${morphStrength}|${deformationStrength}|${lobeAmplitude}|${sculpturalStrength}`
    const stale = seat.key !== key || seat.life !== life
    if (!seat.data || (stale && (seat.key !== key || now - seat.at > RESEAT_INTERVAL))) {
      seat.data = seatPlan(plan, evaluator, life, {
        finiteDifferenceNormal: false,
        morphStrength,
        deformationStrength,
        lobeAmplitude,
        sculpturalStrength,
      })
      seat.key = key
      seat.life = life
      seat.at = now
    }
    const data = seat.data
    const S = data.unit
    const level = crystalRef.current?.level ?? 0
    const rate = crystalRef.current?.rate ?? 0
    const rimeLevel = rimeAmount(level, moisture)
    const { m, p, s } = scratch

    /* Crystal lattice */
    let grown = 0
    for (let i = 0; i < plan.crystals.length; i++) {
      const c = plan.crystals[i]
      const g = crystalGrowth(level, c.th)
      const j = i * 3
      if (g < 0.002) {
        s.set(0, 0, 0)
      } else {
        grown++
        const len = c.len * S * g
        const w = c.len * S * c.wr * (0.4 + 0.6 * g)
        s.set(w, len / 1.5, w)
      }
      p.set(
        data.cPos[j] - data.cAxis[j] * 0.02 * S,
        data.cPos[j + 1] - data.cAxis[j + 1] * 0.02 * S,
        data.cPos[j + 2] - data.cAxis[j + 2] * 0.02 * S,
      )
      m.compose(p, data.cQuat[i], s)
      crystals.setMatrixAt(i, m)
    }
    crystals.count = plan.crystals.length
    crystals.instanceMatrix.needsUpdate = true

    /* Rime bloom */
    for (let i = 0; i < plan.rime.length; i++) {
      const r = plan.rime[i]
      const g = smoothstep(r.th, r.th + 0.14, rimeLevel * 1.05)
      const j = i * 3
      const lift = r.off * S * g
      p.set(
        data.rPos[j] + data.rNorm[j] * lift,
        data.rPos[j + 1] + data.rNorm[j + 1] * lift,
        data.rPos[j + 2] + data.rNorm[j + 2] * lift,
      )
      const k = r.size * S * g
      s.set(k, k, k)
      m.compose(p, r.rot, s)
      rime.setMatrixAt(i, m)
    }
    rime.count = plan.rime.length
    rime.instanceMatrix.needsUpdate = true

    /* Sparks: nucleation motes drift in; shards break off crystal tips. */
    const sp = spark
    const spawn = (type, x, y, z, vx, vy, vz, lifeSec, sizePx) => {
      const i = sp.cursor
      sp.cursor = (sp.cursor + 1) % MAX_SPARKS
      sp.position.set([x, y, z], i * 3)
      sp.vel.set([vx, vy, vz], i * 3)
      sp.life[i] = lifeSec
      sp.max[i] = lifeSec
      sp.type[i] = type
      sp.aSize[i] = sizePx
      sp.aAlpha[i] = 0
    }
    if (layers?.motes !== false) {
      let n = (Math.max(0, rate) * 340 + 5 * level * moisture) * dt
      while (n > 0) {
        if (Math.random() < n) {
          const d = randomDir(Math.random)
          const R = S * (2 + Math.random() * 0.8)
          spawn(1, d[0] * R, d[1] * R, d[2] * R, -d[0] * 0.45 * S, -d[1] * 0.45 * S, -d[2] * 0.45 * S, 2.2 + Math.random(), 1.1 + Math.random() * 1.2)
        }
        n -= 1
      }
    }
    if (layers?.shards !== false && grown > 0) {
      let n = (150 * Math.max(0, turbulence - 0.12) * level + Math.max(0, -rate) * 120) * dt
      while (n > 0) {
        if (Math.random() < n) {
          const i = Math.floor(Math.random() * plan.crystals.length)
          const c = plan.crystals[i]
          const j = i * 3
          const reach = c.len * S * crystalGrowth(level, c.th) * 0.9
          const speed = (0.5 + turbulence * 1.4) * S
          spawn(
            2,
            data.cPos[j] + data.cAxis[j] * reach,
            data.cPos[j + 1] + data.cAxis[j + 1] * reach,
            data.cPos[j + 2] + data.cAxis[j + 2] * reach,
            data.cAxis[j] * speed + (Math.random() - 0.5) * speed,
            data.cAxis[j + 1] * speed + (Math.random() - 0.5) * speed,
            data.cAxis[j + 2] * speed + (Math.random() - 0.5) * speed,
            1.6 + Math.random() * 1.8,
            1.4 + Math.random() * 2.2,
          )
        }
        n -= 1
      }
    }
    for (let i = 0; i < MAX_SPARKS; i++) {
      if (sp.life[i] <= 0) {
        sp.aAlpha[i] = 0
        continue
      }
      const j = i * 3
      sp.life[i] -= dt
      if (sp.type[i] === 2) {
        const drag = 1 - 0.4 * dt
        sp.vel[j] *= drag
        sp.vel[j + 1] = sp.vel[j + 1] * drag - 0.08 * S * dt
        sp.vel[j + 2] *= drag
      }
      sp.position[j] += sp.vel[j] * dt
      sp.position[j + 1] += sp.vel[j + 1] * dt
      sp.position[j + 2] += sp.vel[j + 2] * dt
      if (sp.type[i] === 1) {
        const d = Math.hypot(sp.position[j], sp.position[j + 1], sp.position[j + 2])
        if (d < S * 1.05) sp.life[i] = 0
      }
      const k = Math.min(1, Math.max(0, sp.life[i] / sp.max[i]))
      sp.aAlpha[i] = Math.sin(Math.PI * k) * (sp.type[i] === 2 ? 0.95 : 0.7)
    }
    sp.geometry.attributes.position.needsUpdate = true
    sp.geometry.attributes.aSize.needsUpdate = true
    sp.geometry.attributes.aAlpha.needsUpdate = true
  })

  return (
    <group>
      {/* Lights only reach the crystal / rime standard materials; the Exp05
          body + petals are unlit ShaderMaterials. */}
      <hemisphereLight args={['#f7f0fb', '#b8b2cc', 0.9]} />
      <directionalLight position={[3, 5, 4]} intensity={1.5} />
      <directionalLight position={[-4, 1.5, -3]} intensity={0.8} color="#d6e4ff" />
      <instancedMesh
        ref={crystalsRef}
        args={[crystalGeometry, crystalMaterial, MAX_CRYSTALS]}
        frustumCulled={false}
        dispose={null}
        visible={layers?.crystal !== false}
        renderOrder={4}
      />
      <instancedMesh
        ref={rimeRef}
        args={[rimeGeometry, rimeMaterial, MAX_RIME]}
        frustumCulled={false}
        dispose={null}
        visible={layers?.rime !== false}
        renderOrder={3}
      />
      <points
        geometry={spark.geometry}
        material={spark.material}
        frustumCulled={false}
        dispose={null}
        renderOrder={5}
      />
    </group>
  )
}
