import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import {
  createCrystalMaterial,
  createHabitGeometry,
  CRYSTAL_STYLES,
  orientAlong,
  styleMaterialParams,
} from './crystalShapes.js'
import { SPIRES, spireParts } from './crystalSpires.js'

/*
 * World Final: tall crystal spires grown out of ancient remains (see
 * crystalSpires.js). One instanced mesh per mineral, built once; static
 * scenery that the water's fog swallows with distance.
 */

const MINERALS = ['quartz', 'selenite', 'calcite']

function spireMaterial(mineral) {
  const style = CRYSTAL_STYLES[mineral]
  const c = style.crystal
  return createCrystalMaterial({
    ...styleMaterialParams(c),
    /* Old, deep, a little clouded: thicker glass, softer fire, a faint inner light. */
    thickness: 1.4,
    attenuationDistance: (c.attenuationDistance ?? 2) * 2.2,
    dispersion: Math.min(0.5, c.dispersion ?? 0.35),
    iridescence: Math.min(0.55, c.iridescence ?? 0.5),
    emissiveIntensity: 0.12,
    envMapIntensity: 2.2,
    /* Satin selenite stays milky but lets the water through at this size. */
    ...(mineral === 'selenite' ? { transmission: 0.78, roughness: 0.22 } : null),
  })
}

export function buildSpireMeshes() {
  const groups = Object.fromEntries(MINERALS.map((m) => [m, []]))
  for (const spire of SPIRES) {
    const { mineral, parts } = spireParts(spire)
    groups[mineral].push(...parts)
  }
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const s = new THREE.Vector3()
  const axis = new THREE.Vector3()
  return MINERALS.filter((mineral) => groups[mineral].length).map((mineral) => {
    const list = groups[mineral]
    const mesh = new THREE.InstancedMesh(createHabitGeometry(CRYSTAL_STYLES[mineral].habit), spireMaterial(mineral), list.length)
    list.forEach((part, i) => {
      axis.set(...part.dir)
      orientAlong(q, axis, part.spin)
      mesh.setMatrixAt(i, m.compose(p.set(...part.p), q, s.set(...part.s)))
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    mesh.name = `spires-${mineral}`
    return mesh
  })
}

export default function CrystalSpires() {
  const meshes = useMemo(() => buildSpireMeshes(), [])
  useEffect(
    () => () => {
      for (const mesh of meshes) {
        mesh.geometry.dispose()
        mesh.material.dispose()
        mesh.dispose?.()
      }
    },
    [meshes],
  )
  return (
    <group>
      {meshes.map((mesh) => (
        <primitive key={mesh.name} object={mesh} />
      ))}
    </group>
  )
}
