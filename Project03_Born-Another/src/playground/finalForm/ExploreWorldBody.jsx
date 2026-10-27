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
  } = {},
) {
  const morphRaw = Number(morphStrength)
  const morphScale = Math.min(
    1.5,
    Math.max(0, Number.isFinite(morphRaw) ? morphRaw : 1),
  )
  const deformScale = clampMorphAmplitude(deformationStrength, 1)
  const lobeScale = clampMorphAmplitude(lobeAmplitude, 1)
  const morph = formMorphAmount(life.variables?.growth ?? 0) * morphScale
  const baseDeformations = life.outputs?.form?.localDeformations ?? []
  const deformations =
    deformScale === 1
      ? baseDeformations
      : baseDeformations.map((entry) => ({
          ...entry,
          deformation: (Number(entry.deformation) || 0) * deformScale,
        }))

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
    const extra = sampleTurbulenceFromLife(
      shaped[0],
      shaped[1],
      shaped[2],
      life,
    )
    const deformed = deformRadialPoint(
      shaped[0],
      shaped[1],
      shaped[2],
      deformations,
      extra,
    )
    target[offset] = deformed[0]
    target[offset + 1] = deformed[1]
    target[offset + 2] = deformed[2]
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
}) {
  const meshRef = useRef(null)
  const bundleRef = useRef(null)
  const lifeRef = useRef(life)
  const morphStrengthRef = useRef(morphStrength)
  const deformationStrengthRef = useRef(deformationStrength)
  const lobeAmplitudeRef = useRef(lobeAmplitude)
  lifeRef.current = life
  morphStrengthRef.current = morphStrength
  deformationStrengthRef.current = deformationStrength
  lobeAmplitudeRef.current = lobeAmplitude

  const seed = normalizeSeed(life?.seed ?? EXP05_LIFE_SEED)

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

  const material = useMemo(
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

  useLayoutEffect(() => {
    material.depthWrite = bodyDepthWrite
  }, [material, bodyDepthWrite])

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
  }, [
    uniforms,
    surface,
    individuality,
    development.age,
    development.speed,
    development.noiseAmount,
  ])

  useLayoutEffect(() => {
    const world = createExp05WorldGeometry(seed)
    const rest = captureWorldRestState(world)
    const restMean = estimateRestPositionsMean(rest.surface)
    bundleRef.current = { world, rest, restMean, seed }
    if (meshRef.current) meshRef.current.geometry = world.surface
    applyExp05BodySurface(world, rest, lifeRef.current, {
      morphStrength: morphStrengthRef.current,
      deformationStrength: deformationStrengthRef.current,
      lobeAmplitude: lobeAmplitudeRef.current,
      restMean,
    })
    return () => {
      disposeWorldGeometry(world)
      if (bundleRef.current?.seed === seed) bundleRef.current = null
    }
  }, [seed])

  useLayoutEffect(() => {
    const bundle = bundleRef.current
    if (!bundle || !life) return
    applyExp05BodySurface(bundle.world, bundle.rest, life, {
      morphStrength,
      deformationStrength,
      lobeAmplitude,
      restMean: bundle.restMean,
    })
  }, [life, morphStrength, deformationStrength, lobeAmplitude])

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime()
    uniforms.uAge.value = ageClock.current
  })

  useEffect(
    () => () => {
      material.dispose()
    },
    [material],
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
