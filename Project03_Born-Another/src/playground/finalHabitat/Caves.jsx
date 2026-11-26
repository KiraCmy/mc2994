import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { cavePose, centreDistance, remainNiches, underworldDepth } from './caves.js'
import { habitatSurfaceHeight, holeShape, UNDERWORLD, underworldFloor } from './habitatField.js'
import { createCaveResources } from './caveGeometry.js'
import { cutOutPixels } from './snapshotCutout.js'

const CAVE_FOG = new THREE.Color('#1c1924')
const MAX_REMAINS = 40
const NEAR = 6
const _c = new THREE.Vector3()
const _e = new THREE.Vector3()
const _right = new THREE.Vector3()

/** `?cave=hole` (at the rim) or `?cave=inside` (below): start exploring there. */
function requestedPose() {
  if (typeof window === 'undefined') return null
  const id = new URLSearchParams(window.location.search).get('cave')
  return id ? cavePose(id) : null
}

/** Soft glow for remains kept without a picture. */
function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62)
  grad.addColorStop(0, 'rgba(240,230,255,0.95)')
  grad.addColorStop(0.35, 'rgba(214,196,240,0.55)')
  grad.addColorStop(1, 'rgba(214,196,240,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Thin streams of sand slipping over the lip and down into the cavern. */
const FALL_ANGLES = [0.5, 2.15, 3.4, 5.0]
const FALL_GRAINS = 260

function createSandFall() {
  const { hole } = UNDERWORLD
  const n = FALL_ANGLES.length * FALL_GRAINS
  const start = new Float32Array(n * 3)
  const seed = new Float32Array(n * 3)
  let v = 0
  for (const a of FALL_ANGLES) {
    const { inner, lip } = holeShape(a)
    const x = hole.x + Math.cos(a) * (inner - 1.1)
    const z = hole.z + Math.sin(a) * (inner - 1.1)
    const top = habitatSurfaceHeight(hole.x + Math.cos(a) * lip, hole.z + Math.sin(a) * lip) - 0.6
    const fall = top - underworldFloor(x, z)
    for (let i = 0; i < FALL_GRAINS; i++, v++) {
      start[v * 3] = x
      start[v * 3 + 1] = top
      start[v * 3 + 2] = z
      seed[v * 3] = Math.random()
      seed[v * 3 + 1] = Math.random() * Math.PI * 2
      seed[v * 3 + 2] = fall
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(start, 3))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3))
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(hole.x, start[1] - 6, hole.z), 14)
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#e7def0') } },
    transparent: true,
    depthWrite: false,
    vertexShader: `
      attribute vec3 aSeed;
      uniform float uTime;
      varying float vAlpha;
      void main() {
        float f = fract(uTime * 0.16 + aSeed.x);
        vec3 p = position;
        float spread = 0.05 + f * 0.45;
        p.x += cos(aSeed.y) * spread * fract(aSeed.x * 7.3);
        p.z += sin(aSeed.y) * spread * fract(aSeed.x * 7.3);
        p.y -= f * f * aSeed.z;
        vAlpha = smoothstep(0.0, 0.06, f) * (1.0 - smoothstep(0.82, 1.0, f));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(55.0 / -mv.z, 1.0, 4.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        if (r > 0.5) discard;
        gl_FragColor = vec4(uColor, vAlpha * 0.6 * (1.0 - r * 1.6));
      }`,
  })
  return { geometry, material }
}

function SandFall() {
  const res = useMemo(() => createSandFall(), [])
  useEffect(() => () => {
    res.geometry.dispose()
    res.material.dispose()
  }, [res])
  useFrame((state) => {
    res.material.uniforms.uTime.value = state.clock.elapsedTime
  })
  return <points geometry={res.geometry} material={res.material} frustumCulled />
}

/**
 * Light spilling up out of the hole. One place to tune it:
 * intensity — brightness of the white spill
 * height — how far the faint tail rises, in world units
 * pulsePeriod — seconds for one breath (about 4–6)
 * pulseAmount — how much the breath moves the brightness (0–1)
 * A soft pool on the lip, plus a few standing sheets whose brightness
 * is a falloff — brightest in the throat, gone at the edges and the top.
 * Mostly white; tint is only a faint colour in the mouth.
 */
const HOLE_GLOW = Object.freeze({
  intensity: 0.85,
  height: 18,
  pulsePeriod: 5.2,
  pulseAmount: 0.06,
  white: '#fffaf6',
  tint: '#f4f1f8',
  motes: 8,
})

function createHoleGlow() {
  const { hole } = UNDERWORLD
  const g = HOLE_GLOW
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const SEG = 80
  let lipSum = 0
  let ySum = 0
  for (let j = 0; j < SEG; j++) {
    const a = (j / SEG) * Math.PI * 2
    const { lip } = holeShape(a)
    lipSum += lip
    ySum += habitatSurfaceHeight(hole.x + Math.cos(a) * lip, hole.z + Math.sin(a) * lip)
  }
  const lipR = lipSum / SEG
  const yRim = ySum / SEG
  /* The bright part sits in the mouth. Above the rim it is only a tail. */
  const yMouth = yRim - 1.15
  const uniforms = {
    uTime: { value: 0 },
    uIntensity: { value: g.intensity },
    uPeriod: { value: g.pulsePeriod },
    uPulse: { value: reduce ? 0 : g.pulseAmount },
    uWhite: { value: new THREE.Color(g.white) },
    uTint: { value: new THREE.Color(g.tint) },
    uCenter: { value: new THREE.Vector3(hole.x, yMouth, hole.z) },
    uLip: { value: lipR },
  }
  /* Pool on the opening. The rim vertices are the lip, and the light
     is already gone there, so the glow sits in the hole rather than
     drawing a circle on the sand. */
  const discPos = new Float32Array((SEG + 1) * 3)
  const discRadial = new Float32Array(SEG + 1)
  discPos[0] = hole.x
  discPos[1] = yMouth
  discPos[2] = hole.z
  for (let j = 0; j < SEG; j++) {
    const a = (j / SEG) * Math.PI * 2
    const { lip } = holeShape(a)
    const x = hole.x + Math.cos(a) * lip
    const z = hole.z + Math.sin(a) * lip
    const v = j + 1
    discPos[v * 3] = x
    discPos[v * 3 + 1] = habitatSurfaceHeight(x, z) + 0.14
    discPos[v * 3 + 2] = z
    discRadial[v] = 1
  }
  const discIndex = []
  for (let j = 0; j < SEG; j++) discIndex.push(0, j + 1, ((j + 1) % SEG) + 1)
  const disc = new THREE.BufferGeometry()
  disc.setAttribute('position', new THREE.BufferAttribute(discPos, 3))
  disc.setAttribute('aRadial', new THREE.BufferAttribute(discRadial, 1))
  disc.setIndex(discIndex)
  disc.computeBoundingSphere()
  const discMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aRadial;
      uniform vec3 uCenter;
      varying float vRadial;
      varying float vSteep;
      void main() {
        vRadial = aRadial;
        vSteep = abs(normalize(cameraPosition - uCenter).y);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform float uIntensity;
      uniform float uPeriod;
      uniform float uPulse;
      uniform vec3 uWhite;
      uniform vec3 uTint;
      varying float vRadial;
      varying float vSteep;
      void main() {
        float across = exp(-vRadial * vRadial * 2.8);
        float face = smoothstep(0.22, 0.7, vSteep);
        float pulse = 1.0 + uPulse * sin(uTime * 6.2831853 / max(uPeriod, 0.01));
        float alpha = across * face * uIntensity * pulse * 0.55;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(mix(uWhite, uTint, 0.18) * alpha, alpha);
      }`,
  })
  /* Sheets standing in the air, crossing at the hole's centre. The mesh
     only holds the falloff: bright on the axis, already gone at the lip,
     and thinning as it rises. Nothing here has a hard edge. */
  const PLANES = 2
  const ROWS = 10
  const COLS = 9
  const count = PLANES * ROWS * COLS
  const billPos = new Float32Array(count * 3)
  const billNrm = new Float32Array(count * 3)
  const billUp = new Float32Array(count)
  const billIndex = []
  for (let p = 0; p < PLANES; p++) {
    const a = (p / PLANES) * Math.PI
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const lipA = holeShape(a).lip
    const lipB = holeShape(a + Math.PI).lip
    const nx = -sa
    const nz = ca
    const base = p * ROWS * COLS
    for (let row = 0; row < ROWS; row++) {
      const t = row / (ROWS - 1)
      const spread = 1.2 + t * 0.2
      const y = yRim - 2.4 + g.height * t
      for (let col = 0; col < COLS; col++) {
        const s = (col / (COLS - 1)) * 2 - 1
        const lipSide = s >= 0 ? lipA : lipB
        const rad = Math.abs(s) * lipSide * spread
        const dir = s >= 0 ? 1 : -1
        const v = base + row * COLS + col
        billPos[v * 3] = hole.x + dir * ca * rad
        billPos[v * 3 + 1] = y
        billPos[v * 3 + 2] = hole.z + dir * sa * rad
        billNrm[v * 3] = nx
        billNrm[v * 3 + 1] = 0
        billNrm[v * 3 + 2] = nz
        billUp[v] = t
      }
    }
    for (let row = 0; row < ROWS - 1; row++) {
      for (let col = 0; col < COLS - 1; col++) {
        const a0 = base + row * COLS + col
        const a1 = a0 + 1
        const b0 = a0 + COLS
        const b1 = b0 + 1
        billIndex.push(a0, b0, a1, a1, b0, b1)
      }
    }
  }
  const bill = new THREE.BufferGeometry()
  bill.setAttribute('position', new THREE.BufferAttribute(billPos, 3))
  bill.setAttribute('normal', new THREE.BufferAttribute(billNrm, 3))
  bill.setAttribute('aUp', new THREE.BufferAttribute(billUp, 1))
  bill.setIndex(billIndex)
  bill.computeBoundingSphere()
  const billMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aUp;
      varying float vUp;
      varying float vFace;
      varying float vDist;
      uniform vec3 uCenter;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vec3 n = normalize(mat3(modelMatrix) * normal);
        vFace = abs(dot(n, normalize(cameraPosition - world.xyz)));
        vUp = aUp;
        vDist = length(world.xz - uCenter.xz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform float uIntensity;
      uniform float uPeriod;
      uniform float uPulse;
      uniform float uLip;
      uniform vec3 uWhite;
      uniform vec3 uTint;
      varying float vUp;
      varying float vFace;
      varying float vDist;
      void main() {
        float r = vDist / max(uLip, 0.001);
        float across = exp(-r * r * 8.0);
        float rise = exp(-vUp * 1.7) * (1.0 - smoothstep(0.4, 0.92, vUp));
        float face = smoothstep(0.08, 0.5, vFace);
        float pulse = 1.0 + uPulse * sin(uTime * 6.2831853 / max(uPeriod, 0.01));
        float alpha = across * rise * face * uIntensity * pulse * 0.7;
        if (alpha < 0.02) discard;
        vec3 col = mix(uWhite, uTint, (1.0 - smoothstep(0.0, 0.4, vUp)) * 0.1);
        gl_FragColor = vec4(col * alpha, alpha);
      }`,
  })
  /* A few specks drifting in the spill. Too small to draw a shape. */
  const n = g.motes
  const start = new Float32Array(n * 3)
  const seeds = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const a = i * 2.399 + 0.4
    const rad = lipR * (0.08 + (i % 5) * 0.07)
    start[i * 3] = hole.x + Math.cos(a) * rad
    start[i * 3 + 1] = yMouth + (i % 6) * 0.7
    start[i * 3 + 2] = hole.z + Math.sin(a) * rad
    seeds[i * 3] = (i * 0.37) % 1
    seeds[i * 3 + 1] = 0.55 + (i % 4) * 0.12
    seeds[i * 3 + 2] = a
  }
  const motes = new THREE.BufferGeometry()
  motes.setAttribute('position', new THREE.BufferAttribute(start, 3))
  motes.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3))
  const moteMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 aSeed;
      uniform float uTime;
      varying float vA;
      void main() {
        float f = fract(uTime * 0.045 * aSeed.y + aSeed.x);
        vec3 p = position;
        p.y += f * 7.0;
        p.x += sin(uTime * 0.2 + aSeed.z) * 0.12;
        p.z += cos(uTime * 0.16 + aSeed.z) * 0.12;
        vA = smoothstep(0.0, 0.16, f) * (1.0 - smoothstep(0.72, 1.0, f));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(64.0 / -mv.z, 1.0, 2.6);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uWhite;
      uniform float uIntensity;
      varying float vA;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        if (r > 0.5) discard;
        float a = vA * (1.0 - r * 2.0) * uIntensity * 0.35;
        gl_FragColor = vec4(uWhite * a, a);
      }`,
  })
  const group = new THREE.Group()
  const discMesh = new THREE.Mesh(disc, discMat)
  discMesh.frustumCulled = false
  discMesh.renderOrder = 3
  const billMesh = new THREE.Mesh(bill, billMat)
  billMesh.frustumCulled = false
  billMesh.renderOrder = 3
  const motePoints = new THREE.Points(motes, moteMat)
  motePoints.frustumCulled = false
  motePoints.renderOrder = 3
  group.add(discMesh, billMesh, motePoints)
  return {
    group,
    uniforms,
    dispose() {
      for (const d of [disc, discMat, bill, billMat, motes, moteMat]) d.dispose()
    },
  }
}

function HoleGlow() {
  const res = useMemo(() => createHoleGlow(), [HOLE_GLOW])
  useEffect(() => () => res.dispose(), [res])
  const { hole } = UNDERWORLD
  useFrame((state) => {
    const cam = state.camera.position
    const below = cam.y < habitatSurfaceHeight(cam.x, cam.z) - 1.4
    const inMouth = Math.hypot(cam.x - hole.x, cam.z - hole.z) < hole.r + 4
    /* Full spill on the dunes. Quieter once you are down in the mouth. */
    res.uniforms.uIntensity.value = HOLE_GLOW.intensity * (below && inMouth ? 0.4 : 1)
    res.uniforms.uTime.value = state.clock.elapsedTime
  })
  return <primitive object={res.group} dispose={null} />
}

/** Picture of kept remains → transparent outside the body, soft round edge. */
function cutOutRemains(img) {
  const size = 256
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')
  g.drawImage(img, 0, 0, size, size)
  const px = g.getImageData(0, 0, size, size)
  const d = px.data
  /* Opaque corners: an old square snapshot — lift the body out of it. */
  const corner = (d[3] + d[(size - 1) * 4 + 3] + d[(size * (size - 1)) * 4 + 3] + d[(size * size - 1) * 4 + 3]) / 4
  if (corner > 200) cutOutPixels(d, size)
  /* Round falloff over everything: the frame's edge can never show. */
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) / (size / 2)
      const t = Math.min(1, Math.max(0, (r - 0.62) / (0.96 - 0.62)))
      const k = 1 - t * t * (3 - 2 * t)
      d[(y * size + x) * 4 + 3] *= k
    }
  }
  g.putImageData(px, 0, 0)
  return c
}

function lastWords(entry) {
  const w = entry?.words ?? []
  return w.length ? w[w.length - 1].text : null
}

/**
 * The lives the viewer kept, resting in the dark: each its remains as they
 * were saved (the cut-out picture), faintly lit, the newest near the light
 * of the opening, the oldest deepest in. Near one, its name and the last
 * thing it was told appear, with a way to its archive card.
 */
function KeptRemains({ entries }) {
  const camera = useThree((s) => s.camera)
  const shown = useMemo(() => entries.slice(0, MAX_REMAINS), [entries])
  const niches = useMemo(() => remainNiches(shown.length), [shown.length])
  const glow = useMemo(() => glowTexture(), [])
  /* Each kept picture is lifted out of its square: the body's own outline
     (cut-out), then a soft round fade so no frame edge can show. */
  const textures = useMemo(
    () =>
      shown.map((e) => {
        if (!e.image) return null
        const t = new THREE.CanvasTexture(document.createElement('canvas'))
        t.colorSpace = THREE.SRGBColorSpace
        const img = new Image()
        img.onload = () => {
          t.image = cutOutRemains(img)
          t.needsUpdate = true
        }
        img.src = e.image
        return t
      }),
    [shown],
  )
  useEffect(() => () => textures.forEach((t) => t?.dispose()), [textures])
  useEffect(() => () => glow.dispose(), [glow])

  const refs = useRef([])
  const tagRef = useRef(null)
  const [near, setNear] = useState(-1)
  useFrame((state) => {
    let best = -1
    let bestD = NEAR
    const t = state.clock.elapsedTime
    niches.forEach((p, i) => {
      const g = refs.current[i]
      if (!g) return
      g.quaternion.copy(camera.quaternion)
      g.position.set(p[0], p[1] + Math.sin(t * 0.6 + i) * 0.08, p[2])
      const d = camera.position.distanceTo(g.position)
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    if (best !== near) setNear(best)
    /* The tag's leader starts at the edge of the remains: its on-screen radius. */
    const g = best >= 0 ? refs.current[best] : null
    if (g && tagRef.current) {
      _right.setFromMatrixColumn(camera.matrixWorld, 0)
      _c.copy(g.position).project(camera)
      _e.copy(g.position).addScaledVector(_right, 0.8).project(camera)
      const px = Math.abs(_e.x - _c.x) * state.size.width * 0.5
      tagRef.current.style.setProperty('--r', `${Math.min(220, px).toFixed(1)}px`)
    }
  })

  /* Same tab: the world stays as it is while the archive is open. */
  const open = (entry) => {
    window.location.hash = `#archive/${encodeURIComponent(entry.key)}`
  }

  return (
    <group>
      {niches.map((p, i) => {
        const entry = shown[i]
        return (
          <group key={entry.key} ref={(el) => (refs.current[i] = el)} position={p}>
            <mesh renderOrder={5}>
              <planeGeometry args={[3.4, 3.4]} />
              <meshBasicMaterial map={glow} color="#c7b6ee" transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
            </mesh>
            <mesh renderOrder={6} onClick={(ev) => { ev.stopPropagation(); open(entry) }}>
              <planeGeometry args={[1.9, 1.9]} />
              <meshBasicMaterial map={textures[i] ?? glow} transparent depthWrite={false} toneMapped={false} opacity={1} />
            </mesh>
          </group>
        )
      })}
      {near >= 0 && shown[near] ? (
        <Html position={niches[near]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          {/* A leader drawn out from the remains, then a small white-ruled tag. */}
          <div className="exp07-tag" ref={tagRef} key={shown[near].key}>
            <span className="exp07-tag__dot" />
            <span className="exp07-tag__lead" />
            <span className="exp07-tag__run" />
            <a className="exp07-tag__box" href={`#archive/${encodeURIComponent(shown[near].key)}`}>
              <span className="exp07-tag__name">{shown[near].name}</span>
              <span className="exp07-tag__words">{lastWords(shown[near]) ? `“${lastWords(shown[near])}”` : 'no words'}</span>
              <span className="exp07-tag__link">Archive ↗</span>
            </a>
          </div>
        </Html>
      ) : null}
    </group>
  )
}

/* ---------------- way back up ---------------- */

const LOOK_UP = 0.3 // sin of the pitch at which "looking up" begins (~17°)
const LOOK_UP_OFF = 0.18 // hysteresis: hide again a little lower
const RISE_SECONDS = 3.2

/** Where you come out: on the sand at the rim, facing the clearing. */
function surfacePose() {
  const { hole } = UNDERWORLD
  const toward = Math.atan2(-hole.z, -hole.x)
  const x = hole.x + Math.cos(toward) * (hole.r + 7)
  const z = hole.z + Math.sin(toward) * (hole.r + 7)
  const tx = hole.x + Math.cos(toward) * (hole.r + 22)
  const tz = hole.z + Math.sin(toward) * (hole.r + 22)
  return {
    position: new THREE.Vector3(x, habitatSurfaceHeight(x, z) + 3.2, z),
    target: new THREE.Vector3(tx, habitatSurfaceHeight(tx, tz) + 2.4, tz),
  }
}

/** Below the sand, inside the cavern's reach. */
function underground(p) {
  return centreDistance(p.x, p.z) < UNDERWORLD.radius && p.y < habitatSurfaceHeight(p.x, p.z) - 0.8
}

/**
 * In the cavern, looking up: a small white hint at the top of the screen.
 * Clicking it carries the camera to the opening, up through it, and out
 * onto the sand at the rim, facing the clearing — no feeling around for
 * the hole in the dark.
 */
function SurfaceReturn({ world = null }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const gl = useThree((s) => s.gl)
  const rise = useRef(null)
  const shown = useRef(false)
  const hintRef = useRef(null)
  const startRef = useRef(() => {})
  const dir = useMemo(() => new THREE.Vector3(), [])
  const look = useMemo(() => new THREE.Vector3(), [])

  /* A plain DOM hint beside the canvas (no extra React root to unmount). */
  useEffect(() => {
    const host = gl.domElement.parentElement
    if (!host) return undefined
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'exp07-ascend'
    btn.tabIndex = -1
    btn.setAttribute('aria-hidden', 'true')
    btn.innerHTML = '<span class="exp07-ascend__arrow" aria-hidden="true"></span>Back to the surface'
    btn.addEventListener('click', () => startRef.current())
    host.appendChild(btn)
    hintRef.current = btn
    return () => {
      btn.remove()
      hintRef.current = null
    }
  }, [gl])

  const setShown = (v) => {
    shown.current = v
    const el = hintRef.current
    if (!el) return
    el.classList.toggle('is-shown', v)
    el.tabIndex = v ? 0 : -1
    el.setAttribute('aria-hidden', v ? 'false' : 'true')
  }

  startRef.current = () => {
    if (rise.current) return
    const { hole } = UNDERWORLD
    const end = surfacePose()
    const below = new THREE.Vector3(hole.x, underworldFloor(hole.x, hole.z) + 2.2, hole.z)
    const above = new THREE.Vector3(hole.x, habitatSurfaceHeight(hole.x, hole.z) + 4.5, hole.z)
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    setShown(false)
    if (reduce) {
      camera.position.copy(end.position)
      controls?.target?.copy(end.target)
      camera.lookAt(end.target)
      controls?.update?.()
      return
    }
    if (controls) controls.enabled = false
    rise.current = {
      t: 0,
      path: new THREE.CatmullRomCurve3([camera.position.clone(), below, above, end.position], false, 'centripetal'),
      from: (controls?.target ?? camera.position.clone().add(camera.getWorldDirection(dir))).clone(),
      end,
    }
  }

  useFrame((_, delta) => {
    const r = rise.current
    if (r) {
      r.t = Math.min(1, r.t + Math.min(0.05, delta) / RISE_SECONDS)
      const e = r.t * r.t * (3 - 2 * r.t)
      camera.position.copy(r.path.getPointAt(e))
      /* Look along the way (up the shaft), then settle onto the clearing. */
      look.copy(r.path.getPointAt(Math.min(1, e + 0.08)))
      const settle = THREE.MathUtils.smoothstep(e, 0.55, 1)
      look.lerp(r.end.target, settle)
      if (r.t < 0.15) look.lerp(r.from, 1 - r.t / 0.15)
      camera.lookAt(look)
      if (r.t >= 1) {
        controls?.target?.copy(r.end.target)
        camera.lookAt(r.end.target)
        if (controls) controls.enabled = true
        controls?.update?.()
        rise.current = null
      }
      return
    }
    const w = world?.current
    const busy = (w && (w.phase !== 'explore' || w.focusId)) || controls?.enabled === false
    camera.getWorldDirection(dir)
    const want = !busy && underground(camera.position) && dir.y > (shown.current ? LOOK_UP_OFF : LOOK_UP)
    if (want !== shown.current) setShown(want)
  })

  useEffect(() => () => {
    if (rise.current && controls) controls.enabled = true
  }, [controls])

  return null
}

/**
 * World Final underworld: the cavern under the dunes (floor, ceiling, lip,
 * a few crystals), the kept remains resting in it, and its mood — under the
 * sand the water closes in: thicker, darker fog and a lower exposure.
 * Mount after HabitatTone so the fog it sets each frame is adjusted here.
 */
export default function Caves({ crystalRef, world = null, archive = [] }) {
  const res = useMemo(() => createCaveResources(), [])
  useEffect(() => () => res.dispose(), [res])
  const { scene, camera, gl } = useThree()
  const controls = useThree((st) => st.controls)
  const jump = useRef(requestedPose())
  const settled = useRef(0)
  const mood = useRef(0)
  const baseExposure = useRef(null)
  const pos = useMemo(() => [0, 0, 0], [])

  useFrame((state, delta) => {
    /* Wait for the opening hand-over to settle before taking the camera. */
    if (jump.current && world?.current?.phase === 'explore' && !world.current.focusId && controls?.enabled !== false) settled.current += delta
    else settled.current = 0
    if (jump.current && settled.current > 0.6) {
      camera.position.set(...jump.current.position)
      controls?.target?.set(...jump.current.target)
      camera.lookAt(...jump.current.target)
      controls?.update?.()
      jump.current = null
    }

    if (baseExposure.current == null) baseExposure.current = gl.toneMappingExposure
    pos[0] = camera.position.x
    pos[1] = camera.position.y
    pos[2] = camera.position.z
    const target = underworldDepth(pos)
    mood.current += (target - mood.current) * Math.min(1, delta * 1.5)
    const m = mood.current
    if (scene.fog && m > 0.002) {
      if ('density' in scene.fog) scene.fog.density *= 1 + 1.6 * m
      scene.fog.color.lerp(CAVE_FOG, 0.7 * m)
    }
    /* Underground darker; while a life is observed, a little darker too (FocusStudio). */
    /* The look's base exposure (HabitatTone, World Final) when there is one. */
    const base = world?.current?.exposureBase ?? baseExposure.current
    gl.toneMappingExposure = base * (1 - 0.18 * m) * (1 - 0.16 * (world?.current?.focusDim ?? 0))
    if (world?.current) {
      const eye = world.current.eye
      if (eye) {
        eye[0] = camera.position.x
        eye[1] = camera.position.y
        eye[2] = camera.position.z
      } else {
        world.current.eye = [camera.position.x, camera.position.y, camera.position.z]
      }
    }
    const level = crystalRef?.current?.level ?? 0
    /* The cavern's druses glow a little more as the water freezes. */
    res.emberMat.userData.uniforms.uEmberGlow.value = 1.45 + level * 0.5
    res.lilacMat.emissiveIntensity = 0.16 + 0.08 * level
    /* Oil-film skin: sparkles move with the light. */
    const t = state.clock.elapsedTime
    res.floorMat.userData.uniforms.uTime.value = t
    res.ceilingMat.userData.uniforms.uTime.value = t
  })

  return (
    <group>
      {res.objects.map((o) => (
        <primitive key={o.uuid} object={o} dispose={null} />
      ))}
      <SandFall />
      <HoleGlow />
      {archive?.length ? <KeptRemains entries={archive} /> : null}
      {world ? <SurfaceReturn world={world} /> : null}
    </group>
  )
}
