import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { habitatRng } from './habitatField.js'
import {
  createEnvironmentScene,
  LIGHT_DIR,
  moteFragment,
  moteVertex,
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

export const HABITAT_FOG = '#b3b9c5'

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

export function HabitatSky() {
  const res = useMemo(() => {
    const geo = new THREE.SphereGeometry(1400, 48, 24)
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color('#c4c9d3') },
        uHorizon: { value: new THREE.Color('#b3b9c5') },
        uBottom: { value: new THREE.Color('#959cab') },
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
  return <mesh geometry={res.geo} material={res.mat} renderOrder={-10} frustumCulled={false} dispose={null} />
}

export function HabitatLights() {
  const key = LIGHT_DIR.clone().multiplyScalar(14)
  return (
    <group>
      <hemisphereLight args={['#f2f4f8', '#8c93a3', 0.55]} />
      <directionalLight position={key.toArray()} color="#ffffff" intensity={1.5} />
      <directionalLight position={[-5, 2.5, 7]} color="#f3d6ff" intensity={0.7} />
      <directionalLight position={[2, 1, 6]} color="#ffe2c4" intensity={0.25} />
    </group>
  )
}

export function LightShafts({ timeRef }) {
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
      shafts.push({ mat, width, top, target, cross: r() * Math.PI })
    }
    return { geo, shafts }
  }, [])

  useEffect(() => () => {
    res.geo.dispose()
    res.shafts.forEach((s) => s.mat.dispose())
  }, [res])

  useFrame(() => {
    const time = timeRef?.current ?? 0
    for (const s of res.shafts) s.mat.uniforms.uTime.value = time
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

export function Motes({ timeRef, envRef, pixelScale = 1, count = 1800 }) {
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
    res.mat.uniforms.uDrift.value = (envRef?.current?.turbulence ?? 0) * 0.6
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
