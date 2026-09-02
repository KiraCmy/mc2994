import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createFilmMesh } from './createFilmMesh.js'

export default function SceneCanvas({ subdivision }) {
  const canvasRef = useRef(null)
  const paramsRef = useRef({ subdivision })
  const apiRef = useRef(null)

  useEffect(() => {
    paramsRef.current = { subdivision }
    apiRef.current?.applyParams(paramsRef.current)
  }, [subdivision])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return undefined
    }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0a0b0d')

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
    camera.position.set(3.2, 2.4, 4.2)

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.02

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.target.set(0, 0, 0)
    controls.minDistance = 2
    controls.maxDistance = 16

    const ambient = new THREE.AmbientLight(0xffffff, 0.35)
    scene.add(ambient)

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.05)
    keyLight.position.set(4, 6, 3)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0xc8ccd4, 0.28)
    fillLight.position.set(-3, 1, -2)
    scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0xe8a317, 0.22)
    rimLight.position.set(-2, 3, 4)
    scene.add(rimLight)

    const film = createFilmMesh(paramsRef.current.subdivision)
    scene.add(film.mesh)

    const grid = new THREE.GridHelper(12, 12, 0x2a2e38, 0x1e222b)
    grid.position.y = -1.15
    scene.add(grid)

    let activeSubdivision = null

    const applyParams = ({ subdivision: nextSubdivision }) => {
      if (nextSubdivision !== activeSubdivision) {
        activeSubdivision = nextSubdivision
        film.setSubdivision(nextSubdivision)
      }
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
      film.mesh.rotation.y += delta * 0.28
      film.mesh.rotation.x = Math.sin(clock.elapsedTime * 0.4) * 0.1
      controls.update()
      renderer.render(scene, camera)
      frameId = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(frameId)
      observer.disconnect()
      controls.dispose()
      film.dispose()
      grid.geometry.dispose()
      if (Array.isArray(grid.material)) {
        grid.material.forEach((entry) => entry.dispose())
      } else {
        grid.material.dispose()
      }
      renderer.dispose()
      apiRef.current = null
    }
  }, [])

  return <canvas ref={canvasRef} className="scene-canvas" />
}
