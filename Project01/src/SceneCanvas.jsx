import { Canvas } from '@react-three/fiber'
import { OrbitControls, OrthographicCamera } from '@react-three/drei'
import LayerStack from './LayerStack.jsx'

export default function SceneCanvas({ params }) {
  return (
    <Canvas
      className="scene-canvas"
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 2]}
      onCreated={({ gl }) => {
        gl.setClearColor('#0a0b0d')
      }}
    >
      <OrthographicCamera
        makeDefault
        position={[4.2, 3.1, 4.2]}
        zoom={95}
        near={-40}
        far={40}
      />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.45}
        enablePan={false}
        minZoom={55}
        maxZoom={160}
        target={[0, 0, 0]}
      />
      <LayerStack {...params} />
    </Canvas>
  )
}
