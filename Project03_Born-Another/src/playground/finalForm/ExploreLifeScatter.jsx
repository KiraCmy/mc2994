import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ageClock } from '../../ageClock.js'
import {
  createGrowthClusterVariants,
  GROWTH_CLUSTER_DEFAULTS,
} from '../../scatter/GrowthClusterAsset.js'
import { scatterAttachmentFragmentShader } from '../../surfaceShader.js'
import { createExp05SurfaceEvaluator } from './exp05SurfaceEvaluator.js'
import {
  EXP05_DEFAULT_MORPHOLOGY_TYPE,
  normalizeExp05MorphologyType,
} from './exp05MorphologyTypes.js'
import {
  EXP05_ENV_TEMPERATURE_NEUTRAL,
  normalizeExp05Temperature,
} from './exp05EnvironmentCoupling.js'

const UP = new THREE.Vector3(0, 1, 0)
const VARIANT_COUNT = GROWTH_CLUSTER_DEFAULTS.variantCount
/** Fixed InstancedMesh capacity — avoids R3F remount/dispose when AGE changes counts. */
const PETAL_CAPACITY = 256

const worldSeatedPetalVertexShader = /* glsl */ `
  attribute float aAttach;

  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vLocalPos;
  varying vec3 vTangent;
  varying vec3 vSurfaceRest;
  varying float vAttach;
  varying float vViewFacing;

  void main() {
    vec3 restOrigin = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float instScale = max(length(instanceMatrix[1].xyz), 1e-4);
    mat3 rot = mat3(
      instanceMatrix[0].xyz / instScale,
      instanceMatrix[1].xyz / instScale,
      instanceMatrix[2].xyz / instScale
    );

    vec3 surfaceN = normalize(rot[1]);
    vec3 toCamera = normalize(cameraPosition - restOrigin);
    float viewFacing = max(dot(surfaceN, toCamera), 0.0);

    float attach = clamp(aAttach, 0.0, 1.0);
    float glue = pow(attach, 0.72);
    float faceScale = mix(0.9, 1.55, smoothstep(0.05, 0.8, viewFacing));
    vec3 local = position * instScale * faceScale;

    vec3 sR = rot[0];
    vec3 sU = rot[1];
    vec3 sF = rot[2];
    vec3 cR = cross(sU, toCamera);
    if (dot(cR, cR) < 1e-6) cR = sR;
    cR = normalize(cR);
    vec3 cF = normalize(cross(cR, sU));
    float billboard = smoothstep(0.12, 0.7, viewFacing);
    vec3 R = normalize(mix(sR, cR, billboard));
    vec3 F = normalize(mix(sF, cF, billboard));
    vec3 U = normalize(mix(sU, surfaceN, 0.35));

    float surfaceBias = 0.012 + 0.012 * (1.0 - glue);
    vec3 worldPosition =
      restOrigin + surfaceN * surfaceBias + R * local.x + U * local.y + F * local.z;

    vec3 rigidN = normalize(R * normal.x + U * normal.y + F * normal.z);
    vec3 worldNormal = normalize(mix(rigidN, surfaceN, glue * 0.55));

    vec4 mvPosition = modelViewMatrix * vec4(worldPosition, 1.0);
    vViewPosition = mvPosition.xyz;
    vNormal = normalize(normalMatrix * worldNormal);
    vTangent = normalize(normalMatrix * R);
    vLocalPos = position;
    vSurfaceRest = restOrigin;
    vAttach = attach;
    vViewFacing = viewFacing;
    gl_Position = projectionMatrix * mvPosition;
  }
`

/**
 * Explore membrane petals seated on the C1 World surface evaluator.
 * Stays mounted across AGE / composition toggles — only instance matrices update.
 */
export default function ExploreLifeScatter({
  life,
  petalPlan,
  morphStrength = 1,
  deformationStrength = 1,
  lobeAmplitude = 1,
  morphologyType = EXP05_DEFAULT_MORPHOLOGY_TYPE,
  temperature = EXP05_ENV_TEMPERATURE_NEUTRAL,
  sculpturalStrength = 0,
  surfaceSeed = 884731,
  noiseScale = 2.8,
  age = 0.5,
  speed = 0.32,
  pulseSpeed = 1.1,
  displacement = 0.22,
  noiseAmount = 1.55,
  decayStart = 0.8,
  decayScale = 1.25,
  colorA = '#e7b6c2',
  colorB = '#a4e2e6',
  rimColor = '#a8feff',
}) {
  const meshRefs = useRef([])
  const lifeRef = useRef(life)
  const morphRef = useRef(morphStrength)
  const deformRef = useRef(deformationStrength)
  const lobeRef = useRef(lobeAmplitude)
  const sculptRef = useRef(sculpturalStrength)
  const evaluatorRef = useRef(null)
  const seatedAgeRef = useRef(null)
  lifeRef.current = life
  morphRef.current = morphStrength
  deformRef.current = deformationStrength
  lobeRef.current = lobeAmplitude
  sculptRef.current = sculpturalStrength

  const instances = petalPlan?.instances ?? []
  const planSeed = petalPlan?.seed ?? surfaceSeed
  const morphType = normalizeExp05MorphologyType(morphologyType)
  const tempValue = normalizeExp05Temperature(temperature)

  /* One evaluator for component lifetime; update seed / morphology type in place. */
  if (!evaluatorRef.current || evaluatorRef.current.seed !== planSeed) {
    evaluatorRef.current?.dispose?.()
    evaluatorRef.current = createExp05SurfaceEvaluator({
      seed: planSeed,
      morphologyType: morphType,
      temperature: tempValue,
      sculpturalStrength,
    })
  } else {
    evaluatorRef.current.setMorphologyType(morphType)
    evaluatorRef.current.setTemperature(tempValue)
    evaluatorRef.current.setSculpturalStrength(sculpturalStrength)
  }

  useEffect(
    () => () => {
      evaluatorRef.current?.dispose?.()
      evaluatorRef.current = null
    },
    [],
  )

  const geometries = useMemo(
    () =>
      createGrowthClusterVariants(
        VARIANT_COUNT,
        44017,
        GROWTH_CLUSTER_DEFAULTS,
      ),
    [],
  )

  const buckets = useMemo(() => {
    const groups = Array.from({ length: VARIANT_COUNT }, () => [])
    for (let i = 0; i < instances.length; i += 1) {
      const item = instances[i]
      const h =
        (Math.imul(item.index + 1, 2654435761) ^
          (planSeed + (item.siteId + 1) * 9973)) >>>
        0
      const slot = h % VARIANT_COUNT
      if (groups[slot].length < PETAL_CAPACITY) groups[slot].push(item)
    }
    return groups
  }, [instances, planSeed])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAge: { value: age },
      uSeed: { value: surfaceSeed },
      uNoiseScale: { value: noiseScale },
      uSpeed: { value: speed },
      uPulseSpeed: { value: pulseSpeed },
      uDisplacement: { value: displacement },
      uNoiseAmount: { value: noiseAmount },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uRimColor: { value: new THREE.Color(rimColor) },
      uBodyAlpha: { value: 0.78 },
      uFresnelPower: { value: 3.1 },
      uRimStrength: { value: 1.05 },
      uDecayStart: { value: decayStart },
      uDecayScale: { value: decayScale },
      uDiscardThreshold: { value: 0.025 },
    }),
    [],
  )

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: worldSeatedPetalVertexShader,
        fragmentShader: scatterAttachmentFragmentShader,
        uniforms,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [uniforms],
  )

  const scratch = useMemo(
    () => ({
      dummy: new THREE.Object3D(),
      normal: new THREE.Vector3(),
      axis: new THREE.Vector3(),
      twistQ: new THREE.Quaternion(),
      pitchQ: new THREE.Quaternion(),
      baseQ: new THREE.Quaternion(),
    }),
    [],
  )

  const seatPetals = () => {
    const lifeState = lifeRef.current
    const evaluator = evaluatorRef.current
    if (!lifeState || !evaluator) return
    const evalOpts = {
      finiteDifferenceNormal: false,
      morphStrength: morphRef.current,
      deformationStrength: deformRef.current,
      lobeAmplitude: lobeRef.current,
      sculpturalStrength: sculptRef.current,
    }
    const { dummy, normal, axis, twistQ, pitchQ, baseQ } = scratch

    for (let v = 0; v < VARIANT_COUNT; v += 1) {
      const mesh = meshRefs.current[v]
      const bucket = buckets[v] ?? []
      if (!mesh) continue

      const live = Math.min(bucket.length, PETAL_CAPACITY)
      for (let i = 0; i < live; i += 1) {
        const item = bucket[i]
        const direction = item.direction ?? item.normal
        const seated = evaluator.evaluate(direction, lifeState, evalOpts)
        if (!seated) {
          dummy.position.set(0, 0, 0)
          dummy.scale.setScalar(0)
          dummy.updateMatrix()
          mesh.setMatrixAt(i, dummy.matrix)
          continue
        }
        normal
          .set(seated.normal[0], seated.normal[1], seated.normal[2])
          .normalize()
        dummy.position.set(
          seated.position[0],
          seated.position[1],
          seated.position[2],
        )
        if (Math.abs(normal.y) > 0.999) {
          baseQ.setFromAxisAngle(axis.set(1, 0, 0), normal.y > 0 ? 0 : Math.PI)
        } else {
          baseQ.setFromUnitVectors(UP, normal)
        }
        const twist =
          ((Math.imul(item.index + 3, 1597334677) >>> 0) / 4294967296) *
          Math.PI *
          2
        twistQ.setFromAxisAngle(UP, twist)
        const tip =
          0.06 +
          ((Math.imul(item.index + 19, 2246822519) >>> 0) / 4294967296) * 0.1
        pitchQ.setFromAxisAngle(axis.set(0, 0, 1), tip)
        dummy.quaternion.copy(baseQ).multiply(twistQ).multiply(pitchQ)
        const s = Math.max(0.02, item.scale)
        dummy.scale.set(s, s, s)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      for (let i = live; i < PETAL_CAPACITY; i += 1) {
        dummy.position.set(0, 0, 0)
        dummy.scale.setScalar(0)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.count = PETAL_CAPACITY
      mesh.instanceMatrix.needsUpdate = true
    }
    seatedAgeRef.current = lifeState.age
  }

  const seatRef = useRef(seatPetals)
  seatRef.current = seatPetals

  useLayoutEffect(() => {
    seatRef.current()
  }, [
    life,
    buckets,
    morphStrength,
    deformationStrength,
    lobeAmplitude,
    sculpturalStrength,
    morphType,
    tempValue,
    planSeed,
  ])

  useLayoutEffect(() => {
    uniforms.uAge.value = age
    uniforms.uSeed.value = surfaceSeed
    uniforms.uNoiseScale.value = noiseScale
    uniforms.uSpeed.value = speed
    uniforms.uPulseSpeed.value = pulseSpeed
    uniforms.uDisplacement.value = displacement
    uniforms.uNoiseAmount.value = noiseAmount
    uniforms.uDecayStart.value = decayStart
    uniforms.uDecayScale.value = decayScale
    uniforms.uColorA.value.set(colorA)
    uniforms.uColorB.value.set(colorB)
    uniforms.uRimColor.value.set(rimColor)
  }, [
    uniforms,
    age,
    surfaceSeed,
    noiseScale,
    speed,
    pulseSpeed,
    displacement,
    noiseAmount,
    decayStart,
    decayScale,
    colorA,
    colorB,
    rimColor,
  ])

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime()
    uniforms.uAge.value = ageClock.current
    const lifeState = lifeRef.current
    if (lifeState && lifeState.age !== seatedAgeRef.current) {
      seatRef.current()
    }
  })

  useEffect(
    () => () => {
      geometries.forEach((g) => g.dispose())
      material.dispose()
    },
    [geometries, material],
  )

  return (
    <>
      {geometries.map((geometry, v) => (
        <instancedMesh
          key={`life-petal-${v}`}
          ref={(node) => {
            meshRefs.current[v] = node
            if (node && meshRefs.current.filter(Boolean).length === VARIANT_COUNT) {
              seatRef.current()
            }
          }}
          args={[geometry, material, PETAL_CAPACITY]}
          dispose={null}
          frustumCulled={false}
          renderOrder={10}
        />
      ))}
    </>
  )
}
