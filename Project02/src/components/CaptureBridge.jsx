import { useLayoutEffect } from 'react'
import { useThree } from '@react-three/fiber'

/** Registers a PNG capture helper for viewport Export controls. */
export default function CaptureBridge({ captureApiRef }) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)

  useLayoutEffect(() => {
    if (!captureApiRef) return undefined
    captureApiRef.current = {
      capturePng: () => {
        gl.render(scene, camera)
        return gl.domElement.toDataURL('image/png')
      },
    }
    return () => {
      if (captureApiRef.current) captureApiRef.current = null
    }
  }, [captureApiRef, gl, scene, camera])

  return null
}
