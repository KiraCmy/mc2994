import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import {
  createCrystalMaterial,
  createHabitGeometry,
  CRYSTAL_STYLES,
  orientAlong,
  styleMaterialParams,
} from './crystalShapes.js'
import { SPIRES, spireParts, frostParts, NEEDLE_SHOULDER } from './crystalSpires.js'

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

/* Frost tint per lineage: icy white, with a breath of the mineral's colour. */
const FROST_TINT = { quartz: '#eef6ff', selenite: '#f6f3ea', calcite: '#fff0e2' }

/** A slim four-sided bipyramid along +Y, base 0 → tip 1 (a hoarfrost needle). */
function createNeedleGeometry() {
  const k = NEEDLE_SHOULDER
  const pos = []
  const ring = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ].map(([x, z]) => [x * 0.5, k, z * 0.5])
  for (let i = 0; i < 4; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % 4]
    pos.push(0, 0, 0, ...b, ...a)
    pos.push(...a, ...b, 0, 1, 0)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

/*
 * Frost material: no transmission (thousands of tiny pieces — they read as
 * glitter, not glass). Flat facets, iridescent clearcoat, and a glint: a facet
 * that turns square to the eye flares, so the crown twinkles as you move.
 */
function createFrostMaterial() {
  const material = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.18,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    iridescence: 0.7,
    iridescenceIOR: 1.35,
    sheen: 0.4,
    sheenColor: new THREE.Color('#dfeaff'),
    emissive: new THREE.Color('#b8c8e0'),
    emissiveIntensity: 0.08,
    envMapIntensity: 2.4,
    flatShading: true,
  })
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      {
        vec3 vd = normalize(vViewPosition);
        float face = abs(dot(normal, vd));
        float glint = pow(face, 60.0);
        totalEmissiveRadiance += diffuseColor.rgb * (glint * 1.6 + pow(1.0 - face, 3.0) * 0.18);
      }`,
    )
  }
  material.customProgramCacheKey = () => 'exp07-frost-v1'
  return material
}

function buildFrostMesh(entries) {
  const total = entries.reduce((n, e) => n + e.parts.length, 0)
  if (!total) return null
  const mesh = new THREE.InstancedMesh(createNeedleGeometry(), createFrostMaterial(), total)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const s = new THREE.Vector3()
  const axis = new THREE.Vector3()
  const col = new THREE.Color()
  const white = new THREE.Color('#ffffff')
  let i = 0
  for (const { mineral, parts } of entries) {
    const tint = new THREE.Color(FROST_TINT[mineral] ?? '#ffffff')
    for (const part of parts) {
      axis.set(...part.dir)
      orientAlong(q, axis, part.spin)
      mesh.setMatrixAt(i, m.compose(p.set(...part.p), q, s.set(...part.s)))
      col.copy(tint).lerp(white, part.tone * 0.6).multiplyScalar(0.85 + part.tone * 0.3)
      mesh.setColorAt(i, col)
      i++
    }
  }
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.computeBoundingSphere()
  mesh.name = 'spires-frost'
  return mesh
}

export function buildSpireMeshes() {
  const frost = []
  const groups = Object.fromEntries(MINERALS.map((m) => [m, []]))
  for (const spire of SPIRES) {
    const { mineral, parts, segs } = spireParts(spire)
    groups[mineral].push(...parts)
    frost.push({ mineral, parts: frostParts(spire, segs) })
  }
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const s = new THREE.Vector3()
  const axis = new THREE.Vector3()
  const meshes = MINERALS.filter((mineral) => groups[mineral].length).map((mineral) => {
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
  const frostMesh = buildFrostMesh(frost)
  if (frostMesh) meshes.push(frostMesh)
  return meshes
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
