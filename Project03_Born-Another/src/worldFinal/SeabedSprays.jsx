/**
 * World Final — seabed sprays (M3D). One instanced mesh of glassy crowns
 * (seabedSprays.js). The material is thin glass: it mirrors the bright water
 * above (wfWater of the reflected ray), shifts through a soft thin-film
 * rainbow at grazing angles, catches the sun on its beads, and hazes into
 * the same water color as the terrain. Tendrils sway and breathe slowly.
 */
import { useEffect, useLayoutEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { organismAnchorFor } from './cameraPoses.js'
import { WATER } from './atmosphere.js'
import { hazeOffsetForCamera } from './seabedMaterial.js'
import { buildSprayGeometry, SPRAY_MAX_COUNT, spraySites } from './seabedSprays.js'
import { WATER_GLSL } from './waterVolume.js'

/** After terrain (0) and light shafts (1), before the organism (3+). */
export const SPRAYS_RENDER_ORDER = 2

const SITE_KEYS = [
  'seed',
  'basinRadius',
  'basinDepth',
  'basinWidth',
  'basinAsymmetry',
  'ridgeHeight',
  'ridgeSpacing',
  'surfaceDetail',
  'organismScale',
  'sprayDensity',
]

const vertexShader = /* glsl */ `
attribute float aT;
attribute float aBead;
attribute float aSeed;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vViewDepth;
varying float vT;
varying float vBead;
varying float vSeed;

void main() {
  vec3 p = position;
  float phase = uTime * 0.55 + aSeed * 6.2832;
  float bend = aT * aT;
  p.x += sin(phase) * 0.09 * bend;
  p.z += cos(phase * 0.8 + 1.3) * 0.09 * bend;
  p.y *= 1.0 + 0.05 * sin(phase * 1.3) * aT;
  mat4 model = modelMatrix * instanceMatrix;
  vec4 world = model * vec4(p, 1.0);
  vWorldPos = world.xyz;
  vNormal = normalize(mat3(model) * normal);
  vT = aT;
  vBead = aBead;
  vSeed = aSeed;
  vec4 mv = viewMatrix * world;
  vViewDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`

const fragmentShader = /* glsl */ `
uniform vec3 uSun;
uniform float uHazeOn;
uniform float uHazeDensity;
uniform float uHazeStart;
uniform float uHazeOffset;
uniform float uIridescence;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vViewDepth;
varying float vT;
varying float vBead;
varying float vSeed;
${WATER_GLSL}

void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWorldPos);
  float NdV = clamp(abs(dot(N, V)), 0.0, 1.0);
  float fres = pow(1.0 - NdV, 2.2);

  float bead = step(0.75, vBead);
  float sheet = 1.0 - min(abs(vBead - 0.5) * 4.0, 1.0);

  /* Thin glass: the bright water it mirrors, faintly lifted toward pearl. */
  vec3 col = mix(wfWater(reflect(-V, N)), vec3(0.96, 0.94, 1.0), 0.15);
  /* Thin-film rainbow, strongest at grazing edges. */
  vec3 film = 0.5 + 0.5 * cos(6.2832 * (fres * 0.9 + vSeed + vT * 0.45 + vec3(0.0, 0.33, 0.67)));
  col *= mix(vec3(1.0), mix(vec3(1.0), film * 1.3, 0.6), (0.35 + 0.65 * fres) * uIridescence);
  /* Sun glints on beads, the sheet and along the tendrils. */
  float spec = pow(max(dot(N, normalize(wfSunDir + V)), 0.0), mix(36.0, 90.0, bead));
  col += uSun * spec * mix(0.6, 1.3, bead);

  /* Clear faces, bright edges; the sheet is the thinnest glass of all. */
  float alpha = mix(mix(0.1, 0.75, fres), mix(0.04, 0.5, fres), sheet) + bead * 0.25 + spec * 0.6;
  /* Roots dissolve into the sediment. */
  alpha *= smoothstep(0.0, mix(0.14, 0.05, sheet), vT);
  alpha = clamp(alpha, 0.0, 0.95);

  float d = max(vViewDepth - uHazeStart - uHazeOffset, 0.0);
  float k = uHazeDensity * d;
  float haze = uHazeOn * (1.0 - exp(-(0.6 * k + k * k)));
  col = mix(col, wfWater(-V), haze * 0.88);
  alpha *= 1.0 - smoothstep(0.42, 0.98, haze);

  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _yaw = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _p = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

export default function SeabedSprays({ config, hazeEnabled = true }) {
  const geometry = useMemo(() => {
    const g = buildSprayGeometry()
    g.setAttribute(
      'aSeed',
      new THREE.InstancedBufferAttribute(new Float32Array(SPRAY_MAX_COUNT), 1),
    )
    return g
  }, [])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        name: 'WorldFinalSeabedSprays',
        vertexShader,
        fragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uSun: { value: new THREE.Color().setRGB(...WATER.sun, THREE.LinearSRGBColorSpace) },
          uHazeOn: { value: 1 },
          uHazeDensity: { value: 0 },
          uHazeStart: { value: 0 },
          uHazeOffset: { value: 0 },
          uIridescence: { value: 1 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  )
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geometry, material, SPRAY_MAX_COUNT)
    m.frustumCulled = false
    m.renderOrder = SPRAYS_RENDER_ORDER
    m.name = 'world-final-seabed-sprays'
    return m
  }, [geometry, material])

  useEffect(
    () => () => {
      mesh.dispose()
      geometry.dispose()
      material.dispose()
    },
    [mesh, geometry, material],
  )

  const siteKey = SITE_KEYS.map((k) => config[k]).join('|')
  useLayoutEffect(() => {
    const sites = spraySites(config, organismAnchorFor(config))
    const seeds = geometry.attributes.aSeed
    sites.forEach((site, i) => {
      _q.setFromUnitVectors(UP, site.normal)
      _yaw.setFromAxisAngle(UP, site.yaw)
      _q.multiply(_yaw)
      _s.set(site.scale, site.scale * site.stretch, site.scale)
      _p.set(site.x, site.y, site.z)
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s))
      seeds.setX(i, site.seed)
    })
    mesh.count = sites.length
    mesh.instanceMatrix.needsUpdate = true
    seeds.needsUpdate = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, mesh, geometry])

  useLayoutEffect(() => {
    const u = material.uniforms
    u.uHazeOn.value = hazeEnabled ? 1 : 0
    u.uHazeDensity.value = config.fogDensity
    u.uHazeStart.value = config.fogDistance
    u.uIridescence.value = config.basinIridescence
  }, [config, hazeEnabled, material])

  useFrame(({ camera, clock }) => {
    const u = material.uniforms
    u.uTime.value = clock.elapsedTime
    u.uHazeOffset.value = hazeOffsetForCamera(camera.position.y, config)
  })

  return <primitive object={mesh} />
}
