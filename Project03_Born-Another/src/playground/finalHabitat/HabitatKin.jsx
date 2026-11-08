import { memo, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import CrystalBody from './CrystalBody.jsx'
import ExploreLifeScatter from '../finalForm/ExploreLifeScatter.jsx'
import { mapLifeToExploreVisual } from '../finalForm/exploreLifeAdapter.js'
import { EXP05_LAB_DEFAULTS } from '../finalForm/exp05LabParams.js'
import { useHabitatKin } from './useHabitatKin.js'
import { kinCrystalLevel, kinPlacement, kinScale, kinTempo, relaxKin } from './habitatKin.js'

/** Population size incl. the hero (organism 0 is not drawn here). */
const KIN_COUNT = 6

function newSlot() {
  return {
    generation: -1,
    place: { current: { x: 0, z: 0, lift: 0, spin: 0, phase: 0, pulse: 0.5, scale: 0, snap: true } },
    crystal: { current: { level: 0 } },
  }
}

const KinBody = memo(function KinBody({ org, life, slot, envRef, temperature, layers, timeRef, crystalLevel }) {
  /* Petals shrink as this body crystallizes (coarse steps: cheap re-plans). */
  const level = Math.round(kinCrystalLevel(crystalLevel, org.age) * 20) / 20
  const petalScale = (EXP05_LAB_DEFAULTS.petalScale ?? 1) * (1 - 0.7 * level)
  const visual = useMemo(
    () =>
      life
        ? mapLifeToExploreVisual(life, {
            petalDensity: EXP05_LAB_DEFAULTS.petalDensity,
            petalScale,
            particleDensity: EXP05_LAB_DEFAULTS.particleDensity,
            particleMotion: EXP05_LAB_DEFAULTS.particleMotion,
          })
        : null,
    [life, petalScale],
  )
  if (!life || life.dead) return null
  const showPetals = layers?.petals !== false && visual && !visual.isDead && (visual.petalPlan?.petalCount ?? 0) > 0
  return (
    <CrystalBody
      life={life}
      crystalRef={slot.crystal}
      envRef={envRef}
      temperature={temperature}
      morphologyType={org.morphologyType}
      layers={layers}
      timeRef={timeRef}
      placeRef={slot.place}
      coreLight={false}
    >
      {showPetals ? (
        <ExploreLifeScatter
          life={life}
          petalPlan={visual.petalPlan}
          morphStrength={1}
          deformationStrength={1}
          lobeAmplitude={org.lobe ?? 1}
          morphologyType={org.morphologyType}
          temperature={temperature}
          sculpturalStrength={0}
          surfaceSeed={visual.individuality.seed}
          noiseScale={visual.individuality.noiseScale}
          age={visual.development.age}
          speed={visual.development.speed}
          pulseSpeed={visual.development.pulseSpeed}
          displacement={visual.development.displacement}
          noiseAmount={visual.development.noiseAmount}
          decayStart={0.8}
          decayScale={1.25}
          colorA={visual.surface.colorA}
          colorB={visual.surface.colorB}
          rimColor={visual.surface.rimColor}
          useAgeClock={false}
        />
      ) : null}
    </CrystalBody>
  )
})

/**
 * The other lives of the habitat (Exp04 population logic): each its own seed,
 * morphology and life stage — buds float high and stay soft, matures follow
 * the medium, old bodies sink, harden into crystal and dissolve, then a new
 * bud is born at the rim ("born another"). Each lives on its own clock
 * (kinTempo) and wanders around its sim seat, so they drift past each other.
 */
export default function HabitatKin({ crystalRef, envRef, timeRef, temperature, moisture, turbulence, running, layers, crystalLevel }) {
  const environment = useMemo(() => ({ temperature, moisture, turbulence }), [temperature, moisture, turbulence])
  const { popRef, snapshot, lives } = useHabitatKin({ count: KIN_COUNT, playing: running, environment })
  const slots = useRef(new Map())
  const slotFor = (id) => {
    let s = slots.current.get(id)
    if (!s) {
      s = newSlot()
      slots.current.set(id, s)
    }
    return s
  }

  useFrame((state, delta) => {
    const pop = popRef.current
    const t = timeRef?.current ?? state.clock.elapsedTime
    if (!pop) return
    const kin = pop.organisms.slice(1)
    const global = crystalRef.current?.level ?? 0
    const k = 1 - Math.exp(-Math.min(0.1, delta) * 2.2)
    const targets = kin.map((org) => ({ ...kinPlacement(org, null, t), scale: Math.max(0.05, kinScale(org.age)) }))
    relaxKin(targets)
    kin.forEach((org, i) => {
      const s = slotFor(org.id)
      const p = s.place.current
      const at = targets[i]
      const target = kinScale(org.age)
      if (s.generation !== org.generation) {
        /* First sight: appear in place. Re-birth: snap to the new seat, grow in. */
        p.scale = s.generation === -1 ? target : 0
        p.snap = true
        s.generation = org.generation
      }
      p.x = at.x
      p.z = at.z
      p.lift = at.lift
      p.spin = org.spin
      p.phase = org.phase
      p.pulse = kinTempo(org.archetypeSeed, org.generation).pulse
      p.scale += (target - p.scale) * k
      s.crystal.current.level = kinCrystalLevel(global, org.age)
    })
  })

  return (
    <group>
      {snapshot.organisms.slice(1).map((org) => (
        <KinBody
          key={org.id}
          org={org}
          life={lives[org.id]}
          slot={slotFor(org.id)}
          envRef={envRef}
          temperature={temperature}
          layers={layers}
          timeRef={timeRef}
          crystalLevel={crystalLevel}
        />
      ))}
    </group>
  )
}
