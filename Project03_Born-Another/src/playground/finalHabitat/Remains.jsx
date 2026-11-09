import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { habitatHeight } from './habitatField.js'
import { MAX_REMAINS, remainsPhase } from './worldOpening.js'
import { styleMaterialParams } from './crystalShapes.js'
import { patchSediment, SEDIMENT_SAND, sedimentUniforms } from './sediment.js'

/*
 * World Final: what is left of each life. When a life ends and is let go,
 * its husk (skin + crystals, frozen as it was) drifts down and settles on the
 * seabed, half sunk, then is slowly covered by sand. Only the most recent
 * remains are kept. Cheap materials (no transmission): they are scenery now.
 */

const SKIN = new THREE.Color('#d9d1dc')
const SAND = SEDIMENT_SAND
const _box = new THREE.Box3()
const _q = new THREE.Quaternion()
const _axis = new THREE.Vector3()

function createSkinMaterial(uniforms) {
  const material = new THREE.MeshStandardMaterial({ color: SKIN.clone(), roughness: 0.72, metalness: 0, envMapIntensity: 0.7 })
  patchSediment(material, uniforms)
  return material
}

function createRemainsCrystalMaterial(style, uniforms) {
  const c = style?.crystal ?? {}
  const material = new THREE.MeshPhysicalMaterial({
    ...styleMaterialParams({ color: c.color ?? '#f3f0ff', sheenColor: c.sheenColor ?? '#ffffff' }),
    roughness: 0.28,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.2,
    iridescence: Math.min(0.6, c.iridescence ?? 0.5),
    sheen: c.sheen ? 0.6 : 0,
    envMapIntensity: 1.3,
  })
  patchSediment(material, uniforms)
  return material
}

/** Lowest world y of an object (after its current transform). */
function lowestY(object) {
  object.updateMatrixWorld(true)
  _box.setFromObject(object)
  return { min: _box.min.y, height: _box.max.y - _box.min.y }
}

export default function RemainsField({ world }) {
  const rootRef = useRef(null)
  const items = useRef([])

  useEffect(() => {
    const w = world.current
    w.remains = items.current
    /* Freeze a life's current body into remains (returns false if unknown). */
    w.capture = (id) => {
      const root = rootRef.current
      const snap = w.bodies.get(id)?.snapshot?.()
      if (!root || !snap) return false
      const group = new THREE.Group()
      snap.matrix.decompose(group.position, group.quaternion, group.scale)
      const uniforms = sedimentUniforms(0, 1)
      const skinMat = createSkinMaterial(uniforms)
      const skin = new THREE.Mesh(snap.geometry, skinMat)
      group.add(skin)
      let crystals = null
      let crystalMat = null
      if (snap.crystalCount > 0) {
        crystalMat = createRemainsCrystalMaterial(snap.style, uniforms)
        crystals = new THREE.InstancedMesh(snap.crystalGeometry, crystalMat, snap.crystalCount)
        crystals.instanceMatrix.array.set(snap.crystalMatrices)
        crystals.instanceMatrix.needsUpdate = true
        crystals.frustumCulled = false
        group.add(crystals)
      }
      root.add(group)
      /* Resting pose: tipped over a little, half sunk into the sand. */
      const from = { position: group.position.clone(), quaternion: group.quaternion.clone() }
      _axis.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize()
      _q.setFromAxisAngle(_axis, 0.35 + Math.random() * 0.5)
      const restQ = group.quaternion.clone().premultiply(_q)
      group.quaternion.copy(restQ)
      const ground = habitatHeight(group.position.x, group.position.z)
      const { min, height } = lowestY(group)
      const restY = group.position.y + (ground - height * 0.22 - min)
      group.quaternion.copy(from.quaternion)
      uniforms.uGround.value = ground
      uniforms.uHeight.value = Math.max(0.2, height)
      items.current.push({
        id,
        species: snap.species,
        group,
        skin,
        crystals,
        skinMat,
        crystalMat,
        uniforms,
        crystalGeometry: snap.crystalGeometry,
        from,
        restQ,
        restY,
        height,
        t: 0,
        x: group.position.x,
        z: group.position.z,
      })
      /* Only the most recent remains stay. */
      while (items.current.length > MAX_REMAINS) {
        const old = items.current.shift()
        root.remove(old.group)
        old.skin.geometry.dispose()
        old.skinMat.dispose()
        old.crystalMat?.dispose()
        old.crystalGeometry?.dispose()
      }
      return true
    }
    return () => {
      w.capture = null
    }
  }, [world])

  useEffect(
    () => () => {
      for (const it of items.current) {
        it.skin.geometry.dispose()
        it.skinMat.dispose()
        it.crystalMat?.dispose()
        it.crystalGeometry?.dispose()
      }
    },
    [],
  )

  useFrame((_, delta) => {
    const dt = Math.min(0.1, delta)
    for (const it of items.current) {
      it.t += dt
      const { settle, bury } = remainsPhase(it.t)
      /* Settles, then sinks a little as the floor takes it in. */
      it.group.position.y = THREE.MathUtils.lerp(it.from.position.y, it.restY, settle) - it.height * 0.18 * bury
      it.group.quaternion.slerpQuaternions(it.from.quaternion, it.restQ, settle)
      it.skinMat.color.copy(SKIN).lerp(SAND, 0.1 + 0.25 * bury)
      it.uniforms.uBury.value = bury
    }
  })

  return <group ref={rootRef} />
}

/** Positions of remains still near the surface of the sand (birth spacing). */
export function freshRemainsPoints(world) {
  return (world?.current?.remains ?? []).filter((r) => r.t < 200).map((r) => [r.x, r.z])
}
