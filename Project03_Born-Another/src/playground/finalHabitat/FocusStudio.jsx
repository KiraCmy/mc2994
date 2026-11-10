import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Specimen lighting while a life is observed (World Final): the water closes
 * in a little (denser fog, lower exposure via world.focusDim, read by
 * Caves) and two narrow lights find the body — a warm key from beside the
 * viewer and a cool rim from behind, which draws its silhouette. Only light
 * parameters change; nothing extra is drawn.
 */
export default function FocusStudio({ world }) {
  const scene = useThree((s) => s.scene)
  const key = useRef(null)
  const rim = useRef(null)
  const amount = useRef(0)
  const tmp = useMemo(
    () => ({ keyTarget: new THREE.Object3D(), rimTarget: new THREE.Object3D(), body: new THREE.Vector3(), toCam: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }),
    [],
  )

  useFrame((state, delta) => {
    const w = world?.current
    if (!w) return
    const id = w.phase === 'descent' ? null : w.focusId
    const body = id ? w.bodies.get(id) : null
    amount.current += ((body ? 1 : 0) - amount.current) * Math.min(1, delta * 1.2)
    const f = amount.current
    w.focusDim = f
    if (scene.fog && 'density' in scene.fog && f > 0.002) scene.fog.density *= 1 + 0.55 * f
    if (body) tmp.body.set(body.x, body.y, body.z)
    const r = body ? Math.max(0.5, body.r) : 1
    const cam = state.camera.position
    tmp.toCam.copy(cam).sub(tmp.body)
    tmp.toCam.y = 0
    if (tmp.toCam.lengthSq() < 1e-6) tmp.toCam.set(0, 0, 1)
    tmp.toCam.normalize()
    tmp.right.crossVectors(tmp.up, tmp.toCam).normalize()
    if (key.current) {
      key.current.position.copy(tmp.body).addScaledVector(tmp.toCam, r * 4).addScaledVector(tmp.right, -r * 3).addScaledVector(tmp.up, r * 4.5)
      tmp.keyTarget.position.copy(tmp.body)
      tmp.keyTarget.updateMatrixWorld()
      key.current.intensity = 9 * f
    }
    if (rim.current) {
      rim.current.position.copy(tmp.body).addScaledVector(tmp.toCam, -r * 5).addScaledVector(tmp.right, r * 1.5).addScaledVector(tmp.up, r * 2.5)
      tmp.rimTarget.position.copy(tmp.body)
      tmp.rimTarget.updateMatrixWorld()
      rim.current.intensity = 14 * f
    }
  })

  return (
    <>
      <primitive object={tmp.keyTarget} />
      <primitive object={tmp.rimTarget} />
      <spotLight ref={key} target={tmp.keyTarget} angle={0.42} penumbra={0.85} decay={1.1} distance={0} color="#fff3e8" intensity={0} />
      <spotLight ref={rim} target={tmp.rimTarget} angle={0.45} penumbra={0.9} decay={1.1} distance={0} color="#dfe9ff" intensity={0} />
    </>
  )
}

/**
 * Shift+P: copy the current view (camera position + orbit target) as JSON —
 * for setting the landing view precisely (worldOpening.js, explorePose).
 */
export function ViewCapture() {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  useMemo(() => {
    if (typeof window === 'undefined') return
    const onKey = (e) => {
      if (!(e.shiftKey && (e.key === 'P' || e.key === 'p'))) return
      const r = (v) => Math.round(v * 100) / 100
      const t = controls?.target ?? new THREE.Vector3()
      const view = JSON.stringify({ position: camera.position.toArray().map(r), target: t.toArray().map(r) })
      console.log('[Born Another] view', view)
      navigator.clipboard?.writeText(view).catch(() => {})
    }
    window.__baViewKey && window.removeEventListener('keydown', window.__baViewKey)
    window.__baViewKey = onKey
    window.addEventListener('keydown', onKey)
  }, [camera, controls])
  return null
}
