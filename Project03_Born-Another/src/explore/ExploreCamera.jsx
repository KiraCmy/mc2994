import { useLayoutEffect } from 'react'
import { useThree } from '@react-three/fiber'

/**
 * Tune near/far for close surface viewing while Explore is active.
 * Dolly limits (min/max distance) stay on OrbitControls in App.
 */
export default function ExploreCamera({ active = false }) {
  const camera = useThree((state) => state.camera)

  useLayoutEffect(() => {
    if (active) {
      camera.near = 0.04
      camera.far = 120
    } else {
      camera.near = 0.1
      camera.far = 2000
    }
    camera.updateProjectionMatrix()
  }, [active, camera])

  return null
}
