import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { createOutcropResources, createResidueResources } from './habitatGrowthBuild.js'

/*
 * Exp07 habitat growth: crystal outcrops (chamfered quartz with phantoms,
 * chips and frost-flower feet) and abstract residue in the organism's own
 * materials. Deliberately quiet so the body stays the focus.
 */
export default function HabitatGrowth({ crystalRef, toneRef = null, layers }) {
  const res = useMemo(() => ({ outcrops: createOutcropResources(), residue: createResidueResources() }), [])

  useEffect(
    () => () => {
      res.outcrops.dispose()
      res.residue.dispose()
    },
    [res],
  )

  useFrame(() => {
    /* The whole habitat answers the same medium: outcrops brighten as it freezes. */
    const level = crystalRef?.current?.level ?? 0
    res.outcrops.crystalMat.emissiveIntensity = 0.02 + level * 0.05
    res.outcrops.beadMat.emissiveIntensity = 0.05 + level * 0.1
    /* Crystals take the water's tone: icy when cold, blushing when warm. */
    if (toneRef?.current) res.outcrops.crystalMat.color.copy(toneRef.current.crystal)
  })

  const showOutcrops = layers?.outcrops !== false
  const showResidue = layers?.flora !== false
  return (
    <group>
      <primitive object={res.outcrops.phantoms} visible={showOutcrops} dispose={null} />
      <primitive object={res.outcrops.crystals} visible={showOutcrops} dispose={null} />
      <primitive object={res.outcrops.beads} visible={showOutcrops} dispose={null} />
      <primitive object={res.residue.blobs} visible={showResidue} dispose={null} />
      <primitive object={res.residue.beads} visible={showResidue} dispose={null} />
      <primitive object={res.residue.flakes} visible={showResidue} dispose={null} />
    </group>
  )
}
