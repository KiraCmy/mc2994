import { useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { CRYSTAL_DEMO_SEED, createCrystalGeometries } from './crystalGeometry.js'

const FINISH_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5; float d = dot(c, c);
      vec2 off = c * d * 0.018;
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      col *= 1.0 - d * 0.55;
      col += (hash(vUv * 1000.0 + uTime) - 0.5) * 0.035;
      gl_FragColor = vec4(col, 1.0);
    }`,
}

function demoCameraDistance(width, height) {
  const aspect = width / Math.max(height, 1)
  return aspect < 0.75 ? (9.2 / (aspect / 0.75)) * 0.82 : 9.2
}

function magentaGoldPanel() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 16
  const context = canvas.getContext('2d')
  const gradient = context.createLinearGradient(0, 0, 256, 0)
  gradient.addColorStop(0, '#3a1bff')
  gradient.addColorStop(0.35, '#ff2bd6')
  gradient.addColorStop(0.65, '#ff7a1a')
  gradient.addColorStop(1, '#ffd23a')
  context.fillStyle = gradient
  context.fillRect(0, 0, 256, 16)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

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

function buildDemoEnvironment(renderer) {
  const env = new THREE.Scene()
  env.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(40, 32, 16),
      new THREE.MeshBasicMaterial({ color: 0x030304, side: THREE.BackSide }),
    ),
  )
  const rainbow = magentaGoldPanel()
  addPanel(env, 14, 6, 0xffffff, 7, [2, 14, 6])
  addPanel(env, 2, 18, 0xf2f6ff, 5, [14, 2, 4])
  addPanel(env, 16, 5, 0xffffff, 3.2, [-12, -6, 6], rainbow)
  addPanel(env, 6, 10, 0x6a4cff, 1.6, [-10, 6, -8])
  addPanel(env, 8, 3, 0xd8ffc8, 1.4, [6, -10, -6])
  addPanel(env, 1.2, 12, 0xffffff, 6, [-4, 0, 14])

  const pmrem = new THREE.PMREMGenerator(renderer)
  const texture = pmrem.fromScene(env, 0.015).texture
  pmrem.dispose()
  env.traverse((object) => {
    object.geometry?.dispose()
    const material = object.material
    material?.map?.dispose()
    material?.dispose()
  })
  return texture
}

function sparkleTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.25, 'rgba(255,255,255,.6)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 32, 32)
  return new THREE.CanvasTexture(canvas)
}

function createSpecimen() {
  const geometries = createCrystalGeometries(CRYSTAL_DEMO_SEED)
  const crystalMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 1,
    thickness: 1.8,
    ior: 1.62,
    dispersion: 5,
    roughness: 0.06,
    metalness: 0,
    iridescence: 0.85,
    iridescenceIOR: 1.35,
    iridescenceThicknessRange: [180, 820],
    attenuationColor: new THREE.Color(0xe4ecd9),
    attenuationDistance: 2.6,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    specularIntensity: 1,
    envMapIntensity: 1.25,
  })
  const crustMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    metalness: 0.92,
    roughness: 0.34,
    flatShading: true,
    envMapIntensity: 1.4,
  })
  const dots = sparkleTexture()
  const sparkMaterial = new THREE.PointsMaterial({
    size: 0.035,
    map: dots,
    color: new THREE.Color(3, 3, 3),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const crust = new THREE.Mesh(geometries.crust, crustMaterial)
  const crystal = new THREE.Mesh(geometries.crystal, crystalMaterial)
  const sparks = new THREE.Points(geometries.sparkles, sparkMaterial)
  return { crust, crystal, sparks, dots }
}

/**
 * The standalone crystal page, mounted only while Original Demo is selected.
 * It renders through its own composer and restores the shared renderer on exit.
 */
export default function CrystalDemo() {
  const group = useRef(null)
  const session = useRef(null)
  const get = useThree((state) => state.get)
  const size = useThree((state) => state.size)

  useLayoutEffect(() => {
    const { gl, scene, camera, size: view, controls } = get()
    const specimen = createSpecimen()
    const envMap = buildDemoEnvironment(gl)
    const parent = group.current
    parent.add(specimen.crust, specimen.crystal, specimen.sparks)
    parent.rotation.z = -0.18

    const snapshot = {
      background: scene.background,
      environment: scene.environment,
      environmentIntensity: scene.environmentIntensity,
      environmentRotation: scene.environmentRotation.clone(),
      toneMapping: gl.toneMapping,
      toneMappingExposure: gl.toneMappingExposure,
      position: camera.position.clone(),
      near: camera.near,
      far: camera.far,
      target: controls?.target?.clone?.() ?? new THREE.Vector3(),
    }

    scene.background = new THREE.Color(0x000000)
    scene.environment = envMap
    scene.environmentIntensity = 1.1
    scene.environmentRotation.set(0, 0, 0)
    gl.toneMapping = THREE.AgXToneMapping
    gl.toneMappingExposure = 1.15

    const dist = demoCameraDistance(view.width, view.height)
    camera.position.set(0.6, 0.3, dist)
    camera.near = 0.1
    camera.far = 100
    camera.updateProjectionMatrix()
    if (controls?.target) {
      controls.target.set(0, 0, 0)
      controls.update()
    }

    const composer = new EffectComposer(gl)
    composer.setPixelRatio(gl.getPixelRatio())
    composer.setSize(view.width, view.height)
    composer.addPass(new RenderPass(scene, camera))
    const bloom = new UnrealBloomPass(new THREE.Vector2(view.width, view.height), 0.38, 0.45, 0.82)
    composer.addPass(bloom)
    const output = new OutputPass()
    composer.addPass(output)
    const finish = new ShaderPass(FINISH_SHADER)
    composer.addPass(finish)
    bloom.resolution.set(view.width, view.height)

    const clock = new THREE.Clock()
    session.current = { specimen, envMap, composer, bloom, output, finish, clock, snapshot }

    return () => {
      session.current = null
      parent.remove(specimen.crust, specimen.crystal, specimen.sparks)
      specimen.crystal.geometry.dispose()
      specimen.crust.geometry.dispose()
      specimen.sparks.geometry.dispose()
      specimen.crystal.material.dispose()
      specimen.crust.material.dispose()
      specimen.sparks.material.dispose()
      specimen.dots.dispose()

      bloom.dispose()
      output.dispose()
      finish.dispose()
      composer.dispose()

      if (scene.environment === envMap) scene.environment = snapshot.environment
      envMap.dispose()
      scene.background = snapshot.background
      scene.environmentIntensity = snapshot.environmentIntensity
      scene.environmentRotation.copy(snapshot.environmentRotation)
      gl.toneMapping = snapshot.toneMapping
      gl.toneMappingExposure = snapshot.toneMappingExposure

      camera.position.copy(snapshot.position)
      camera.near = snapshot.near
      camera.far = snapshot.far
      camera.updateProjectionMatrix()
      const liveControls = get().controls
      if (liveControls?.target) {
        liveControls.target.copy(snapshot.target)
        liveControls.update()
      }
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

  useFrame(() => {
    const current = session.current
    const specimen = group.current
    if (!current || !specimen) return
    const { scene } = get()
    const t = current.clock.getElapsedTime()
    specimen.position.y = Math.sin(t * 0.6) * 0.05
    scene.environmentRotation.y = t * 0.04
    current.finish.uniforms.uTime.value = t % 100
    current.composer.render()
  }, 1)

  return (
    <>
      <directionalLight position={[3, 5, 4]} intensity={2.2} color={0xfff1d0} />
      <group ref={group} />
    </>
  )
}
