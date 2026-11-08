/**
 * World Final — glass formations (M3E): one instanced mesh per kind
 * (seabedFormations.js), all sharing one glass material.
 *
 * Glass model (no transmission buffer): the surface mirrors the water
 * (wfWater of the reflected ray) at grazing angles and shows a body tint
 * face-on — near clear for films, lavender-pink for solid glass — with a
 * soft thin-film rainbow, sun glints and a bright free edge on membranes.
 * Hazes into the same water color as the terrain.
 */
import { useEffect, useLayoutEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { WATER } from './atmosphere.js'
import { organismAnchorFor } from './cameraPoses.js'
import { hazeOffsetForCamera } from './seabedMaterial.js'
import {
  FORMATION_BUILDERS,
  FORMATION_MAX_COUNTS,
  FORMATION_KINDS,
  formationSites,
} from './seabedFormations.js'
import { WATER_GLSL } from './waterVolume.js'

/** After terrain (0) and light shafts (1), before the organism (3+). */
export const FORMATIONS_RENDER_ORDER = 2

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
  'formationDensity',
]

const vertexShader = /* glsl */ `
attribute float aT;
attribute float aBody;
attribute float aSeed;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vViewDepth;
varying float vT;
varying float vBody;
varying float vSeed;

void main() {
  mat4 model = modelMatrix * instanceMatrix;
  vec4 world = model * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vNormal = normalize(mat3(model) * normal);
  vT = aT;
  vBody = aBody;
  vSeed = aSeed;
  vec4 mv = viewMatrix * world;
  vViewDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`

const fragmentShader = /* glsl */ `
uniform vec3 uSun;
uniform float uTime;
uniform float uHazeOn;
uniform float uHazeDensity;
uniform float uHazeStart;
uniform float uHazeOffset;
uniform float uIridescence;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vViewDepth;
varying float vT;
varying float vBody;
varying float vSeed;
${WATER_GLSL}

void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWorldPos);
  float NdV = clamp(abs(dot(N, V)), 0.0, 1.0);
  float fres = pow(1.0 - NdV, mix(2.0, 3.2, vBody));

  /* Body seen face-on: near-clear film → lavender-pink solid glass. */
  vec3 body = mix(vec3(0.8, 0.78, 0.86), vec3(0.9, 0.78, 0.84), 0.5 + 0.5 * sin(vSeed * 19.0 + vT * 2.5));
  vec3 behind = wfWater(-V);
  vec3 face = mix(behind * 1.04, body * mix(0.85, 1.0, NdV), mix(0.1, 0.45, vBody));
  /* Delicate: the water it mirrors is only a glaze, not a mirror. */
  vec3 col = mix(face, wfWater(reflect(-V, N)), mix(mix(0.12, 0.38, fres), mix(0.06, 0.22, fres), vBody));

  /* Soft thin-film rainbow, strongest toward grazing. */
  vec3 film = 0.5 + 0.5 * cos(6.2832 * (fres * 1.1 + vSeed + vT * 0.7 + uTime * 0.008 + vec3(0.0, 0.33, 0.67)));
  col *= mix(vec3(1.0), mix(vec3(1.0), film * 1.15, 0.4), (0.2 + 0.45 * fres) * uIridescence);

  /* Small glints only; the mineral grains catch a little more than the film. */
  float spec = pow(max(dot(N, normalize(wfSunDir + V)), 0.0), mix(48.0, 90.0, vBody));
  col += uSun * spec * mix(0.3, 0.55, vBody);

  float alpha = mix(mix(0.08, 0.55, fres), mix(0.16, 0.5, fres), vBody) + spec * 0.35;
  /* Films sink into the sand without a hard cut. */
  alpha *= mix(smoothstep(0.0, 0.1, vT), 1.0, vBody);
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

export default function SeabedFormations({ config, hazeEnabled = true }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        name: 'WorldFinalGlassFormations',
        vertexShader,
        fragmentShader,
        uniforms: {
          uSun: { value: new THREE.Color().setRGB(...WATER.sun, THREE.LinearSRGBColorSpace) },
          uTime: { value: 0 },
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
  const meshes = useMemo(
    () =>
      FORMATION_KINDS.map((kind) => {
        const max = FORMATION_MAX_COUNTS[kind]
        const geometry = FORMATION_BUILDERS[kind]()
        geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(max), 1))
        const mesh = new THREE.InstancedMesh(geometry, material, max)
        mesh.frustumCulled = false
        mesh.renderOrder = FORMATIONS_RENDER_ORDER
        mesh.name = `world-final-formations-${kind}`
        mesh.count = 0
        return mesh
      }),
    [material],
  )

  useEffect(
    () => () => {
      for (const mesh of meshes) {
        mesh.geometry.dispose()
        mesh.dispose()
      }
      material.dispose()
    },
    [meshes, material],
  )

  const siteKey = SITE_KEYS.map((k) => config[k]).join('|')
  useLayoutEffect(() => {
    const sites = formationSites(config, organismAnchorFor(config))
    FORMATION_KINDS.forEach((kind, i) => {
      const mesh = meshes[i]
      const seeds = mesh.geometry.attributes.aSeed
      sites[kind].forEach((site, j) => {
        /* Both lie on the slope, the fold lifted just enough not to knife into it. */
        const n = site.normal.clone().lerp(UP, kind === 'fold' ? 0.35 : 0.15).normalize()
        _q.setFromUnitVectors(UP, n)
        _yaw.setFromAxisAngle(UP, site.yaw)
        _q.multiply(_yaw)
        _s.setScalar(site.scale)
        _p.set(site.x, site.y, site.z)
        mesh.setMatrixAt(j, _m.compose(_p, _q, _s))
        seeds.setX(j, site.seed)
      })
      mesh.count = sites[kind].length
      mesh.instanceMatrix.needsUpdate = true
      seeds.needsUpdate = true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, meshes])

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

  return (
    <group name="world-final-formations">
      {meshes.map((mesh) => (
        <primitive key={mesh.name} object={mesh} />
      ))}
    </group>
  )
}
