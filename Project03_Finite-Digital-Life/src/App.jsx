import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import AdjustBar from './AdjustBar.jsx'
import Hud from './Hud.jsx'
import Specimen from './Specimen.jsx'
import {
  INITIAL_DEVELOPMENT,
  INITIAL_INDIVIDUALITY,
  INITIAL_SURFACE,
  STUDIES,
} from './surfaceParams.js'

export default function App() {
  const [studyId, setStudyId] = useState('surface')
  const [surface, setSurface] = useState(INITIAL_SURFACE)
  const [individuality, setIndividuality] = useState(INITIAL_INDIVIDUALITY)
  const [development, setDevelopment] = useState(INITIAL_DEVELOPMENT)

  const study = STUDIES.find((item) => item.id === studyId) ?? STUDIES[0]

  const params =
    study.id === 'individuality'
      ? individuality
      : study.id === 'development'
        ? development
        : surface

  function updateParam(key, value) {
    if (study.id === 'individuality') {
      setIndividuality((current) => ({ ...current, [key]: value }))
      return
    }
    if (study.id === 'development') {
      setDevelopment((current) => ({ ...current, [key]: value }))
      return
    }
    setSurface((current) => ({ ...current, [key]: value }))
  }

  return (
    <main className="stage">
      <Canvas
        className="viewport"
        camera={{ position: [0, 0, 6.2], fov: 30 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0)
        }}
      >
        <Specimen
          studyId={study.id}
          surface={surface}
          individuality={individuality}
          development={development}
        />
        <OrbitControls
          enablePan={false}
          enableDamping
          dampingFactor={0.06}
          minDistance={4.2}
          maxDistance={8.5}
          minPolarAngle={0.35}
          maxPolarAngle={Math.PI - 0.35}
        />
      </Canvas>
      <Hud
        studyId={study.id}
        age={development.age}
        seed={individuality.seed}
        onSelectStudy={setStudyId}
      />
      <AdjustBar study={study} params={params} onChange={updateParam} />
    </main>
  )
}
