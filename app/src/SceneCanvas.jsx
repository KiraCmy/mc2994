import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createSpikyMesh } from './createSpikyMesh.js'
import { THEMES } from './themes.js'

export default function SceneCanvas({ spikes, hue, themeId }) {
  const canvasRef = useRef(null)
  const paramsRef = useRef({ spikes, hue, themeId })
  const apiRef = useRef(null)

  useEffect(() => {
    paramsRef.current = { spikes, hue, themeId }
    apiRef.current?.applyParams(paramsRef.current)
  }, [spikes, hue, themeId])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return undefined
    }

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
    camera.position.set(3.2, 2.4, 4.2)

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.target.set(0, 0, 0)
    controls.minDistance = 2
    controls.maxDistance = 16

    const ambient = new THREE.AmbientLight(0xffffff, 0.45)
    scene.add(ambient)

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.15)
    keyLight.position.set(4, 6, 3)
    keyLight.castShadow = true
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0x9eb6ff, 0.35)
    fillLight.position.set(-3, 1, -2)
    scene.add(fillLight)

    const spiky = createSpikyMesh(paramsRef.current.spikes)
    scene.add(spiky.mesh)

    let grid = new THREE.GridHelper(12, 12, 0x3a4154, 0x232833)
    grid.position.y = -1.1
    scene.add(grid)
    let activeThemeId = null
    let activeSpikes = null

    const disposeGrid = (helper) => {
      helper.geometry.dispose()
      if (Array.isArray(helper.material)) {
        helper.material.forEach((entry) => entry.dispose())
      } else {
        helper.material.dispose()
      }
    }

    const applyTheme = (id) => {
      if (id === activeThemeId) {
        return
      }
      activeThemeId = id
      const theme = THEMES[id] ?? THEMES.midnight
      scene.background = new THREE.Color(theme.background)
      ambient.color.set(theme.ambient)
      ambient.intensity = theme.ambientIntensity
      keyLight.color.set(theme.key)
      keyLight.intensity = theme.keyIntensity
      fillLight.color.set(theme.fill)
      fillLight.intensity = theme.fillIntensity

      scene.remove(grid)
      disposeGrid(grid)
      grid = new THREE.GridHelper(12, 12, theme.gridMajor, theme.gridMinor)
      grid.position.y = -1.1
      scene.add(grid)
    }

    const applyParams = ({ spikes: nextSpikes, hue: nextHue, themeId: nextTheme }) => {
      if (nextSpikes !== activeSpikes) {
        activeSpikes = nextSpikes
        spiky.setSpikeCount(nextSpikes)
      }
      spiky.setHue(nextHue)
      applyTheme(nextTheme)
    }

    apiRef.current = { applyParams }
    applyParams(paramsRef.current)

    const resize = () => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (width === 0 || height === 0) {
        return
      }
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    let frameId = 0
    const clock = new THREE.Clock()
    const tick = () => {
      const delta = clock.getDelta()
      spiky.mesh.rotation.y += delta * 0.35
      spiky.mesh.rotation.x = Math.sin(clock.elapsedTime * 0.45) * 0.12
      controls.update()
      renderer.render(scene, camera)
      frameId = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(frameId)
      observer.disconnect()
      controls.dispose()
      spiky.dispose()
      disposeGrid(grid)
      renderer.dispose()
      apiRef.current = null
    }
  }, [])

  return <canvas ref={canvasRef} className="scene-canvas" />
}
