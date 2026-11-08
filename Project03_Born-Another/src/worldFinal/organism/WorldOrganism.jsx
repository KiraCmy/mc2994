/**
 * World Final — one Final Form organism floating above the seabed (M3A).
 *
 * Reuses the Playground Population organism unchanged (membrane body,
 * crystal petals, particle halo) and its Life Engine; World Final only
 * chooses the seed and AGE, places it with heightAt, and sways it with the
 * shared water current. All motion is written to the group in useFrame; the
 * only React updates come from the Life Engine while AGE is playing.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import PopulationOrganism from '../../playground/finalForm/PopulationOrganism.jsx'
import { EXP05_LAB_DEFAULTS } from '../../playground/finalForm/exp05LabParams.js'
import { EXP05_MORPHOLOGY_TYPES } from '../../playground/finalForm/exp05MorphologyTypes.js'
import { BODY_RADIUS, scaleForAge } from '../../playground/finalForm/populationSim.js'
import { useLifeEngine } from '../../worldv2/life/useLifeEngine.js'
import { atmosphereParams } from '../atmosphere.js'
import { organismAnchorFor } from '../cameraPoses.js'
import { hazeOffsetForCamera } from '../seabedMaterial.js'
import { useWaterCurrent } from '../WaterCurrent.jsx'
import {
  createOrganismUniforms,
  syncOrganismRendering,
  updateLocalCamera,
} from './organismAdapter.js'
import { organismFloat, ORGANISM_SEED } from './organismPlacement.js'

/** Population's level of detail for a mature body. */
const PARTICLE_DENSITY = 0.12
/** Slow spin so the form turns through its profiles (≈ 5 min / turn). */
const SPIN_RATE = 0.02
/** Report AGE to the panel only when it moved this much (while playing). */
const AGE_REPORT_STEP = 0.002

export default function WorldOrganism({
  config,
  hazeEnabled = true,
  visible = true,
  age,
  seekEpoch = 0,
  playing = false,
  onAgeReport = null,
  onEnded = null,
  /** Shared { position, radius, visible } for the seabed shadow. */
  presence = null,
}) {
  const { life, seekToAge, setPlaying } = useLifeEngine(ORGANISM_SEED)
  const current = useWaterCurrent()
  const camera = useThree((s) => s.camera)
  const groupRef = useRef(null)
  const uniforms = useMemo(() => createOrganismUniforms(), [])
  const anchor = useMemo(() => organismAnchorFor(config), [config])
  const motion = useRef({ offset: [0, 0, 0], tilt: [0, 0], scale: null })
  const floatOut = useRef({ offset: [0, 0, 0], tilt: [0, 0] })
  const lifeAgeRef = useRef(life.age)
  lifeAgeRef.current = life.age

  const playingRef = useRef(playing)
  playingRef.current = playing
  const ageRef = useRef(age)
  ageRef.current = age

  /* Seek on mount and on every panel scrub; never on live AGE reports. */
  useEffect(() => {
    seekToAge(ageRef.current, { resume: playingRef.current })
  }, [seekEpoch, seekToAge])

  useEffect(() => {
    setPlaying(playing)
  }, [playing, setPlaying])

  const reportRef = useRef({ onAgeReport, onEnded, last: life.age })
  reportRef.current.onAgeReport = onAgeReport
  reportRef.current.onEnded = onEnded
  useEffect(() => {
    const r = reportRef.current
    if (playingRef.current && Math.abs(life.age - r.last) >= AGE_REPORT_STEP) {
      r.last = life.age
      r.onAgeReport?.(life.age)
    }
    if (life.dead) r.onEnded?.()
  }, [life.age, life.dead])

  useLayoutEffect(() => {
    const p = atmosphereParams(config)
    uniforms.uWfHazeOn.value = hazeEnabled ? 1 : 0
    uniforms.uWfHazeDensity.value = p.hazeDensity
    uniforms.uWfHazeStart.value = p.hazeStart
    uniforms.uWfHazeColor.value.copy(p.haze)
  }, [config, hazeEnabled, uniforms])

  useFrame(({ clock }, delta) => {
    const group = groupRef.current
    if (presence) presence.visible = Boolean(group && visible)
    if (!group || !visible) return
    const t = clock.getElapsedTime()
    const dt = Math.min(0.1, Math.max(0, delta))
    const m = motion.current

    const target = organismFloat(current.field, current.state, anchor, t, config.organismFloat, floatOut.current)
    /* Eased so Float strength / Current sliders never jolt the body. */
    const k = 1 - Math.exp(-dt * 1.5)
    for (let i = 0; i < 3; i += 1) m.offset[i] += (target.offset[i] - m.offset[i]) * k
    m.tilt[0] += (target.tilt[0] - m.tilt[0]) * k
    m.tilt[1] += (target.tilt[1] - m.tilt[1]) * k

    const targetScale = config.organismScale * scaleForAge(lifeAgeRef.current)
    m.scale = m.scale == null ? targetScale : m.scale + (targetScale - m.scale) * (1 - Math.exp(-dt * 2.2))

    group.position.set(anchor.x + m.offset[0], anchor.y + m.offset[1], anchor.z + m.offset[2])
    group.rotation.set(m.tilt[0], t * SPIN_RATE, m.tilt[1])
    group.scale.setScalar(Math.max(1e-4, m.scale))
    group.updateMatrixWorld(true)
    if (presence) {
      presence.position.copy(group.position)
      presence.radius = BODY_RADIUS * m.scale
    }

    const petals = syncOrganismRendering(group, uniforms)
    updateLocalCamera(uniforms, petals, camera)
    uniforms.uWfHazeOffset.value = hazeOffsetForCamera(camera.position.y, config)
    uniforms.uWfNearFar.value.set(camera.near, camera.far)
  })

  const lab = EXP05_LAB_DEFAULTS
  return (
    <group ref={groupRef} name="world-final-organism">
      {visible && (
        <PopulationOrganism
          life={life}
          morphologyType={EXP05_MORPHOLOGY_TYPES.WORLD}
          lobeAmplitude={1}
          sculpturalStrength={0}
          particleDensity={PARTICLE_DENSITY}
          petalDensity={lab.petalDensity}
          petalScale={lab.petalScale}
          particleMotion={lab.particleMotion}
          materialMode={lab.materialMode}
        />
      )}
    </group>
  )
}
