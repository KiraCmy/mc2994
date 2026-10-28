/**
 * Exp03 Study 01 — Crystal Morphology Lab field.
 * Seats A/B/C static plans on the shared Exp05 membrane growth site.
 */
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  createExp05RadiusAt,
  evaluateExp05SurfacePoint,
} from '../finalForm/exp05SurfaceEvaluator.js'
import { estimateRadiusAtMean } from '../finalForm/exp05MorphologyCalibration.js'
import {
  createClusterShardGeometrySet,
  createCrystalApronGeometry,
  createMembraneTissueGeometrySet,
  createTransitionBladeGeometrySet,
} from './crystalClusterGeometry.js'
import { createExp03CrystalMaterial } from './crystalClusterMaterial.js'
import { buildMorphologyLabPlan } from './morphologyLabPlans.js'
import {
  EXP03_MORPHOLOGY_LAB_ANCHOR,
  normalizeExp03MorphologyMode,
} from './morphologyLabTypes.js'

function clamp01(v) {
  return Math.min(1, Math.max(0, Number(v) || 0))
}

function seatMorphologyPlan(
  life,
  plan,
  { lobeAmplitude = 1, morphologyType } = {},
) {
  if (!life || !plan?.pieces?.length) {
    return { pieces: [], mound: null, seat: null }
  }

  const seed = life.seed ?? 1
  const radiusAt = createExp05RadiusAt(seed, morphologyType)
  const restMean = estimateRadiusAtMean(radiusAt)
  const direction = plan.anchor.direction

  const sample = evaluateExp05SurfacePoint(direction, life, radiusAt, {
    finiteDifferenceNormal: true,
    morphStrength: 1,
    deformationStrength: 0,
    lobeAmplitude,
    restMean,
    temperature: 0.5,
    sculpturalStrength: 0,
  })
  if (!sample?.position) return { pieces: [], mound: null, seat: null }

  const surface = new THREE.Vector3().fromArray(sample.position)
  const faceOut = sample.normal
    ? new THREE.Vector3().fromArray(sample.normal).normalize()
    : new THREE.Vector3().fromArray(direction).normalize()

  const sharedRoot = surface.clone().addScaledVector(faceOut, -0.02)
  const basisHelper =
    Math.abs(faceOut.y) < 0.9
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0)
  const tangent = new THREE.Vector3()
    .crossVectors(basisHelper, faceOut)
    .normalize()
  const bitangent = new THREE.Vector3()
    .crossVectors(faceOut, tangent)
    .normalize()
  const yUp = new THREE.Vector3(0, 1, 0)

  const primaryAxes = []
  const seated = []

  for (const piece of plan.pieces) {
    let axis = new THREE.Vector3().fromArray(piece.axis).normalize()
    const outwardDot = axis.dot(faceOut)
    if (outwardDot < -0.1) axis = axis.reflect(faceOut).normalize()
    else if (outwardDot < 0.05 && piece.kind === 'crystal') {
      axis = axis.clone().addScaledVector(faceOut, 0.2).normalize()
    }

    if (piece.role === 'primary') primaryAxes.push(axis.clone())

    let root = sharedRoot.clone()
    if (piece.attachAlong != null && primaryAxes.length > 0) {
      const host =
        primaryAxes[
          Math.abs(Number(String(piece.id).replace(/\D/g, '')) || 0) %
            primaryAxes.length
        ] ?? faceOut
      root = sharedRoot
        .clone()
        .addScaledVector(host, piece.length * clamp01(piece.attachAlong) * 0.7)
        .addScaledVector(axis, -(piece.nest || 0.01))
    } else {
      const radial = piece.radial || 0
      if (radial > 0) {
        root = root
          .clone()
          .addScaledVector(tangent, Math.cos(piece.radialAngle || 0) * radial)
          .addScaledVector(bitangent, Math.sin(piece.radialAngle || 0) * radial)
      }
      root.addScaledVector(faceOut, -(piece.nest || 0.01))
      if (piece.layerLift) root.addScaledVector(faceOut, piece.layerLift)
    }

    if (piece.kind === 'crystal') {
      root.addScaledVector(axis, piece.length * 0.06)
    } else if (piece.kind === 'transition') {
      root.addScaledVector(axis, piece.length * 0.03)
    }

    let quaternion = new THREE.Quaternion().setFromUnitVectors(yUp, axis)
    quaternion.multiply(
      new THREE.Quaternion().setFromAxisAngle(yUp, piece.roll || 0),
    )

    let scale
    if (piece.kind === 'tissue') {
      const zUp = new THREE.Vector3(0, 0, 1)
      quaternion = new THREE.Quaternion().setFromUnitVectors(zUp, axis)
      quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(axis, piece.roll || 0),
      )
      scale = new THREE.Vector3(piece.width, piece.depth, piece.length)
    } else if (piece.kind === 'transition') {
      scale = new THREE.Vector3(piece.width, piece.length, piece.depth)
    } else {
      /* Crystal unit radius ≈ 1 → visual diameter = 2 * scale.x */
      scale = new THREE.Vector3(
        piece.width * 0.5,
        piece.length,
        piece.depth * 0.5,
      )
    }

    seated.push({
      key: `${plan.mode}-${piece.id}`,
      kind: piece.kind,
      role: piece.role,
      profileIndex: piece.profileIndex ?? 0,
      position: root,
      quaternion,
      scale,
      tint: piece.tint ?? 0.3,
    })
  }

  const moundQuat = new THREE.Quaternion().setFromUnitVectors(yUp, faceOut)
  const moundScale = plan.extent * 0.85
  const mound = {
    position: surface.clone().addScaledVector(faceOut, -0.006),
    quaternion: moundQuat,
    scale: new THREE.Vector3(moundScale, moundScale * 0.65, moundScale),
  }

  const seat = {
    position: surface.clone(),
    normal: faceOut.clone(),
  }

  return { pieces: seated, mound, seat }
}

export default function MorphologyLabField({
  life,
  morphologyMode,
  lobeAmplitude = 1,
  morphologyType,
  onSeatReady = null,
}) {
  const crystalGeos = useMemo(() => createClusterShardGeometrySet(), [])
  const tissueGeos = useMemo(() => createMembraneTissueGeometrySet(), [])
  const transitionGeos = useMemo(() => createTransitionBladeGeometrySet(), [])
  const moundGeometry = useMemo(
    () => createCrystalApronGeometry({ lobes: 7, seed: 29 }),
    [],
  )
  const materialPoolRef = useRef(new Map())
  const moundMaterial = useMemo(
    () =>
      createExp03CrystalMaterial({
        tint: 0.12,
        opacity: 0.9,
        layer: 'apron',
      }),
    [],
  )

  const mode = normalizeExp03MorphologyMode(morphologyMode)
  const plan = useMemo(
    () =>
      buildMorphologyLabPlan(
        mode,
        life?.seed ?? 1,
        EXP03_MORPHOLOGY_LAB_ANCHOR,
      ),
    [mode, life?.seed],
  )

  const { pieces, mound, seat } = useMemo(
    () =>
      seatMorphologyPlan(life, plan, {
        lobeAmplitude,
        morphologyType,
      }),
    [life, plan, lobeAmplitude, morphologyType],
  )

  useEffect(() => {
    if (seat && typeof onSeatReady === 'function') {
      onSeatReady(seat)
    }
  }, [seat, onSeatReady, mode])

  const pool = materialPoolRef.current
  for (const entry of pieces) {
    if (!pool.has(entry.key)) {
      pool.set(
        entry.key,
        createExp03CrystalMaterial({
          tint: entry.tint,
          opacity: 1,
          layer: entry.kind,
        }),
      )
    }
  }

  useEffect(
    () => () => {
      for (const geometry of crystalGeos) geometry.dispose()
      for (const geometry of tissueGeos) geometry.dispose()
      for (const geometry of transitionGeos) geometry.dispose()
      moundGeometry.dispose()
      moundMaterial.dispose()
      for (const material of materialPoolRef.current.values()) {
        material.dispose()
      }
      materialPoolRef.current.clear()
    },
    [crystalGeos, tissueGeos, transitionGeos, moundGeometry, moundMaterial],
  )

  const pickGeometry = (entry) => {
    if (entry.kind === 'tissue') {
      return tissueGeos[entry.profileIndex % tissueGeos.length]
    }
    if (entry.kind === 'transition') {
      return transitionGeos[entry.profileIndex % transitionGeos.length]
    }
    return crystalGeos[entry.profileIndex % crystalGeos.length]
  }

  const renderOrderFor = (role) => {
    if (role === 'tissue') return 2
    if (role === 'transition') return 3
    return 4
  }

  return (
    <group name={`exp03-morphology-lab-${mode}`}>
      {mound ? (
        <mesh
          geometry={moundGeometry}
          material={moundMaterial}
          position={mound.position}
          quaternion={mound.quaternion}
          scale={mound.scale}
          frustumCulled={false}
          renderOrder={1}
        />
      ) : null}
      {pieces.map((entry) => {
        const material = pool.get(entry.key)
        const geometry = pickGeometry(entry)
        if (!material || !geometry) return null
        return (
          <mesh
            key={entry.key}
            geometry={geometry}
            material={material}
            position={entry.position}
            quaternion={entry.quaternion}
            scale={entry.scale}
            frustumCulled={false}
            renderOrder={renderOrderFor(entry.role)}
          />
        )
      })}
    </group>
  )
}
