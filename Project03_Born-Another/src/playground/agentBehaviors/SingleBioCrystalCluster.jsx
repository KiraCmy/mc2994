/**
 * Exp03 Study 01 — mineral formation with optional agent growth scales.
 * Convex polyhedral crystals; face-aware secondary/tertiary attachment;
 * dense micro carpet at the membrane root. Geometry built once; growth
 * only remaps mesh scale (no CSG / per-frame rebuild).
 */
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  createExp05RadiusAt,
  evaluateExp05SurfacePoint,
} from '../finalForm/exp05SurfaceEvaluator.js'
import { estimateRadiusAtMean } from '../finalForm/exp05MorphologyCalibration.js'
import {
  createClusterShardGeometry,
  EXP03_CRYSTAL_PROFILES,
} from './crystalClusterGeometry.js'
import { estimateCrystalRadiusAt } from './crystalPolyhedronGeometry.js'
import {
  bindExp03CrystalLayeredEnvMaps,
  createExp03CrystalLayeredMaterials,
  prepareExp03CrystalGeometry,
} from './crystalClusterMaterial.js'
import { EXP03_MORPHOLOGY_DEFAULTS } from './crystalMorphologyParams.js'
import { planSingleBioCrystalPieces } from './singleBioCrystalPlan.js'

function clamp01(v) {
  return Math.min(1, Math.max(0, Number(v) || 0))
}

/**
 * Rendered scale factor = sim progress (linear).
 * Do not ease/smoothstep here — that made inspector progress look larger than geometry.
 */
function growthDisplay(g) {
  return clamp01(g)
}

function buildCrystalTransforms(
  life,
  {
    lobeAmplitude = 1,
    morphologyType,
    morphology = EXP03_MORPHOLOGY_DEFAULTS,
    planSeed = null,
  } = {},
) {
  if (!life) {
    return { pieces: [], seat: null, plan: [] }
  }

  const membraneSeed = life.seed ?? 1
  const seed = planSeed != null ? planSeed : membraneSeed
  const { site, plan } = planSingleBioCrystalPieces(seed, morphology)
  const radiusAt = createExp05RadiusAt(membraneSeed, morphologyType)
  const restMean = estimateRadiusAtMean(radiusAt)

  const sample = evaluateExp05SurfacePoint(site.direction, life, radiusAt, {
    finiteDifferenceNormal: true,
    morphStrength: 1,
    deformationStrength: 0,
    lobeAmplitude,
    restMean,
    temperature: 0.5,
    sculpturalStrength: 0,
  })
  if (!sample?.position) return { pieces: [], seat: null, plan }

  const surface = new THREE.Vector3().fromArray(sample.position)
  const faceOut = sample.normal
    ? new THREE.Vector3().fromArray(sample.normal).normalize()
    : new THREE.Vector3().fromArray(site.direction).normalize()

  /*
   * Seat on the membrane face — shallow single embed only.
   * (Previous double-embed buried most of the hull inside the body.)
   */
  const embed = 0.028
  const sharedRoot = surface.clone().addScaledVector(faceOut, -embed)

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

  /** @type {Map<string, { root: THREE.Vector3, axis: THREE.Vector3, length: number, width: number, depth: number }>} */
  const placed = new Map()
  const pieces = []

  for (const piece of plan) {
    if (piece.kind !== 'crystal') continue

    let axis = new THREE.Vector3().fromArray(piece.axis).normalize()
    const outwardDot = axis.dot(faceOut)
    if (piece.role === 'primary' || piece.role === 'micro') {
      if (outwardDot < -0.05) axis = axis.reflect(faceOut).normalize()
      else if (outwardDot < 0.22) {
        axis = axis.clone().addScaledVector(faceOut, 0.42).normalize()
      }
    } else if (outwardDot < -0.45) {
      axis = axis.clone().addScaledVector(faceOut, 0.28).normalize()
    }

    let root = sharedRoot.clone()

    if (piece.parentId && placed.has(piece.parentId)) {
      const parent = placed.get(piece.parentId)
      const along = clamp01(piece.attachAlong ?? 0.25)
      /*
       * Face-aware attach with a slight nest so child bases meet the parent
       * face (closes the small air gap without changing overall composition).
       */
      const shaftR = estimateCrystalRadiusAt(
        along,
        parent.width,
        parent.depth,
      )
      const sideAmt = shaftR * (piece.sideOffset ?? 0.92)

      const helper =
        Math.abs(parent.axis.y) < 0.9
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(1, 0, 0)
      const pRight = new THREE.Vector3()
        .crossVectors(helper, parent.axis)
        .normalize()
      const pForward = new THREE.Vector3()
        .crossVectors(parent.axis, pRight)
        .normalize()
      const sideAngle = piece.sideAngle ?? 0
      const sideDir = pRight
        .clone()
        .multiplyScalar(Math.cos(sideAngle))
        .addScaledVector(pForward, Math.sin(sideAngle))
        .normalize()

      root = parent.root
        .clone()
        .addScaledVector(parent.axis, parent.length * along)
        .addScaledVector(sideDir, sideAmt)
        /* Slightly deeper nest — removes the visible child–parent gap. */
        .addScaledVector(axis, -piece.length * 0.1)
    } else {
      const radial = piece.radial || 0
      if (radial > 0) {
        root
          .addScaledVector(tangent, Math.cos(piece.radialAngle || 0) * radial)
          .addScaledVector(bitangent, Math.sin(piece.radialAngle || 0) * radial)
      }
      /* Do not re-apply nest — sharedRoot already carries the only embed. */
      const lift =
        piece.role === 'micro' ? piece.length * 0.08 : piece.length * 0.12
      root.addScaledVector(axis, lift)
      root.addScaledVector(faceOut, piece.role === 'micro' ? 0.006 : 0.012)
    }

    const quaternion = new THREE.Quaternion().setFromUnitVectors(yUp, axis)
    quaternion.multiply(
      new THREE.Quaternion().setFromAxisAngle(yUp, piece.roll || 0),
    )

    /* Unit hull radius ≈ 1 → visual diameter ≈ 2 * scale.x */
    const scale = new THREE.Vector3(
      piece.width * 0.5,
      piece.length,
      piece.depth * 0.5,
    )

    placed.set(piece.id, {
      root: root.clone(),
      axis: axis.clone(),
      length: piece.length,
      width: piece.width,
      depth: piece.depth,
    })

    pieces.push({
      key: `crystal-${piece.id}`,
      pieceId: piece.id,
      role: piece.role,
      profileIndex: piece.profileIndex,
      meshSeed: piece.meshSeed ?? seed + pieces.length * 19,
      position: root,
      quaternion,
      scale,
      tint: piece.tint,
    })
  }

  const focusLift = 0.12 * (site.scale || 1)
  const seat = {
    position: surface.clone().addScaledVector(faceOut, focusLift),
    normal: faceOut.clone(),
  }

  return { pieces, seat, plan }
}

export default function SingleBioCrystalCluster({
  life,
  lobeAmplitude = 1,
  morphologyType,
  morphology = EXP03_MORPHOLOGY_DEFAULTS,
  /** Studio strips CubeTexture — additive glint layer. */
  glintEnvMap = null,
  /** Pastel room PMREM — glass body / inner layers. */
  bodyEnvMap = null,
  onSeatReady = null,
  /** Overrides life.seed for crystal plan (must match agent sim seed). */
  planSeed = null,
  /** pieceId → growth 0..1; omit / null = fully grown (static preview). */
  growthByPieceId = null,
  /** Optional live getter polled each frame for smooth growth (sim≠render). */
  getGrowthMap = null,
}) {
  const geometryPoolRef = useRef(new Map())
  const materialPoolRef = useRef(new Map())
  const meshRefs = useRef(new Map())
  const baseScaleRef = useRef(new Map())

  /*
   * Freeze seating against moisture-only life identity churn (setMoistureAtStep).
   * Re-seat only when membrane AGE / seed / step changes.
   */
  const seatingLife = useMemo(() => life, [life?.seed, life?.age, life?.step])

  const { pieces, seat } = useMemo(
    () =>
      buildCrystalTransforms(seatingLife, {
        lobeAmplitude,
        morphologyType,
        morphology,
        planSeed,
      }),
    [seatingLife, lobeAmplitude, morphologyType, morphology, planSeed],
  )

  useEffect(() => {
    if (seat && typeof onSeatReady === 'function') {
      onSeatReady(seat)
    }
  }, [seat, onSeatReady])

  /* Drop pooled assets that no longer match the active plan (seed change). */
  useEffect(() => {
    const liveKeys = new Set(pieces.map((p) => p.key))
    for (const [key, geometry] of geometryPoolRef.current) {
      if (liveKeys.has(key)) continue
      geometry.dispose()
      geometryPoolRef.current.delete(key)
    }
    for (const [key, materials] of materialPoolRef.current) {
      if (liveKeys.has(key)) continue
      for (const material of materials) material.dispose()
      materialPoolRef.current.delete(key)
    }
  }, [pieces])

  const geoPool = geometryPoolRef.current
  for (const entry of pieces) {
    if (geoPool.has(entry.key)) continue
    const profile =
      EXP03_CRYSTAL_PROFILES[
        entry.profileIndex % EXP03_CRYSTAL_PROFILES.length
      ]
    geoPool.set(
      entry.key,
      /* Root→tip tint gradient + 3 render groups (inner / body / glint). */
      prepareExp03CrystalGeometry(
        createClusterShardGeometry({
          ...profile,
          seed: entry.meshSeed,
        }),
        { tint: entry.tint, role: entry.role },
      ),
    )
  }

  const matPool = materialPoolRef.current
  for (const entry of pieces) {
    if (!matPool.has(entry.key)) {
      matPool.set(
        entry.key,
        createExp03CrystalLayeredMaterials({
          tint: entry.tint,
          role: entry.role,
          glintEnvMap,
          bodyEnvMap,
        }),
      )
    }
  }

  /* Bind env maps when they arrive / change — reflection-only update. */
  useEffect(() => {
    for (const materials of materialPoolRef.current.values()) {
      bindExp03CrystalLayeredEnvMaps(materials, { glintEnvMap, bodyEnvMap })
    }
  }, [glintEnvMap, bodyEnvMap])

  useEffect(
    () => () => {
      for (const geometry of geometryPoolRef.current.values()) {
        geometry.dispose()
      }
      geometryPoolRef.current.clear()
      for (const materials of materialPoolRef.current.values()) {
        for (const material of materials) material.dispose()
      }
      materialPoolRef.current.clear()
    },
    [],
  )

  /*
   * Layered glass is alpha-blended without depth writes, so let three.js sort
   * crystals back-to-front by distance (same renderOrder for every role).
   * Still > 0 so all crystals draw after the transparent Exp05 membrane.
   */
  const renderOrderFor = () => 2

  const useGrowth = growthByPieceId != null || typeof getGrowthMap === 'function'
  const growthMapRef = useRef(growthByPieceId || {})
  const piecesRef = useRef(pieces)
  piecesRef.current = pieces

  /* Keep snapshot map fresh for useFrame fallback (matches inspector). */
  if (growthByPieceId != null) {
    growthMapRef.current = growthByPieceId
  }

  /* Sync base scales during render so the first useFrame never misses them. */
  const bases = baseScaleRef.current
  for (const entry of pieces) {
    const prev = bases.get(entry.pieceId)
    if (
      !prev ||
      prev.x !== entry.scale.x ||
      prev.y !== entry.scale.y ||
      prev.z !== entry.scale.z
    ) {
      bases.set(entry.pieceId, entry.scale.clone())
    }
  }

  /* Live sim map smooths between React inspector ticks. */
  useFrame(() => {
    if (!useGrowth) return
    const live =
      typeof getGrowthMap === 'function' ? getGrowthMap() : null
    const map =
      live && Object.keys(live).length > 0 ? live : growthMapRef.current || {}

    for (const entry of piecesRef.current) {
      const mesh = meshRefs.current.get(entry.pieceId)
      const base = baseScaleRef.current.get(entry.pieceId)
      if (!mesh || !base) continue
      const g = growthDisplay(map[entry.pieceId] ?? 0)
      if (g < 0.004) {
        mesh.visible = false
        continue
      }
      mesh.visible = true
      mesh.scale.set(base.x * g, base.y * g, base.z * g)
    }
  })

  return (
    <group name="exp03-mineral-formation">
      {pieces.map((entry) => {
        const material = matPool.get(entry.key)
        const geometry = geoPool.get(entry.key)
        if (!material || !geometry) return null

        let sx = entry.scale.x
        let sy = entry.scale.y
        let sz = entry.scale.z
        let visible = true
        if (useGrowth) {
          const map = growthMapRef.current || growthByPieceId || {}
          const live =
            typeof getGrowthMap === 'function' ? getGrowthMap() : null
          const g = growthDisplay(
            (live && live[entry.pieceId] != null
              ? live[entry.pieceId]
              : map[entry.pieceId]) ?? 0,
          )
          if (g < 0.004) {
            visible = false
            sx = 0.0001
            sy = 0.0001
            sz = 0.0001
          } else {
            sx *= g
            sy *= g
            sz *= g
          }
        }

        return (
          <mesh
            key={entry.key}
            ref={(node) => {
              if (node) meshRefs.current.set(entry.pieceId, node)
              else meshRefs.current.delete(entry.pieceId)
            }}
            geometry={geometry}
            material={material}
            position={entry.position}
            quaternion={entry.quaternion}
            scale={[sx, sy, sz]}
            frustumCulled={false}
            renderOrder={renderOrderFor(entry.role)}
            visible={visible}
          />
        )
      })}
    </group>
  )
}
