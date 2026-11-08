/**
 * World Final — suspended particles carried by the shared water current.
 *
 * One Points draw call. Each particle's world position is computed in the
 * vertex shader from a fixed seed, the integrated mean drift, and the eddy
 * displacement of the current field, then wrapped in a box around the
 * camera (edges faded, so wrapping never pops). Positions are real world
 * space, so camera motion gives true parallax. Per frame the CPU only
 * writes a handful of uniforms; density changes only the draw range.
 *
 * Read as silt, not stars: most particles are small, faint, and only just
 * lighter than the water; a few are brighter flecks. Visibility follows the
 * real 3D camera distance (extinction + haze tint). Near particles are out of
 * focus: drawn larger but with their light spread over the larger area.
 * Motion is the shared current plus a small per-particle wobble and a slow
 * settle; loose patches of denser silt travel with the flow.
 */
import { useEffect, useLayoutEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { atmosphereParams } from './atmosphere.js'
import { CURRENT_GLSL, mulberry32 } from './currentField.js'
import { useWaterCurrent } from './WaterCurrent.jsx'
import { SUSPENDED_PARTICLES_RENDER_ORDER } from './organism/organismAdapter.js'

export const PARTICLE_MAX = 4000
/** Wrap volume around the camera (world units). Beyond ~60 units particles
 *  are sub-pixel and hazed anyway; a larger box only thins the foreground. */
const BOX = new THREE.Vector3(120, 48, 120)

const vertexShader = /* glsl */ `
attribute vec4 aVar; // x opacity, y size, z fleck / tint, w phase
uniform vec3 uBox;
uniform vec3 uDrift;
uniform float uPxPerUnit;
uniform float uDpr;
uniform float uSize;
uniform float uFadeStart;
uniform float uFadeEnd;
uniform float uHazeOn;
uniform float uHazeDensity;
uniform float uHazeStart;
uniform float uDebug;
varying float vAlpha;
varying float vSoft;
varying float vFleck;
varying float vTint;
varying float vHazeMix;
varying float vDrawPx;
varying float vDebugBand;

${CURRENT_GLSL}

const float TAU = 6.2831853;
/* In focus up to this projected size; beyond it the particle is defocused. */
const float FOCUS_PX = 5.0;
const float MAX_PX = 9.0;
const float BOX_LIFT = 8.0;

void main() {
  float flow = uCurrentFlowTime;

  /* Slow settle (heavier grains sink a little faster). */
  float settle = mix(0.01, 0.045, aVar.y) * flow;
  vec3 seedPos = position * uBox - vec3(0.0, settle, 0.0);
  /* Box sits a little above the camera: below it is mostly seabed. */
  vec3 center = cameraPosition + vec3(0.0, BOX_LIFT, 0.0);
  vec3 rel = mod(seedPos + uDrift - center + 0.5 * uBox, uBox) - 0.5 * uBox;
  vec3 base = center + rel;

  /* Shared current, then a restrained per-particle wobble (~10% of drift). */
  vec3 world = base + currentDisplacement(base);
  float ph = aVar.w * TAU;
  world += 0.32 * uCurrentStrength * vec3(
    sin(flow * mix(0.11, 0.23, aVar.x) + ph),
    0.5 * sin(flow * mix(0.09, 0.19, aVar.z) + ph * 1.7),
    sin(flow * mix(0.10, 0.21, aVar.y) + ph * 2.3)
  );

  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  float depth = max(-mvPosition.z, 0.1);
  float dist = length(world - cameraPosition);

  /* Loose patches of denser silt, periodic in seed space so they wrap
     seamlessly and travel with the particles. */
  vec3 s = position * TAU;
  float patchField = 0.5 * sin(s.x + 2.0 * s.z + 1.3)
    + 0.35 * sin(s.z - s.x + s.y + 4.1)
    + 0.25 * sin(2.0 * s.y + s.x + 0.7);
  float cluster = mix(0.65, 1.0, smoothstep(-0.4, 0.7, patchField));

  /* Most particles small; a few larger grains. Projected size is true
     perspective (view depth). */
  float sizeWorld = uSize * mix(0.75, 2.0, aVar.y * aVar.y * aVar.y);
  float px = sizeWorld * uPxPerUnit / depth;
  float drawPx = clamp(px, 1.0, MAX_PX);
  /* Sub-pixel: fade by linear coverage (area falloff erased the midground).
     Defocused: same light spread over a larger disc. */
  float energy = min(px, 1.0) * min(1.0, (FOCUS_PX * FOCUS_PX) / (drawPx * drawPx));
  vSoft = smoothstep(FOCUS_PX, MAX_PX * 0.7, px);
  vDrawPx = drawPx;

  /* Visibility by real 3D distance: foreground + midground stay clear,
     then grains dissolve into the water, on top of the scene haze. */
  float distanceFade = 1.0 - 0.9 * smoothstep(uFadeStart, uFadeEnd, dist);
  float k = uHazeDensity * max(dist - uHazeStart, 0.0);
  float haze = uHazeOn * (1.0 - exp(-(0.6 * k + k * k)));
  vHazeMix = smoothstep(uFadeStart + 10.0, uFadeEnd + 10.0, dist) * 0.55;

  vec3 e = abs(rel) / (0.5 * uBox);
  float edge = 1.0 - smoothstep(0.68, 0.98, max(max(e.x, e.y), e.z));
  float nearFade = smoothstep(0.6, 2.5, dist);

  vFleck = step(0.93, aVar.z);
  float opacity = mix(0.55, 1.0, aVar.x) * mix(1.0, 1.3, vFleck);
  vAlpha = opacity * cluster * energy * distanceFade * (1.0 - haze * 0.9) * edge * nearFade;
  vTint = aVar.z;

  /* Diagnostic: every particle opaque, ≥ 3 px, colored by distance band
     (green < 25 u, yellow < 60 u, red beyond). */
  vDebugBand = dist < 25.0 ? 0.0 : (dist < 60.0 ? 0.5 : 1.0);
  if (uDebug > 0.5) {
    vAlpha = 1.0;
    drawPx = max(drawPx, 3.0);
  }

  gl_PointSize = drawPx * uDpr;
  gl_Position = projectionMatrix * mvPosition;
}
`

const fragmentShader = /* glsl */ `
uniform vec3 uSilt;
uniform vec3 uBlue;
uniform vec3 uFleck;
uniform vec3 uHaze;
uniform float uOpacity;
uniform float uDebug;
varying float vAlpha;
varying float vSoft;
varying float vFleck;
varying float vTint;
varying float vHazeMix;
varying float vDrawPx;
varying float vDebugBand;

void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  if (uDebug > 0.5) {
    vec3 band = vDebugBand < 0.25 ? vec3(0.1, 0.9, 0.3) : (vDebugBand < 0.75 ? vec3(1.0, 0.85, 0.1) : vec3(1.0, 0.2, 0.25));
    gl_FragColor = vec4(band, 1.0);
    #include <colorspace_fragment>
    return;
  }
  /* 1–2 px grains are their own blur (flat); larger in-focus grains get a
     soft Gaussian falloff; defocused grains a flatter, wider one. */
  float falloff = mix(0.0, mix(2.6, 1.5, vSoft), smoothstep(1.5, 4.0, vDrawPx));
  float profile = exp(-r2 * falloff) * (1.0 - r2 * r2 * smoothstep(1.5, 4.0, vDrawPx));
  vec3 col = mix(uSilt, uBlue, smoothstep(0.35, 0.9, vTint));
  col = mix(col, uFleck, vFleck);
  col = mix(col, uHaze, vHazeMix);
  gl_FragColor = vec4(col, vAlpha * profile * uOpacity);
  #include <colorspace_fragment>
}
`

function createParticleGeometry() {
  const rand = mulberry32(20261105)
  const seeds = new Float32Array(PARTICLE_MAX * 3)
  const variation = new Float32Array(PARTICLE_MAX * 4)
  for (let i = 0; i < PARTICLE_MAX; i += 1) {
    seeds[i * 3] = rand()
    seeds[i * 3 + 1] = rand()
    seeds[i * 3 + 2] = rand()
    for (let j = 0; j < 4; j += 1) variation[i * 4 + j] = rand()
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(seeds, 3))
  geometry.setAttribute('aVar', new THREE.BufferAttribute(variation, 4))
  return geometry
}

function createParticleMaterial(field) {
  return new THREE.ShaderMaterial({
    name: 'WorldFinalParticles',
    vertexShader,
    fragmentShader,
    uniforms: {
      uBox: { value: BOX.clone() },
      uDrift: { value: new THREE.Vector3() },
      uPxPerUnit: { value: 800 },
      uDpr: { value: 1 },
      uSize: { value: 0.12 },
      uFadeStart: { value: 30 },
      uFadeEnd: { value: 85 },
      uDebug: { value: 0 },
      uHazeOn: { value: 1 },
      uHazeDensity: { value: 0 },
      uHazeStart: { value: 0 },
      uSilt: { value: new THREE.Color() },
      uBlue: { value: new THREE.Color() },
      uFleck: { value: new THREE.Color() },
      uHaze: { value: new THREE.Color() },
      uOpacity: { value: 1 },
      uCurrentK: { value: field.modes.map((m) => new THREE.Vector3(...m.k)) },
      uCurrentA: { value: field.modes.map((m) => new THREE.Vector3(...m.a)) },
      uCurrentWP: { value: field.modes.map((m) => new THREE.Vector2(m.omega, m.phase)) },
      uCurrentFlowTime: { value: 0 },
      uCurrentStrength: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
}

const positiveMod = (v, m) => ((v % m) + m) % m

export default function SuspendedParticles({ config, hazeEnabled = true, debug = false }) {
  const { field, state } = useWaterCurrent()
  const geometry = useMemo(() => createParticleGeometry(), [])
  const material = useMemo(() => createParticleMaterial(field), [field])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useLayoutEffect(() => {
    geometry.setDrawRange(0, Math.round(config.particleDensity * PARTICLE_MAX))
    const u = material.uniforms
    const atmosphere = atmosphereParams(config)
    const white = new THREE.Color('#ffffff')
    /* Silt sits just above the water's own color; flecks are pearl. */
    u.uHaze.value.copy(atmosphere.haze)
    u.uSilt.value.copy(atmosphere.haze).lerp(white, 0.58)
    u.uBlue.value.copy(atmosphere.haze).lerp(white, 0.45).lerp(atmosphere.glintCool, 0.25)
    u.uFleck.value.copy(atmosphere.haze).lerp(white, 0.75)
    u.uHazeOn.value = hazeEnabled ? 1 : 0
    u.uHazeDensity.value = config.fogDensity
    u.uHazeStart.value = config.fogDistance
    u.uDebug.value = debug ? 1 : 0
  }, [config, debug, geometry, hazeEnabled, material])

  useFrame(({ camera, size, viewport }) => {
    const u = material.uniforms
    u.uDrift.value.set(
      positiveMod(state.drift[0], BOX.x),
      positiveMod(state.drift[1], BOX.y),
      positiveMod(state.drift[2], BOX.z),
    )
    u.uCurrentFlowTime.value = state.flowTime
    u.uCurrentStrength.value = state.strength
    u.uDpr.value = viewport.dpr
    const fov = camera.isPerspectiveCamera ? camera.fov : 55
    u.uPxPerUnit.value = size.height / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2))
  })

  return (
    <points geometry={geometry} material={material} frustumCulled={false} renderOrder={SUSPENDED_PARTICLES_RENDER_ORDER} />
  )
}
