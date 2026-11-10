import { memo, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import CrystalBody from './CrystalBody.jsx'
import ExploreLifeScatter from '../finalForm/ExploreLifeScatter.jsx'
import { mapLifeToExploreVisual } from '../finalForm/exploreLifeAdapter.js'
import { EXP05_LAB_DEFAULTS } from '../finalForm/exp05LabParams.js'
import { useHabitatKin } from './useHabitatKin.js'
import { habitatHeight } from './habitatField.js'
import { formEmergence, worldBodyScale, WORLD_KIN_AGES, kinCrystalLevel, kinPlacement, kinPlacementAround, kinScale, kinScaleHeld, kinTempo, kinTint, stepKinPhysics } from './habitatKin.js'
import { KIN_ANCHORS, KIN_ROAM, pickHome, speciesFor, UNWITNESSED_HUSK_SECONDS, WORLD_KIN_COUNT } from './worldOpening.js'
import { freshRemainsPoints } from './Remains.jsx'

/** Population size incl. the hero (organism 0 is not drawn here). */
const KIN_COUNT = 6

function newSlot() {
  return {
    generation: -1,
    place: { current: { x: 0, z: 0, lift: 0, spin: 0, phase: 0, pulse: 0.5, scale: 0, snap: true, direct: true, contacts: [], body: null } },
    phys: null,
    home: null,
    anchor: null,
    settled: false,
    crystal: { current: { level: 0 } },
    death: { current: { t: -1 } },
  }
}

const KinBody = memo(function KinBody({ org, life, slot, envRef, temperature, layers, timeRef, crystalLevel, world, ended, morphologyType }) {
  const tint = useMemo(() => kinTint(org.archetypeSeed, org.generation), [org.archetypeSeed, org.generation])
  /* Body and petals share one surface: the same morphology amplitude, which
     (World Final) emerges with age so young lives look alike. */
  const lobe = (org.lobe ?? 1) * (world ? formEmergence(org.age) : 1)
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
  /* A held (focused) life that reached its end becomes a husk like the hero. */
  const bodyLife = useMemo(() => (life && ended ? { ...life, dead: true, age: 1 } : life), [life, ended])
  if (!life || (life.dead && !ended)) return null
  /* World Final: the body grows its own petals on its skin (CrystalBody). */
  const showPetals = !world && !ended && layers?.petals !== false && visual && !visual.isDead && (visual.petalPlan?.petalCount ?? 0) > 0
  return (
    <CrystalBody
      life={bodyLife}
      crystalRef={slot.crystal}
      envRef={envRef}
      temperature={temperature}
      morphologyType={morphologyType}
      lobeAmplitude={lobe}
      layers={layers}
      timeRef={timeRef}
      placeRef={slot.place}
      coreLight={Boolean(world)}
      tint={tint}
      deathRef={slot.death}
      world={world}
      selfId={org.id}
      responsive={Boolean(world)}
      glow={Boolean(world)}
    >
      {showPetals ? (
        <ExploreLifeScatter
          life={life}
          petalPlan={visual.petalPlan}
          morphStrength={1}
          deformationStrength={1}
          lobeAmplitude={lobe}
          morphologyType={morphologyType}
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
          colorA={tint.petal}
          colorB={visual.surface.colorB}
          rimColor={visual.surface.rimColor}
          useAgeClock={false}
          occludedByBody
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
export default function HabitatKin({ world = null, crystalRef, envRef, timeRef, heroRef, toneRef = null, temperature, moisture, turbulence, running, layers, crystalLevel }) {
  const environment = useMemo(() => ({ temperature, moisture, turbulence }), [temperature, moisture, turbulence])
  const controlRef = useRef({ hold: new Set(), release: new Set(), setAge: new Map() })
  if (world?.current) world.current.kinControl = controlRef.current
  const { popRef, snapshot, lives } = useHabitatKin({
    count: world ? WORLD_KIN_COUNT : KIN_COUNT,
    initialAges: world ? WORLD_KIN_AGES : null,
    playing: running,
    environment,
    controlRef,
  })
  const slots = useRef(new Map())
  const slotFor = (id) => {
    let s = slots.current.get(id)
    if (!s) {
      s = newSlot()
      slots.current.set(id, s)
    }
    return s
  }

  const dents = useRef(new Map())
  useFrame((state, delta) => {
    const pop = popRef.current
    if (!pop) return
    const t = timeRef?.current ?? state.clock.elapsedTime
    const kin = pop.organisms.slice(1)
    const global = crystalRef.current?.level ?? 0
    const k = 1 - Math.exp(-Math.min(0.1, delta) * 2.2)
    const dt = running ? Math.min(0.05, delta) : 0
    const w = world?.current
    /* World Final: the focused kin is held at its end so it can be witnessed. */
    /* World Final: every kin is held at its end and dies as a husk (so it can
       leave remains); the focused one waits for the viewer, the others settle
       to the seabed after a while — then a new life is born elsewhere. */
    if (w) {
      controlRef.current.hold.clear()
      for (const org of kin) controlRef.current.hold.add(org.id)
      w.settle = (id) => {
        const s = slots.current.get(id)
        if (!s || s.settled) return
        s.settled = true
        w.capture?.(id)
        controlRef.current.release.add(id)
      }
      if (!w.anchors) w.anchors = new Map()
    }
    const dimming = w?.dimming

    /* Targets from the sim + each body's own wander, then soft-body physics:
       they ease off as they near, touch, bounce gently, never pass through. */
    const bodies = []
    kin.forEach((org) => {
      const s = slotFor(org.id)
      const p = s.place.current
      /* When the witnessed life ends, the others drift out of sight. */
      const dying = Boolean(dimming?.id) && dimming.id === org.id
      const grown = w ? worldBodyScale(org.age) : org.ended ? kinScaleHeld(org.age) : kinScale(org.age)
      const target = grown * (dying ? 1 : 1 - (toneRef?.current?.dusk ?? 0))
      if (s.generation !== org.generation) {
        /* First sight: appear in place. Re-birth: new seat, grow in. */
        p.scale = s.generation === -1 ? target : 0
        s.phys = null
        s.home = [...org.position]
        s.settled = false
        if (w) {
          /* Born somewhere new: away from the other lives and fresh remains. */
          const occupied = [...w.anchors.entries()].filter(([id]) => id !== org.id).map(([, a]) => a)
          occupied.push(...freshRemainsPoints(world))
          s.anchor = s.generation === -1 && KIN_ANCHORS[org.id] ? [...KIN_ANCHORS[org.id]] : pickHome(org.id, org.generation, org.seed, occupied)
          w.anchors.set(org.id, s.anchor)
        }
        s.generation = org.generation
      }
      if (w && org.ended && w.focusId !== org.id && s.death.current.t > UNWITNESSED_HUSK_SECONDS) w.settle(org.id)
      s.death.current.t = org.ended ? (s.death.current.t < 0 ? 0 : s.death.current.t + Math.min(0.1, delta)) : -1
      p.scale += (target - p.scale) * k
      p.spin = org.spin
      p.phase = org.phase
      p.pulse = kinTempo(org.archetypeSeed, org.generation).pulse
      s.crystal.current.level = kinCrystalLevel(global, org.age)

      const anchor = w ? s.anchor : null
      const at = anchor ? kinPlacementAround(org, anchor, s.home, t, KIN_ROAM) : kinPlacement(org, null, t)
      const info = p.body ?? { centre: 3.3, radius: 1.35 }
      const sc = Math.max(0.05, p.scale)
      const ty = habitatHeight(at.x, at.z) + info.centre * sc + at.lift
      if (!s.phys) s.phys = { id: org.id, x: at.x, y: ty, z: at.z, vx: 0, vy: 0, vz: 0 }
      const b = s.phys
      b.tx = at.x
      b.ty = ty
      b.tz = at.z
      b.r = info.radius * sc
      b.floor = habitatHeight(b.x, b.z) + b.r * 1.05
      bodies.push(b)
    })
    const hero = heroRef?.current?.r ? { id: 'hero', ...heroRef.current } : null
    const contacts = stepKinPhysics(bodies, hero, dents.current, dt)
    if (heroRef?.current) heroRef.current.contacts = contacts.get('hero') ?? []

    kin.forEach((org) => {
      const s = slotFor(org.id)
      const p = s.place.current
      const b = s.phys
      const info = p.body ?? { centre: 3.3, radius: 1.35 }
      p.x = b.x
      p.z = b.z
      p.lift = b.y - habitatHeight(b.x, b.z) - info.centre * Math.max(0.05, p.scale)
      p.contacts = contacts.get(org.id) ?? []
      p.vel = [b.vx, b.vy, b.vz]
      /* Panel / reveal read this when the kin is focused. */
      if (w) {
        let info = w.kinInfo.get(org.id)
        if (!info) {
          info = {}
          w.kinInfo.set(org.id, info)
        }
        info.age = org.age
        info.stage = org.stage
        info.level = s.crystal.current.level
        info.ended = Boolean(org.ended)
        info.deathT = s.death.current.t
        info.generation = org.generation
        info.seed = org.seed
      }
    })
  })

  return (
    <group>
      {snapshot.organisms.slice(1).map((org) => (
        <KinBody
          key={org.id}
          org={org}
          morphologyType={world ? speciesFor(org.id, org.generation, org.seed) : org.morphologyType}
          life={lives[org.id]}
          slot={slotFor(org.id)}
          envRef={envRef}
          temperature={temperature}
          layers={layers}
          timeRef={timeRef}
          crystalLevel={crystalLevel}
          world={world}
          ended={Boolean(org.ended)}
        />
      ))}
    </group>
  )
}
