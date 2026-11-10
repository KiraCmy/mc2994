import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

/* Guards the bloom chain against NaN / Inf / runaway HDR pixels. One bad
   pixel (e.g. a degenerate normal on Apple GPUs) would otherwise be smeared
   by the bloom blur into a full-screen flash. `?nan=1` paints them magenta. */
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null }, uDebug: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uDebug;
    varying vec2 vUv;
    bool bad(float v) { return isnan(v) || isinf(v) || !(v == v) || abs(v) > 6.0e4; }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      if (bad(c.r) || bad(c.g) || bad(c.b) || bad(c.a)) {
        gl_FragColor = uDebug > 0.5 ? vec4(1.0, 0.0, 1.0, 1.0) : vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }
      gl_FragColor = vec4(clamp(c.rgb, 0.0, 32.0), c.a);
    }`,
}
const NAN_DEBUG = typeof window !== 'undefined' && /[?&]nan=1/.test(window.location.search)
import { habitatHeight, habitatRng } from './habitatField.js'
import { habitatTone, toneCssVars, TONE_BASE } from './habitatTone.js'
import { deathPhases } from './habitatFossil.js'
import {
  createEnvironmentScene,
  bubbleFragment,
  bubbleVertex,
  LIGHT_DIR,
  moteFragment,
  moteVertex,
  dustFragment,
  dustVertex,
  shaftFragment,
  shaftVertex,
  skyFragment,
  skyVertex,
} from './habitatShaders.js'

export { LIGHT_DIR }

/*
 * Exp07 atmosphere: dusky blue-grey medium, light falling from the upper right
 * through haze, drifting motes and soft bokeh, a matching reflection map so
 * glass and membrane reflect this world (not a white studio), and bloom.
 */

export const HABITAT_FOG = '#9da5b5'

export function HabitatEnvironment() {
  const { gl, scene } = useThree()
  const envMap = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const envScene = createEnvironmentScene()
    const texture = pmrem.fromScene(envScene, 0.035).texture
    envScene.traverse((o) => {
      o.geometry?.dispose?.()
      o.material?.dispose?.()
    })
    pmrem.dispose()
    return texture
  }, [gl])

  useEffect(() => {
    const previous = scene.environment
    scene.environment = envMap
    scene.background = new THREE.Color(HABITAT_FOG)
    return () => {
      scene.environment = previous
      envMap.dispose()
    }
  }, [scene, envMap])
  return null
}

const toColor = (rgb) => new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace)

/** Live tone state (eased toward the environment's target tone). */
export function createToneState() {
  return {
    fog: toColor(TONE_BASE.fog),
    top: toColor(TONE_BASE.top),
    horizon: toColor(TONE_BASE.horizon),
    bottom: toColor(TONE_BASE.bottom),
    hemiGround: toColor(TONE_BASE.hemiGround),
    key: toColor(TONE_BASE.key),
    ground: toColor(TONE_BASE.ground),
    crystal: toColor(TONE_BASE.crystal),
    /* Page overlay colours stay in sRGB arrays (CSS). */
    css: { bloomA: [...TONE_BASE.bloomA], bloomB: [...TONE_BASE.bloomB], floor: [...TONE_BASE.floor], top: [...TONE_BASE.top] },
    fogDensity: 0.0105,
    hemiIntensity: 0.45,
    keyIntensity: 1.5,
    shaftStrength: 1,
    caustic: 0.3,
    veilFade: 0.45,
    moteDrift: 0,
    bloomAlpha: 1,
    storm: 0,
    film: 0,
    dusk: 0,
  }
}

const TONE_COLORS = ['fog', 'top', 'horizon', 'bottom', 'hemiGround', 'key', 'ground', 'crystal']
const TONE_SCALARS = ['fogDensity', 'hemiIntensity', 'keyIntensity', 'shaftStrength', 'caustic', 'veilFade', 'moteDrift', 'bloomAlpha', 'storm', 'film']

/**
 * The water's colour follows the environment (habitatTone): eases over ~1 s
 * so slider drags and "Tell it something" shifts read as the medium changing.
 */
export function HabitatTone({ envRef, toneRef, deathRef = null, overlayRef = null, world = null }) {
  const scene = useThree((s) => s.scene)
  const tmp = useMemo(() => new THREE.Color(), [])
  const frame = useRef(0)
  useFrame((_, delta) => {
    const tone = toneRef.current
    /* The end of a life pulls the whole habitat toward night. */
    tone.dusk = deathPhases(deathRef?.current?.t ?? -1).dusk
    const target = habitatTone(envRef?.current, tone.dusk)
    /* World Final opening: thick, bright haze while sinking from the surface,
       thinning after arrival so the seabed (and its lives) emerge slowly. */
    const o = world?.current?.opening
    if (o) {
      const depth = o.depth ?? 0
      /* Thinner while high in the water (the seabed must emerge), thickest
         just after landing, then clearing. */
      target.fogDensity *= 1 + (o.haze ?? 0) * (0.9 - 0.5 * depth)
      for (const key of ['fog', 'horizon', 'bottom']) {
        target[key] = target[key].map((v, i) => v + (target.top[i] - v) * 0.3 * depth)
      }
      target.shaftStrength *= 1 + 0.8 * depth
    }
    const k = 1 - Math.exp(-Math.min(0.1, delta) * 1.6)
    for (const key of TONE_COLORS) {
      const c = target[key]
      tone[key].lerp(tmp.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace), k)
    }
    for (const key of TONE_SCALARS) tone[key] += (target[key] - tone[key]) * k
    for (const key of Object.keys(tone.css)) {
      const from = tone.css[key]
      const to = target[key]
      for (let i = 0; i < 3; i++) from[i] += (to[i] - from[i]) * k
    }
    /* Page overlay (vignette, blooms, floor) follows the same tone. */
    frame.current += 1
    const el = overlayRef?.current
    if (el && frame.current % 4 === 0) {
      const vars = toneCssVars({ ...tone.css, bloomAlpha: tone.bloomAlpha })
      for (const [name, value] of Object.entries(vars)) el.style.setProperty(name, value)
    }
    if (scene.fog) {
      scene.fog.color.copy(tone.fog)
      if ('density' in scene.fog) scene.fog.density = tone.fogDensity
    }
    if (scene.background?.isColor) scene.background.copy(tone.fog)
  })
  return null
}

export function HabitatSky({ toneRef = null }) {
  const res = useMemo(() => {
    const geo = new THREE.SphereGeometry(1400, 48, 24)
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color('#c6ccd8') },
        uHorizon: { value: new THREE.Color('#a2aaba') },
        uBottom: { value: new THREE.Color('#7d8597') },
        uGlow: { value: new THREE.Color('#ffffff') },
        uLightDir: { value: LIGHT_DIR },
      },
      vertexShader: skyVertex,
      fragmentShader: skyFragment,
    })
    return { geo, mat }
  }, [])
  useEffect(() => () => {
    res.geo.dispose()
    res.mat.dispose()
  }, [res])
  useFrame(() => {
    const tone = toneRef?.current
    if (!tone) return
    res.mat.uniforms.uTop.value.copy(tone.top)
    res.mat.uniforms.uHorizon.value.copy(tone.horizon)
    res.mat.uniforms.uBottom.value.copy(tone.bottom)
  })
  return <mesh geometry={res.geo} material={res.mat} renderOrder={-10} frustumCulled={false} dispose={null} />
}

export function HabitatLights({ toneRef = null }) {
  const key = LIGHT_DIR.clone().multiplyScalar(14)
  const hemi = useRef(null)
  const sun = useRef(null)
  useFrame(() => {
    const tone = toneRef?.current
    if (!tone) return
    if (hemi.current) {
      hemi.current.groundColor.copy(tone.hemiGround)
      hemi.current.intensity = tone.hemiIntensity
    }
    if (sun.current) {
      sun.current.color.copy(tone.key)
      sun.current.intensity = tone.keyIntensity
    }
  })
  return (
    <group>
      <hemisphereLight ref={hemi} args={['#f2f4f8', '#6f6984', 0.45]} />
      <directionalLight ref={sun} position={key.toArray()} color="#ffffff" intensity={1.5} />
      <directionalLight position={[-5, 2.5, 7]} color="#f3d6ff" intensity={0.7} />
      <directionalLight position={[2, 1, 6]} color="#ffe2c4" intensity={0.25} />
    </group>
  )
}

export function LightShafts({ timeRef, toneRef = null }) {
  const res = useMemo(() => {
    const r = habitatRng(733)
    const geo = new THREE.PlaneGeometry(1, 1, 1, 1)
    geo.translate(0, -0.5, 0)
    const shafts = []
    for (let i = 0; i < 7; i++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uStrength: { value: 0.1 + r() * 0.14 }, uSeed: { value: r() } },
        vertexShader: shaftVertex,
        fragmentShader: shaftFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      })
      const width = 1.2 + r() * 2.4
      const top = new THREE.Vector3(5 + r() * 8, 12, -9 - r() * 6)
      const target = new THREE.Vector3(-2 + r() * 5, -0.5, -2 + r() * 4)
      shafts.push({ mat, width, top, target, cross: r() * Math.PI, base: mat.uniforms.uStrength.value })
    }
    return { geo, shafts }
  }, [])

  useEffect(() => () => {
    res.geo.dispose()
    res.shafts.forEach((s) => s.mat.dispose())
  }, [res])

  useFrame(() => {
    const time = timeRef?.current ?? 0
    const strength = toneRef?.current?.shaftStrength ?? 1
    for (const s of res.shafts) {
      s.mat.uniforms.uTime.value = time
      s.mat.uniforms.uStrength.value = s.base * strength
    }
  })

  return (
    <group>
      {res.shafts.map((s, i) => {
        const dir = s.target.clone().sub(s.top)
        const length = dir.length()
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize())
        return (
          <group key={i} position={s.top.toArray()} quaternion={q}>
            {[0, Math.PI / 2].map((rot) => (
              <mesh
                key={rot}
                geometry={res.geo}
                material={s.mat}
                rotation={[0, s.cross + rot, 0]}
                scale={[s.width, length, 1]}
                renderOrder={8}
                frustumCulled={false}
                dispose={null}
              />
            ))}
          </group>
        )
      })}
    </group>
  )
}

export function Motes({ timeRef, envRef, toneRef = null, pixelScale = 1, count = 1800 }) {
  const res = useMemo(() => {
    const r = habitatRng(919)
    const pos = new Float32Array(count * 3)
    const size = new Float32Array(count)
    const phase = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const bokeh = i < 40
      pos.set(
        bokeh
          ? [(r() - 0.5) * 7, 0.2 + r() * 3.2, 2.5 + r() * 3.2]
          : [(r() - 0.5) * 26, r() * 9, -16 + r() * 22],
        i * 3,
      )
      size[i] = bokeh ? 9 + r() * 14 : 0.8 + Math.pow(r(), 3) * 4
      phase[i] = r() * 100
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 1 }, uDrift: { value: 0 } },
      vertexShader: moteVertex,
      fragmentShader: moteFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { geo, mat }
  }, [count])
  useEffect(() => () => {
    res.geo.dispose()
    res.mat.dispose()
  }, [res])
  useEffect(() => {
    res.mat.uniforms.uScale.value = pixelScale
  }, [res, pixelScale])
  useFrame(() => {
    res.mat.uniforms.uTime.value = timeRef?.current ?? 0
    res.mat.uniforms.uDrift.value = toneRef?.current?.moteDrift ?? (envRef?.current?.turbulence ?? 0) * 0.6
  })
  return <points geometry={res.geo} material={res.mat} frustumCulled={false} renderOrder={9} dispose={null} />
}

/** Sand and dust picked up when turbulence (Storm) rises. Invisible when calm. */
export function Dust({ timeRef, toneRef = null, pixelScale = 1, count = 1100 }) {
  const res = useMemo(() => {
    const r = habitatRng(2201)
    const pos = new Float32Array(count * 3)
    const size = new Float32Array(count)
    const phase = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const x = (r() - 0.5) * 36
      const z = -6 + (r() - 0.5) * 28
      pos.set([x, habitatHeight(x, z) + r() * 0.4, z], i * 3)
      size[i] = 1.4 + Math.pow(r(), 2) * 5.5
      phase[i] = r()
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 1 }, uStorm: { value: 0 } },
      vertexShader: dustVertex,
      fragmentShader: dustFragment,
      transparent: true,
      depthWrite: false,
    })
    return { geo, mat }
  }, [count])
  useEffect(() => () => {
    res.geo.dispose()
    res.mat.dispose()
  }, [res])
  useEffect(() => {
    res.mat.uniforms.uScale.value = pixelScale
  }, [res, pixelScale])
  useFrame(() => {
    res.mat.uniforms.uTime.value = timeRef?.current ?? 0
    res.mat.uniforms.uStorm.value = toneRef?.current?.storm ?? 0
  })
  return <points geometry={res.geo} material={res.mat} frustumCulled={false} renderOrder={8} dispose={null} />
}

/**
 * Rising bubbles: the medium is water. Small glassy rings drift up from the
 * sand with a slow wobble, faster and more sideways in turbulence.
 */
export function Bubbles({ timeRef, envRef, pixelScale = 1, count = 260 }) {
  const res = useMemo(() => {
    const r = habitatRng(4407)
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2
      const rr = 1.5 + Math.pow(r(), 0.7) * 16
      const x = Math.cos(a) * rr
      const z = Math.sin(a) * rr - 3
      pos.set([x, habitatHeight(x, z), z], i * 3)
      /* speed, size, phase, rise height */
      seed.set([0.25 + r() * 0.45, 1.2 + Math.pow(r(), 2.5) * 3.6, r() * 100, 7 + r() * 7], i * 4)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4))
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 1 }, uTurb: { value: 0 } },
      vertexShader: bubbleVertex,
      fragmentShader: bubbleFragment,
      transparent: true,
      depthWrite: false,
    })
    return { geo, mat }
  }, [count])
  useEffect(() => () => {
    res.geo.dispose()
    res.mat.dispose()
  }, [res])
  useEffect(() => {
    res.mat.uniforms.uScale.value = pixelScale
  }, [res, pixelScale])
  useFrame(() => {
    res.mat.uniforms.uTime.value = timeRef?.current ?? 0
    res.mat.uniforms.uTurb.value = envRef?.current?.turbulence ?? 0
  })
  return <points geometry={res.geo} material={res.mat} frustumCulled={false} renderOrder={9} dispose={null} />
}

/** Bloom + ACES output. Takes over rendering (useFrame priority 1). */
export function HabitatPost({ bloomStrength = 0.22 }) {
  const { gl, scene, camera, size } = useThree()
  const composer = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(size.width, size.height, {
      type: THREE.HalfFloatType,
      samples: 4,
    })
    const c = new EffectComposer(gl, target)
    c.addPass(new RenderPass(scene, camera))
    const sanitize = new ShaderPass(SanitizeShader)
    sanitize.uniforms.uDebug.value = NAN_DEBUG ? 1 : 0
    c.addPass(sanitize)
    const bloom = new UnrealBloomPass(new THREE.Vector2(size.width, size.height), bloomStrength, 0.6, 0.97)
    c.addPass(bloom)
    c.addPass(new OutputPass())
    return { c, bloom }
    // Size is applied in the effect below; recreating on resize would leak.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera])

  useEffect(() => {
    composer.c.setPixelRatio(gl.getPixelRatio())
    composer.c.setSize(size.width, size.height)
  }, [composer, gl, size.width, size.height])

  useEffect(() => {
    composer.bloom.strength = bloomStrength
  }, [composer, bloomStrength])

  useEffect(() => () => composer.c.dispose(), [composer])

  useFrame(() => {
    composer.c.render()
  }, 1)
  return null
}
