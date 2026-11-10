import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { createOutcropResources, createResidueResources } from './habitatGrowthBuild.js'
import { createEmberResources } from './emberCrystals.js'
import { createGroundMaterial } from './habitatTerrainBuild.js'

/*
 * Exp07 habitat growth: crystal outcrops (chamfered quartz with phantoms,
 * chips and frost-flower feet) and abstract residue in the organism's own
 * materials. Deliberately quiet so the body stays the focus.
 */
export default function HabitatGrowth({ crystalRef, toneRef = null, layers }) {
  const res = useMemo(() => {
    const sand = createGroundMaterial()
    return { outcrops: createOutcropResources(), residue: createResidueResources(), sand, ember: createEmberResources(sand) }
  }, [])

  useEffect(
    () => () => {
      res.outcrops.dispose()
      res.residue.dispose()
      res.ember.dispose()
      res.sand.dispose()
    },
    [res],
  )

  useFrame((state) => {
    /* The whole habitat answers the same medium: outcrops brighten as it freezes. */
    const level = crystalRef?.current?.level ?? 0
    res.outcrops.crystalMat.emissiveIntensity = 0.02 + level * 0.05
    res.outcrops.beadMat.emissiveIntensity = 0.05 + level * 0.1
    /* Crystals take the water's tone: icy when cold, blushing when warm. */
    if (toneRef?.current) res.outcrops.crystalMat.color.copy(toneRef.current.crystal)
    /* Ember druses keep their warmth; they glow a little more as it freezes. */
    res.ember.crystalMat.userData.uniforms.uEmberGlow.value = 1 + level * 0.5
    /* Their mounds are the same sand as the ground. */
    const sand = res.sand
    sand.userData.uniforms.uTime.value = state.clock.elapsedTime
    const tone = toneRef?.current
    if (tone) {
      const film = tone.film ?? 0
      sand.color.copy(tone.ground)
      sand.userData.uniforms.uCaustic.value = tone.caustic
      sand.userData.uniforms.uFilm.value = film
      sand.iridescence = 0.08 + film * 1.05
      sand.roughness = 0.8 - film * 0.32
    }
  })

  const showOutcrops = layers?.outcrops !== false
  const showResidue = layers?.flora !== false
  return (
    <group>
      <primitive object={res.outcrops.phantoms} visible={showOutcrops} dispose={null} />
      <primitive object={res.outcrops.crystals} visible={showOutcrops} dispose={null} />
      <primitive object={res.outcrops.beads} visible={showOutcrops} dispose={null} />
      <primitive object={res.ember.mound} dispose={null} />
      <primitive object={res.ember.pools} visible={showOutcrops} dispose={null} />
      <primitive object={res.ember.crystals} visible={showOutcrops} dispose={null} />
      <primitive object={res.residue.blobs} visible={showResidue} dispose={null} />
      <primitive object={res.residue.beads} visible={showResidue} dispose={null} />
      <primitive object={res.residue.flakes} visible={showResidue} dispose={null} />
    </group>
  )
}
