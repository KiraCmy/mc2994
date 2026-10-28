/**
 * Experiment 04 — Population scene: several Exp05 organisms floating in one
 * medium. World placement comes from populationSim (read every frame from a
 * ref); each organism renders with its own AGE.
 *
 * Nurture exchange is drawn with the same visual vocabulary as the organism
 * particle field: soft white motes streaming from a mature body to a young one.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import WebGLCanvas from '../../WebGLCanvas.jsx'
import { resolveRenderDpr, STUDIES_MAX_PIXELS } from '../../renderBudget.js'
import PopulationOrganism from './PopulationOrganism.jsx'
import { EXP05_LAB_DEFAULTS } from './exp05LabParams.js'
import { radiusForAge, scaleForAge, STAGE } from './populationSim.js'

/** Particle density (0..1 lab scale) per stage — level of detail. */
const STAGE_PARTICLE_DENSITY = {
  [STAGE.BUD]: 0.035,
  [STAGE.YOUNG]: 0.06,
  [STAGE.MATURE]: 0.12,
  [STAGE.OLD]: 0.08,
}

/* Visual dissolve right before re-birth (sim end-of-life = 0.965). */
function dissolveFactor(age) {
  const t = Math.min(1, Math.max(0, (age - 0.925) / 0.04))
  return 1 - t * t * (3 - 2 * t)
}

function useStudiesDpr(maxPixels = STUDIES_MAX_PIXELS) {
  const [dpr, setDpr] = useState(() =>
    typeof window === 'undefined'
      ? 1
      : resolveRenderDpr(
          window.innerWidth,
          window.innerHeight,
          window.devicePixelRatio,
          maxPixels,
        ),
  )
  useEffect(() => {
    const update = () =>
      setDpr(
        resolveRenderDpr(
          window.innerWidth,
          window.innerHeight,
          window.devicePixelRatio,
          maxPixels,
        ),
      )
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [maxPixels])
  return dpr
}

function NoToneMappingStage() {
  useFrame(({ gl }) => {
    gl.toneMapping = THREE.NoToneMapping
    gl.setClearColor(0x000000, 0)
  })
  return null
}

/**
 * Places every organism group from the live sim each frame:
 * float bob, slow spin, AGE-driven scale (eased), dissolve / re-birth grow-in.
 */
function PopulationMotion({ popRef, groupsRef, scaleRef }) {
  const displayRef = useRef(new Map())
  useFrame(({ clock }, delta) => {
    const pop = popRef.current
    if (!pop) return
    const t = clock.getElapsedTime()
    const k = 1 - Math.exp(-Math.min(0.1, delta) * 2.2)
    for (const org of pop.organisms) {
      const group = groupsRef.current.get(org.id)
      if (!group) continue
      let disp = displayRef.current.get(org.id)
      if (!disp || disp.generation !== org.generation) {
        /* (Re)birth: snap to the new seat, grow in from nothing. */
        disp = { generation: org.generation, scale: disp ? 0 : scaleForAge(org.age) }
        displayRef.current.set(org.id, disp)
      }
      const target = scaleForAge(org.age) * dissolveFactor(org.age)
      disp.scale += (target - disp.scale) * k
      const turb = pop.environment?.turbulence ?? 0
      const bob =
        Math.sin(t * (0.38 + turb * 0.5) + org.phase) * (0.12 + turb * 0.22)
      group.position.set(org.position[0], org.position[1] + bob, org.position[2])
      group.rotation.set(
        Math.sin(t * 0.17 + org.phase) * 0.08,
        org.spin,
        Math.cos(t * 0.13 + org.phase) * 0.06,
      )
      group.scale.setScalar(Math.max(0.0001, disp.scale))
      group.visible = disp.scale > 0.01
      if (scaleRef) scaleRef.current.set(org.id, disp.scale)
    }
  })
  return null
}

const STREAM_MOTES = 64
const STREAM_CAPACITY = 7 * 6 * STREAM_MOTES
/*
 * Stream tint: the membrane rim's cool cyan → petal lavender. White motes
 * vanished against the light page; these keep the organism palette but read.
 */
const STREAM_HEAD = new THREE.Color('#6fd3f2')
const STREAM_TAIL = new THREE.Color('#b9a2f0')

const streamVertex = /* glsl */ `
  attribute float aAlpha;
  attribute float aSize;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  uniform float uPixelRatio;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio * (12.0 / max(0.5, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`
const streamFragment = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float core = smoothstep(0.22, 0.0, d);
    float halo = smoothstep(0.5, 0.0, d);
    /* Bright white core inside a tinted halo — reads on the light page. */
    vec3 col = mix(vColor, vec3(1.0), core * 0.75);
    gl_FragColor = vec4(col, (halo * halo * 0.85 + core * 0.4) * vAlpha);
  }
`

/** Soft particle streams for active nurture exchanges (giver → young). */
function NurtureStreams({ popRef, visible = true }) {
  const { geometry, material } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STREAM_CAPACITY * 3), 3))
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(STREAM_CAPACITY), 1))
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(STREAM_CAPACITY), 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(STREAM_CAPACITY * 3), 3))
    g.setDrawRange(0, 0)
    const m = new THREE.ShaderMaterial({
      vertexShader: streamVertex,
      fragmentShader: streamFragment,
      uniforms: { uPixelRatio: { value: 1 } },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
    return { geometry: g, material: m }
  }, [])
  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  const _a = useMemo(() => new THREE.Vector3(), [])
  const _b = useMemo(() => new THREE.Vector3(), [])
  const _m = useMemo(() => new THREE.Vector3(), [])
  const _p = useMemo(() => new THREE.Vector3(), [])
  /* Eased per-pair intensity so streams fade in / out instead of popping. */
  const pairRef = useRef(new Map())

  useFrame(({ clock, gl }, delta) => {
    material.uniforms.uPixelRatio.value = gl.getPixelRatio()
    const pop = popRef.current
    const pos = geometry.attributes.position.array
    const alpha = geometry.attributes.aAlpha.array
    const size = geometry.attributes.aSize.array
    const color = geometry.attributes.aColor.array
    if (!pop || !visible) {
      geometry.setDrawRange(0, 0)
      return
    }
    const byId = new Map(pop.organisms.map((o) => [o.id, o]))
    const live = new Map()
    for (const e of pop.exchanges) live.set(`${e.from}>${e.to}`, e.amount)
    const k = 1 - Math.exp(-Math.min(0.1, delta) * 3)
    for (const key of new Set([...pairRef.current.keys(), ...live.keys()])) {
      const prev = pairRef.current.get(key) || 0
      const next = prev + ((live.get(key) || 0) - prev) * k
      if (next < 0.003 && !live.has(key)) pairRef.current.delete(key)
      else pairRef.current.set(key, next)
    }

    const t = clock.getElapsedTime()
    let n = 0
    for (const [key, amount] of pairRef.current) {
      const [fromId, toId] = key.split('>')
      const from = byId.get(fromId)
      const to = byId.get(toId)
      if (!from || !to) continue
      _a.fromArray(from.position)
      _b.fromArray(to.position)
      const dir = _b.clone().sub(_a)
      const dist = dir.length() || 1
      dir.multiplyScalar(1 / dist)
      /* Leave the giver's surface, arrive at the young body's surface. */
      _a.addScaledVector(dir, radiusForAge(from.age) * 0.92)
      _b.addScaledVector(dir, -radiusForAge(to.age) * 0.85)
      _m.copy(_a).add(_b).multiplyScalar(0.5)
      _m.y += 0.25 + dist * 0.12
      const hash = (fromId.charCodeAt(1) * 7 + toId.charCodeAt(1) * 13) % 97
      for (let i = 0; i < STREAM_MOTES && n < STREAM_CAPACITY; i += 1) {
        const phase = (i / STREAM_MOTES + t * 0.16 + hash * 0.013) % 1
        const u = phase
        const iu = 1 - u
        /* Quadratic Bézier + small lateral wobble. */
        _p.set(
          iu * iu * _a.x + 2 * iu * u * _m.x + u * u * _b.x,
          iu * iu * _a.y + 2 * iu * u * _m.y + u * u * _b.y,
          iu * iu * _a.z + 2 * iu * u * _m.z + u * u * _b.z,
        )
        /* Braided ribbon: motes spiral around the path, widest mid-way. */
        const swirl = Math.sin(Math.PI * u) * 0.16
        const ang = t * 1.6 + i * 2.4 + hash
        _p.x += Math.cos(ang) * swirl
        _p.y += Math.sin(ang * 0.8) * swirl * 0.6
        _p.z += Math.sin(ang) * swirl
        pos[n * 3] = _p.x
        pos[n * 3 + 1] = _p.y
        pos[n * 3 + 2] = _p.z
        /* Fade at both ends; brighter with stronger nurture. */
        const ends = Math.min(1, Math.sin(Math.PI * u) * 1.6)
        /* Floor keeps even weak nurture legible; strong flows saturate. */
        const strength = Math.min(1, 0.45 + amount * 1.6)
        alpha[n] = strength * ends
        size[n] = 3.2 + amount * 4.5 + ((i * 37) % 10) * 0.12
        const c = STREAM_HEAD.clone().lerp(STREAM_TAIL, u)
        color[n * 3] = c.r
        color[n * 3 + 1] = c.g
        color[n * 3 + 2] = c.b
        n += 1
      }
    }
    geometry.setDrawRange(0, n)
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.aAlpha.needsUpdate = true
    geometry.attributes.aSize.needsUpdate = true
    geometry.attributes.aColor.needsUpdate = true
  })

  return (
    <points
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={12}
    />
  )
}

const HALO_MOTES = 96

/**
 * Selection marker in the same particle vocabulary: a slow ring of motes
 * around the chosen body, always facing the camera.
 */
function SelectionHalo({ popRef, scaleRef, selectedId }) {
  const { geometry, material } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(HALO_MOTES * 3), 3))
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(HALO_MOTES), 1))
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(HALO_MOTES), 1))
    const col = new Float32Array(HALO_MOTES * 3)
    for (let i = 0; i < HALO_MOTES; i += 1) {
      const c = STREAM_HEAD.clone().lerp(STREAM_TAIL, (Math.sin(i * 0.4) + 1) / 2)
      col[i * 3] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
    }
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    const m = new THREE.ShaderMaterial({
      vertexShader: streamVertex,
      fragmentShader: streamFragment,
      uniforms: { uPixelRatio: { value: 1 } },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
    return { geometry: g, material: m }
  }, [])
  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])
  const pointsRef = useRef(null)
  const _right = useMemo(() => new THREE.Vector3(), [])
  const _up = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock, camera, gl }) => {
    material.uniforms.uPixelRatio.value = gl.getPixelRatio()
    const org = popRef.current?.organisms.find((o) => o.id === selectedId)
    if (pointsRef.current) pointsRef.current.visible = Boolean(org)
    if (!org) return
    const t = clock.getElapsedTime()
    _right.setFromMatrixColumn(camera.matrixWorld, 0)
    _up.setFromMatrixColumn(camera.matrixWorld, 1)
    const scale = scaleRef.current.get(org.id) ?? 1
    const r = 1.4 * scale * 1.32
    const bob =
      Math.sin(t * (0.38 + (popRef.current.environment?.turbulence ?? 0) * 0.5) + org.phase) *
      (0.12 + (popRef.current.environment?.turbulence ?? 0) * 0.22)
    const pos = geometry.attributes.position.array
    const alpha = geometry.attributes.aAlpha.array
    const size = geometry.attributes.aSize.array
    for (let i = 0; i < HALO_MOTES; i += 1) {
      const a = (i / HALO_MOTES) * Math.PI * 2 + t * 0.25
      const wob = 1 + Math.sin(a * 5 + t * 1.2) * 0.025
      const x = Math.cos(a) * r * wob
      const y = Math.sin(a) * r * wob
      pos[i * 3] = org.position[0] + _right.x * x + _up.x * y
      pos[i * 3 + 1] = org.position[1] + bob + _right.y * x + _up.y * y
      pos[i * 3 + 2] = org.position[2] + _right.z * x + _up.z * y
      alpha[i] = 0.55 + 0.35 * Math.sin(a * 3 - t * 2)
      size[i] = 2.6
    }
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.aAlpha.needsUpdate = true
    geometry.attributes.aSize.needsUpdate = true
  })

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={13}
    />
  )
}

/**
 * @param {{
 *   popRef: { current: object },
 *   snapshot: object,
 *   lives: Record<string, object>,
 *   contactLives?: Record<string, object>,
 *   showStreams?: boolean,
 *   className?: string,
 * }} props
 */
export default function PopulationScene({
  popRef,
  snapshot,
  lives,
  contactLives = null,
  showStreams = true,
  temperature = 0.5,
  selectedId = null,
  onSelect = null,
  className = 'exp05-viewport',
}) {
  const dpr = useStudiesDpr()
  const groupsRef = useRef(new Map())
  const scaleRef = useRef(new Map())
  const lab = EXP05_LAB_DEFAULTS

  return (
    <WebGLCanvas
      className={className}
      camera={{ position: [0, 2.6, 23], fov: 30, near: 0.1, far: 400 }}
      dpr={dpr}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0)
        gl.toneMapping = THREE.NoToneMapping
      }}
    >
      <NoToneMappingStage />
      <PopulationMotion
        popRef={popRef}
        groupsRef={groupsRef}
        scaleRef={scaleRef}
      />
      {snapshot.organisms.map((org) => (
        <group
          key={org.id}
          ref={(node) => {
            if (node) groupsRef.current.set(org.id, node)
            else groupsRef.current.delete(org.id)
          }}
          onClick={(event) => {
            /* Ignore orbit drags; nearest body wins. */
            if (!onSelect || event.delta > 6) return
            event.stopPropagation()
            onSelect(org.id)
          }}
        >
          <PopulationOrganism
            life={lives[org.id]}
            contactLife={contactLives?.[org.id] ?? null}
            morphologyType={org.morphologyType}
            lobeAmplitude={org.lobe}
            sculpturalStrength={org.sculpt}
            particleDensity={STAGE_PARTICLE_DENSITY[org.stage] ?? 0.06}
            petalDensity={lab.petalDensity}
            petalScale={lab.petalScale}
            particleMotion={lab.particleMotion}
            materialMode={lab.materialMode}
            temperature={temperature}
          />
        </group>
      ))}
      <NurtureStreams popRef={popRef} visible={showStreams} />
      <SelectionHalo
        popRef={popRef}
        scaleRef={scaleRef}
        selectedId={selectedId}
      />
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        autoRotate
        autoRotateSpeed={0.12}
        dampingFactor={0.06}
        minDistance={8}
        maxDistance={42}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI - 0.35}
      />
    </WebGLCanvas>
  )
}
