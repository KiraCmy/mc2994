/**
 * Shared helpers: project unit-sphere samples onto World's deformed membrane.
 */
import * as THREE from 'three'
import {
  deformRadialPoint,
  formMorphAmount,
  morphRestPoint,
  morphRestRadius,
} from '../../worldv2/life/worldLifeAdapter.js'
import { sampleTurbulenceFromLife } from '../../worldv2/turbulenceField.js'

const _dir = new THREE.Vector3()

/**
 * @returns {{ position: number[], normal: number[] } | null}
 */
export function deformDirectionToSurface(world, life, direction) {
  if (!world || !life || !direction) return null
  const nx = Number(direction[0]) || 0
  const ny = Number(direction[1]) || 0
  const nz = Number(direction[2]) || 0
  const len = Math.hypot(nx, ny, nz) || 1
  _dir.set(nx / len, ny / len, nz / len)
  const morph = formMorphAmount(life.variables?.growth ?? 1)
  /* world.radiusAt requires a THREE.Vector3 (.x/.y/.z + .dot). */
  const restRadius = world.radiusAt(_dir)
  if (!Number.isFinite(restRadius)) return null
  const shaped = morphRestRadius(restRadius, morph)
  const rest = [_dir.x * shaped, _dir.y * shaped, _dir.z * shaped]
  const shapedPoint = morphRestPoint(rest[0], rest[1], rest[2], morph)
  const extra = sampleTurbulenceFromLife(
    shapedPoint[0],
    shapedPoint[1],
    shapedPoint[2],
    life,
  )
  const position = deformRadialPoint(
    shapedPoint[0],
    shapedPoint[1],
    shapedPoint[2],
    life.outputs?.form?.localDeformations ?? [],
    extra,
  )
  const plen = Math.hypot(position[0], position[1], position[2]) || 1
  return {
    position,
    normal: [position[0] / plen, position[1] / plen, position[2] / plen],
  }
}
