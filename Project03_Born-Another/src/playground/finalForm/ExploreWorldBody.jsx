import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ageClock } from '../../ageClock.js'
import { edgeAlpha } from '../../surfaceParams.js'
import { developmentFragmentShader } from '../../surfaceShader.js'
import { disposeWorldGeometry } from '../../worldv2/worldGeometry.js'
import {
  captureWorldRestState,
  deformRadialPoint,
  formMorphAmount,
  morphRestPoint,
} from '../../worldv2/life/worldLifeAdapter.js'
import { sampleTurbulenceFromLife } from '../../worldv2/turbulenceField.js'
import {
  createExp05WorldGeometry,
} from './exp05SurfaceEvaluator.js'
import { EXP05_LIFE_SEED } from './exploreLifeAdapter.js'
import {
  calibrateRestRadius,
  clampMorphAmplitude,
  estimateRestPositionsMean,
} from './exp05MorphologyCalibration.js'
import {
  EXP05_DEFAULT_MORPHOLOGY_TYPE,
  normalizeExp05MorphologyType,
} from './exp05MorphologyTypes.js'
import {
  EXP05_DIAGNOSTIC_MODES,
  EXP05_MATERIAL_MODES,
  normalizeExp05DiagnosticMode,
  normalizeExp05MaterialMode,
} from './exp05LabParams.js'
import {
  EXP05_ENV_TEMPERATURE_NEUTRAL,
  normalizeExp05Temperature,
  prepareExp05TemperatureSurface,
} from './exp05EnvironmentCoupling.js'
import {
  applyExp05SculpturalOffset,
  createExp05SculpturalSampler,
  normalizeExp05SculpturalStrength,
} from './exp05SculpturalDeformation.js'
import {
  createPearlescentMembraneMaterial,
  createPearlescentMembraneUniforms,
} from './exp05PearlescentMembrane.js'
import {
  createPearlescentMembraneV2Material,
  createPearlescentMembraneV2Uniforms,
} from './exp05PearlescentMembraneV2.js'
import {
  createBiologicalMembraneMaterial,
  createBiologicalMembraneUniforms,
} from './exp05BiologicalMembrane.js'
import {
  createBiologicalMembraneV2Material,
  createBiologicalMembraneV2Uniforms,
} from './exp05BiologicalMembraneV2.js'

/**
 * Pass-through vertex — World CPU morph owns silhouette.
 * No Explore macroMorphology / developmentDisplace (avoids double macro).
 */
const exploreWorldBodyVertexShader = /* glsl */ `
  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * worldPosition;
    vPosition = position;
    vViewPosition = viewPosition.xyz;
    vNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewPosition;
  }
`

function normalizeSeed(seed) {
  const n = Number(seed)
  if (!Number.isFinite(n)) return EXP05_LIFE_SEED
  return Math.abs(Math.floor(n)) % 2147483647 || EXP05_LIFE_SEED
}

/**
 * Apply World rest → lobe calibration → AGE morph → local deformations.
 * Geometry is already in Explore framing (C1 unit = birth radius).
 */
function applyExp05BodySurface(
  world,
  rest,
  life,
  {
    morphStrength = 1,
    deformationStrength = 1,
    lobeAmplitude = 1,
    restMean = null,
    temperature = EXP05_ENV_TEMPERATURE_NEUTRAL,
    sculpturalStrength = 0,
    sculpturalSampler = null,
  } = {},
) {
  const morphRaw = Number(morphStrength)
  const morphScale = Math.min(
    1.5,
    Math.max(0, Number.isFinite(morphRaw) ? morphRaw : 1),
  )
  const deformScale = clampMorphAmplitude(deformationStrength, 1)
  const lobeScale = clampMorphAmplitude(lobeAmplitude, 1)
  const sculptScale = normalizeExp05SculpturalStrength(sculpturalStrength)
  const prepared = prepareExp05TemperatureSurface(life, {
    temperature,
    seed: life?.seed,
  })
  const deformLife = prepared.life
  const morph = formMorphAmount(life.variables?.growth ?? 0) * morphScale
  const baseDeformations = deformLife.outputs?.form?.localDeformations ?? []
  const deformations =
    deformScale === 1
      ? baseDeformations
      : baseDeformations.map((entry) => ({
          ...entry,
          deformation: (Number(entry.deformation) || 0) * deformScale,
        }))
  const sampler =
    sculptScale > 1e-6
      ? (sculpturalSampler ?? createExp05SculpturalSampler(life?.seed))
      : null

  const surface = world.surface
  const position = surface.attributes.position
  const target = position.array
  const restPositions = rest.surface
  const mean =
    Number.isFinite(restMean) && restMean > 0
      ? restMean
      : estimateRestPositionsMean(restPositions)

  for (let index = 0; index < position.count; index += 1) {
    const offset = index * 3
    const rx = restPositions[offset]
    const ry = restPositions[offset + 1]
    const rz = restPositions[offset + 2]
    const nativeRadial = Math.hypot(rx, ry, rz) || 1
    const calibratedRadial = calibrateRestRadius(
      nativeRadial,
      mean,
      lobeScale,
    )
    const scale = calibratedRadial / nativeRadial
    const shaped = morphRestPoint(rx * scale, ry * scale, rz * scale, morph)
    const turbulence = sampleTurbulenceFromLife(
      shaped[0],
      shaped[1],
      shaped[2],
      life,
    )
    const temperatureOffset = prepared.sampleTemperatureOffset(
      shaped[0],
      shaped[1],
      shaped[2],
    )
    const deformed = deformRadialPoint(
      shaped[0],
      shaped[1],
      shaped[2],
      deformations,
      turbulence + (Number(temperatureOffset) || 0),
    )
    const sculpted = sampler
      ? applyExp05SculpturalOffset(
          deformed[0],
          deformed[1],
          deformed[2],
          sampler,
          sculptScale,
        )
      : deformed
    target[offset] = sculpted[0]
    target[offset + 1] = sculpted[1]
    target[offset + 2] = sculpted[2]
  }
  position.needsUpdate = true
  surface.computeVertexNormals()
  surface.computeBoundingSphere()
}

/**
 * Exp05 body: Explore-framed World morphology + Explore development fragment.
 */
export default function ExploreWorldBody({
  life,
  surface,
  individuality,
  development,
  isDead = false,
  bodyDepthWrite = true,
  morphStrength = 1,
  deformationStrength = 1,
  lobeAmplitude = 1,
  morphologyType = EXP05_DEFAULT_MORPHOLOGY_TYPE,
  /** Exp05 morphology diagnostic look — does not rebuild geometry. */
  diagnosticMode = EXP05_DIAGNOSTIC_MODES.FULL,
  /** Body material study — Explore | Pearlescent | Biological | Biological V2. */
  materialMode = EXP05_MATERIAL_MODES.EXPLORE,
  /** Playground Temperature coupling (not Life Engine). */
  temperature = EXP05_ENV_TEMPERATURE_NEUTRAL,
  /** Optional Exp05 sculptural tangential deformation (0 = identity). */
  sculpturalStrength = 0,
  /** Biological V2 — optical density / thickness-proxy contrast (lab knobs). */
  opticalDensity = 1.2,
  thicknessContrast = 1.15,
}) {
  const meshRef = useRef(null)
  const bundleRef = useRef(null)
  const lifeRef = useRef(life)
  const morphStrengthRef = useRef(morphStrength)
  const deformationStrengthRef = useRef(deformationStrength)
  const lobeAmplitudeRef = useRef(lobeAmplitude)
  const temperatureRef = useRef(temperature)
  const sculpturalStrengthRef = useRef(sculpturalStrength)
  const sculpturalSamplerRef = useRef(null)
  lifeRef.current = life
  morphStrengthRef.current = morphStrength
  deformationStrengthRef.current = deformationStrength
  lobeAmplitudeRef.current = lobeAmplitude
  temperatureRef.current = temperature
  sculpturalStrengthRef.current = sculpturalStrength

  const seed = normalizeSeed(life?.seed ?? EXP05_LIFE_SEED)
  const morphType = normalizeExp05MorphologyType(morphologyType)
  const appearance = normalizeExp05DiagnosticMode(diagnosticMode)
  const bodyMaterialMode = normalizeExp05MaterialMode(materialMode)
  const tempValue = normalizeExp05Temperature(temperature)
  const sculptValue = normalizeExp05SculpturalStrength(sculpturalStrength)

  if (
    !sculpturalSamplerRef.current ||
    sculpturalSamplerRef.current.seed !== seed
  ) {
    sculpturalSamplerRef.current = {
      seed,
      sampler: createExp05SculpturalSampler(seed),
    }
  }

  const uniforms = useMemo(
    () => ({
      uColorA: { value: new THREE.Color(surface.colorA) },
      uColorB: { value: new THREE.Color(surface.colorB) },
      uRimColor: { value: new THREE.Color(surface.rimColor) },
      uLow: { value: -0.65 },
      uHigh: { value: 0.75 },
      uFresnelPower: { value: surface.fresnelPower },
      uRimStrength: { value: surface.rimStrength },
      uBodyAlpha: { value: surface.opacity },
      uEdgeAlpha: { value: edgeAlpha(surface.opacity) },
      uSeed: { value: individuality.seed },
      uNoiseScale: { value: individuality.noiseScale },
      uPatternContrast: { value: individuality.patternContrast },
      uAccentColor: { value: new THREE.Color(individuality.accentColor) },
      uAccentStrength: { value: individuality.accentStrength },
      uTime: { value: 0 },
      uAge: { value: development.age },
      uSpeed: { value: development.speed },
      uNoiseAmount: { value: development.noiseAmount },
    }),
    [],
  )

  const pearlescentUniforms = useMemo(
    () =>
      createPearlescentMembraneUniforms({
        seed: individuality.seed,
        age: development.age,
        speed: development.speed,
        noiseScale: individuality.noiseScale,
      }),
    [],
  )

  const pearlescentV2Uniforms = useMemo(
    () =>
      createPearlescentMembraneV2Uniforms({
        seed: individuality.seed,
        age: development.age,
        speed: development.speed,
        noiseScale: individuality.noiseScale,
      }),
    [],
  )

  const biologicalUniforms = useMemo(
    () =>
      createBiologicalMembraneUniforms({
        seed: individuality.seed,
        age: development.age,
        speed: development.speed,
        noiseScale: individuality.noiseScale,
      }),
    [],
  )

  const biologicalV2Uniforms = useMemo(
    () =>
      createBiologicalMembraneV2Uniforms({
        seed: individuality.seed,
        age: development.age,
        speed: development.speed,
        noiseScale: individuality.noiseScale,
        opticalDensity,
        thicknessContrast,
      }),
    [],
  )

  const exploreMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: exploreWorldBodyVertexShader,
        fragmentShader: developmentFragmentShader,
        uniforms,
        transparent: true,
        depthWrite: bodyDepthWrite,
        side: THREE.FrontSide,
        toneMapped: false,
      }),
    [uniforms],
  )

  const pearlescentMaterial = useMemo(
    () =>
      createPearlescentMembraneMaterial(pearlescentUniforms, {
        depthWrite: bodyDepthWrite,
      }),
    [pearlescentUniforms],
  )

  const pearlescentV2Material = useMemo(
    () =>
      createPearlescentMembraneV2Material(pearlescentV2Uniforms, {
        depthWrite: bodyDepthWrite,
      }),
    [pearlescentV2Uniforms],
  )

  const biologicalMaterial = useMemo(
    () =>
      createBiologicalMembraneMaterial(biologicalUniforms, {
        depthWrite: bodyDepthWrite,
      }),
    [biologicalUniforms],
  )

  const biologicalV2Material = useMemo(
    () =>
      createBiologicalMembraneV2Material(biologicalV2Uniforms, {
        depthWrite: bodyDepthWrite,
      }),
    [biologicalV2Uniforms],
  )

  /* Neutral opaque gray — silhouette / form only. */
  const geometryMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#9a9a9a',
        roughness: 0.78,
        metalness: 0.02,
        flatShading: false,
        transparent: false,
        side: THREE.FrontSide,
      }),
    [],
  )

  /* Slightly brighter, lower roughness — raking light reads rib depth. */
  const surfaceLitMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#d0d0d0',
        roughness: 0.42,
        metalness: 0.06,
        flatShading: false,
        transparent: false,
        side: THREE.FrontSide,
      }),
    [],
  )

  const fullLookMaterial =
    bodyMaterialMode === EXP05_MATERIAL_MODES.BIOLOGICAL_V2
      ? biologicalV2Material
      : bodyMaterialMode === EXP05_MATERIAL_MODES.BIOLOGICAL
        ? biologicalMaterial
        : bodyMaterialMode === EXP05_MATERIAL_MODES.PEARLESCENT_V2
          ? pearlescentV2Material
          : bodyMaterialMode === EXP05_MATERIAL_MODES.PEARLESCENT
            ? pearlescentMaterial
            : exploreMaterial

  const material =
    appearance === EXP05_DIAGNOSTIC_MODES.GEOMETRY
      ? geometryMaterial
      : appearance === EXP05_DIAGNOSTIC_MODES.SURFACE_LIGHTING
        ? surfaceLitMaterial
        : fullLookMaterial

  useLayoutEffect(() => {
    exploreMaterial.depthWrite = bodyDepthWrite
    pearlescentMaterial.depthWrite = bodyDepthWrite
    pearlescentV2Material.depthWrite = bodyDepthWrite
    biologicalMaterial.depthWrite = bodyDepthWrite
    biologicalV2Material.depthWrite = bodyDepthWrite
  }, [
    exploreMaterial,
    pearlescentMaterial,
    pearlescentV2Material,
    biologicalMaterial,
    biologicalV2Material,
    bodyDepthWrite,
  ])

  useLayoutEffect(() => {
    uniforms.uColorA.value.set(surface.colorA)
    uniforms.uColorB.value.set(surface.colorB)
    uniforms.uRimColor.value.set(surface.rimColor)
    uniforms.uFresnelPower.value = surface.fresnelPower
    uniforms.uRimStrength.value = surface.rimStrength
    uniforms.uBodyAlpha.value = surface.opacity
    uniforms.uEdgeAlpha.value = edgeAlpha(surface.opacity)
    uniforms.uSeed.value = individuality.seed
    uniforms.uNoiseScale.value = individuality.noiseScale
    uniforms.uPatternContrast.value = individuality.patternContrast
    uniforms.uAccentColor.value.set(individuality.accentColor)
    uniforms.uAccentStrength.value = individuality.accentStrength
    uniforms.uAge.value = development.age
    uniforms.uSpeed.value = development.speed
    uniforms.uNoiseAmount.value = development.noiseAmount

    pearlescentUniforms.uSeed.value = individuality.seed
    pearlescentUniforms.uNoiseScale.value = individuality.noiseScale
    pearlescentUniforms.uAge.value = development.age
    pearlescentUniforms.uSpeed.value = development.speed

    pearlescentV2Uniforms.uSeed.value = individuality.seed
    pearlescentV2Uniforms.uNoiseScale.value = individuality.noiseScale
    pearlescentV2Uniforms.uAge.value = development.age
    pearlescentV2Uniforms.uSpeed.value = development.speed

    biologicalUniforms.uSeed.value = individuality.seed
    biologicalUniforms.uNoiseScale.value = individuality.noiseScale
    biologicalUniforms.uAge.value = development.age
    biologicalUniforms.uSpeed.value = development.speed

    biologicalV2Uniforms.uSeed.value = individuality.seed
    biologicalV2Uniforms.uNoiseScale.value = individuality.noiseScale
    biologicalV2Uniforms.uAge.value = development.age
    biologicalV2Uniforms.uSpeed.value = development.speed
    biologicalV2Uniforms.uOpticalDensity.value = Number(opticalDensity) || 1.35
    biologicalV2Uniforms.uThicknessContrast.value =
      Number(thicknessContrast) || 1.25
  }, [
    uniforms,
    pearlescentUniforms,
    pearlescentV2Uniforms,
    biologicalUniforms,
    biologicalV2Uniforms,
    surface,
    individuality,
    development.age,
    development.speed,
    development.noiseAmount,
    opticalDensity,
    thicknessContrast,
  ])

  useLayoutEffect(() => {
    const world = createExp05WorldGeometry(seed, morphType)
    const rest = captureWorldRestState(world)
    const restMean = estimateRestPositionsMean(rest.surface)
    bundleRef.current = { world, rest, restMean, seed, morphType }
    if (meshRef.current) meshRef.current.geometry = world.surface
    applyExp05BodySurface(world, rest, lifeRef.current, {
      morphStrength: morphStrengthRef.current,
      deformationStrength: deformationStrengthRef.current,
      lobeAmplitude: lobeAmplitudeRef.current,
      temperature: temperatureRef.current,
      sculpturalStrength: sculpturalStrengthRef.current,
      sculpturalSampler: sculpturalSamplerRef.current?.sampler,
      restMean,
    })
    return () => {
      disposeWorldGeometry(world)
      if (
        bundleRef.current?.seed === seed &&
        bundleRef.current?.morphType === morphType
      ) {
        bundleRef.current = null
      }
    }
  }, [seed, morphType])

  useLayoutEffect(() => {
    const bundle = bundleRef.current
    if (!bundle || !life) return
    applyExp05BodySurface(bundle.world, bundle.rest, life, {
      morphStrength,
      deformationStrength,
      lobeAmplitude,
      temperature: tempValue,
      sculpturalStrength: sculptValue,
      sculpturalSampler: sculpturalSamplerRef.current?.sampler,
      restMean: bundle.restMean,
    })
  }, [
    life,
    morphStrength,
    deformationStrength,
    lobeAmplitude,
    tempValue,
    sculptValue,
  ])

  useFrame(({ clock }) => {
    if (appearance !== EXP05_DIAGNOSTIC_MODES.FULL) return
    const t = clock.getElapsedTime()
    const age = ageClock.current
    uniforms.uTime.value = t
    uniforms.uAge.value = age
    pearlescentUniforms.uTime.value = t
    pearlescentUniforms.uAge.value = age
    pearlescentV2Uniforms.uTime.value = t
    pearlescentV2Uniforms.uAge.value = age
    biologicalUniforms.uTime.value = t
    biologicalUniforms.uAge.value = age
    biologicalV2Uniforms.uTime.value = t
    biologicalV2Uniforms.uAge.value = age
  })

  useEffect(
    () => () => {
      exploreMaterial.dispose()
      pearlescentMaterial.dispose()
      pearlescentV2Material.dispose()
      biologicalMaterial.dispose()
      biologicalV2Material.dispose()
      geometryMaterial.dispose()
      surfaceLitMaterial.dispose()
    },
    [
      exploreMaterial,
      pearlescentMaterial,
      pearlescentV2Material,
      biologicalMaterial,
      biologicalV2Material,
      geometryMaterial,
      surfaceLitMaterial,
    ],
  )

  if (isDead) return null

  return (
    <mesh
      ref={(node) => {
        meshRef.current = node
        if (node && bundleRef.current?.world?.surface) {
          node.geometry = bundleRef.current.world.surface
        }
      }}
      material={material}
      frustumCulled={false}
      renderOrder={0}
    />
  )
}
