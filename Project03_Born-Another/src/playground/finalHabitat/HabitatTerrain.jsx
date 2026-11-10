import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  buildGlints,
  buildGroundGeometry,
  buildThroatGeometry,
  buildVeilGeometry,
  createGroundMaterial,
  createSplashResources,
  createVeilMaterial,
  planSplashes,
  updateSplashes,
} from './habitatTerrainBuild.js'

/**
 * Exp07 ground at World Final scale: satin sand on a concentric grid, two
 * translucent iridescent veil layers over the near + mid dunes, sediment
 * glints, and glass splash crowns rising from the sand.
 */
export default function HabitatTerrain({ timeRef, envRef, toneRef = null, pixelScale = 1, layers }) {
  const res = useMemo(() => {
    const ground = buildGroundGeometry()
    const throat = buildThroatGeometry()
    const groundMat = createGroundMaterial()
    const veils = [0, 1].map((layer) => ({
      geometry: buildVeilGeometry(layer),
      material: createVeilMaterial(layer, { fade: 0.45 }),
    }))
    const glints = buildGlints()
    const crowns = planSplashes()
    const splashes = createSplashResources(crowns)
    return { ground, throat, groundMat, veils, glints, crowns, splashes }
  }, [])

  useEffect(
    () => () => {
      res.ground.dispose()
      res.throat.dispose()
      res.groundMat.dispose()
      for (const v of res.veils) {
        v.geometry.dispose()
        v.material.dispose()
      }
      res.glints.geometry.dispose()
      res.glints.material.dispose()
      res.splashes.droplet.dispose()
      res.splashes.stalk.dispose()
      res.splashes.glass.dispose()
      res.splashes.drops.dispose()
      res.splashes.stalks.dispose()
    },
    [res],
  )

  useEffect(() => {
    res.glints.material.uniforms.uScale.value = pixelScale
  }, [res, pixelScale])

  useFrame((state) => {
    const time = timeRef?.current ?? 0
    res.glints.material.uniforms.uTime.value = time
    /* Light keeps moving even when the life clock is paused. */
    res.groundMat.userData.uniforms.uTime.value = state.clock.elapsedTime
    /* Sand, caustics and veils answer the environment tone. */
    const tone = toneRef?.current
    if (tone) {
      const film = tone.film ?? 0
      res.groundMat.color.copy(tone.ground)
      res.groundMat.userData.uniforms.uCaustic.value = tone.caustic
      res.groundMat.userData.uniforms.uFilm.value = film
      res.groundMat.iridescence = 0.08 + film * 1.05
      res.groundMat.roughness = 0.8 - film * 0.32
      const range = res.groundMat.iridescenceThicknessRange
      range[0] = 140
      range[1] = 260 + film * 860
      for (const v of res.veils ?? []) {
        v.material.userData.uniforms.uVeilFade.value = tone.veilFade
        v.material.userData.uniforms.uFilm.value = film
        v.material.iridescence = 0.25 + film * 0.75
      }
    }
    updateSplashes(res.crowns, res.splashes, time, envRef?.current?.turbulence ?? 0)
  })

  const showVeils = layers?.veils !== false
  return (
    <group>
      <mesh geometry={res.ground} material={res.groundMat} dispose={null} />
      <mesh geometry={res.throat} material={res.groundMat} dispose={null} />
      {res.veils.map((v, i) => (
        <mesh
          key={i}
          geometry={v.geometry}
          material={v.material}
          renderOrder={1 + i}
          visible={showVeils}
          dispose={null}
        />
      ))}
      <points geometry={res.glints.geometry} material={res.glints.material} frustumCulled={false} dispose={null} />
      <group visible={layers?.splashes !== false}>
        <primitive object={res.splashes.stalks} dispose={null} />
        <primitive object={res.splashes.drops} dispose={null} />
      </group>
    </group>
  )
}
