/**
 * World Final — fits the reused Final Form organism into the seabed scene
 * by patching only the material instances this organism creates (the
 * Playground keeps its own, untouched):
 *
 *   look        (M3B) the membrane is modelled by the scene's key light:
 *               warm lit side / cool water-lit side, a denser face-on core
 *               (thickness), a tight key specular and a thin back-lit rim.
 *               Crystal petals get highlight roll-off (they summed past 1.0
 *               and clipped flat white), frosted faces so their bright edges
 *               outline each shard, and fine key glints.
 *   haze        the seabed's distance haze (tint toward the horizon, then
 *               fade alpha), from view depth, injected before colorspace.
 *   billboard   petals face the camera via `cameraPosition - restOrigin`,
 *               mixing world and local space; the organism is translated and
 *               scaled here, so the camera is supplied in its local frame.
 *   depth       petals are drawn with depthTest off (fine on an empty
 *               backdrop); here they must hide behind terrain.
 *   order       transparent draw order: terrain → organism → suspended silt.
 *
 * The look blocks read locals of the reused shaders; they are only injected
 * when those locals are present, so a changed source degrades to haze only.
 */
import * as THREE from 'three'
import { KEY_DIRECTION } from '../atmosphere.js'

/** Added to each organism layer's own render order (body 0, silt 8, petals 10). */
export const ORGANISM_RENDER_ORDER = 3
/** Suspended particles draw after every organism layer. */
export const SUSPENDED_PARTICLES_RENDER_ORDER = 20

const PATCHED = 'worldFinalOrganismPatched'
const BASE_ORDER = 'worldFinalBaseRenderOrder'

/** Pearlescent membrane parameters for the World Final look (Playground defaults in comments). */
const MEMBRANE_TUNING = {
  uGloss: 0.82, // 0.72
  uInteriorDepth: 1.1, // 0.9
  uThicknessContrast: 0.95, // 0.7
  uIridescence: 1.12, // 1.08
}

export function createOrganismUniforms() {
  return {
    uWfHazeOn: { value: 1 },
    uWfHazeDensity: { value: 0 },
    uWfHazeStart: { value: 0 },
    uWfHazeOffset: { value: 0 },
    uWfHazeColor: { value: new THREE.Color() },
    uWfNearFar: { value: new THREE.Vector2(0.35, 3200) },
    uWfLocalCamera: { value: new THREE.Vector3() },
    uWfKeyDir: { value: KEY_DIRECTION.clone() },
    uWfLook: { value: 1 },
  }
}

const DECLARATIONS = /* glsl */ `
uniform float uWfHazeOn;
uniform float uWfHazeDensity;
uniform float uWfHazeStart;
uniform float uWfHazeOffset;
uniform vec3 uWfHazeColor;
uniform vec2 uWfNearFar;
uniform vec3 uWfKeyDir;
uniform float uWfLook;
`

const MEMBRANE_LOOK = /* glsl */ `
  {
    vec3 wfL = normalize((viewMatrix * vec4(uWfKeyDir, 0.0)).xyz);
    float wfWrap = clamp(dot(normal, wfL) * 0.5 + 0.5, 0.0, 1.0);
    vec3 wfCol = gl_FragColor.rgb;
    /* Soft key modelling; the shadow side never goes dark. */
    wfCol *= mix(0.82, 1.05, smoothstep(0.1, 0.95, wfWrap));
    /* Warm key side, cool water-lit side. */
    wfCol *= mix(vec3(0.93, 0.97, 1.04), vec3(1.04, 1.0, 0.955), smoothstep(0.25, 0.85, wfWrap));
    /* Face-on core reads as thicker, denser membrane. */
    float wfCore = NdotV * NdotV;
    wfCol = mix(wfCol, wfCol * vec3(0.84, 0.82, 0.9), wfCore * (0.2 + 0.25 * thickness));
    /* Seabed bounce on the underside. */
    wfCol *= mix(vec3(1.0), vec3(0.94, 0.9, 0.97), smoothstep(0.0, -0.8, worldNormal.y) * 0.6);
    /* Key specular: tight wet sheen + broad gloss, weaker in recesses. */
    vec3 wfH = normalize(wfL + viewDirection);
    float wfNH = max(dot(normal, wfH), 0.0);
    float wfSpec = (pow(wfNH, 140.0) * 0.5 + pow(wfNH, 26.0) * 0.07)
      * mix(0.65, 1.2, curvature) * (1.0 - recess * 0.5);
    wfCol += vec3(1.0, 0.985, 0.96) * wfSpec;
    /* Thin edges: rim shifts cyan → pink across the edge; glows when back-lit. */
    float wfEdge = 1.0 - NdotV;
    float wfBack = smoothstep(-0.1, 0.8, -dot(viewDirection, wfL));
    vec3 wfRim = mix(vec3(0.62, 0.86, 0.96), vec3(0.95, 0.72, 0.86), smoothstep(0.55, 0.95, wfEdge));
    wfCol += wfRim * pow(wfEdge, 3.0) * (0.05 + 0.2 * wfBack);
    vec3 wfOver = max(wfCol - vec3(0.84), vec3(0.0));
    wfCol = min(wfCol, vec3(0.84)) + wfOver / (1.0 + wfOver * 6.0);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, wfCol, uWfLook);
    /* Layered translucency: thin rim more see-through than the core. */
    gl_FragColor.a *= mix(1.0, mix(0.8, 1.0, smoothstep(0.05, 0.55, NdotV)), uWfLook);
  }
`

const PETAL_LOOK = /* glsl */ `
  {
    vec3 wfL = normalize((viewMatrix * vec4(uWfKeyDir, 0.0)).xyz);
    vec3 wfCol = gl_FragColor.rgb;
    /* Frosted faces settle slightly cool; edges stay bright. */
    wfCol *= mix(vec3(1.0), vec3(0.9, 0.94, 1.0), pow(facing, 1.4) * 0.35);
    /* Fine glints from the scene key along the facets. */
    vec3 wfH = normalize(wfL + viewDirection);
    wfCol += vec3(1.0, 0.98, 0.95) * pow(max(dot(normal, wfH), 0.0), 220.0) * 0.55;
    /* Faint prismatic split at grazing edges. */
    wfCol *= mix(vec3(1.0), vec3(0.96, 1.0, 1.05), smoothstep(0.3, 0.9, edge));
    /* Highlight shoulder: the shader sums well past 1.0 (flat white); keep
       that range as gradation between the knee and near-white instead. */
    vec3 wfOver = max(wfCol - vec3(0.8), vec3(0.0));
    wfCol = min(wfCol, vec3(0.8)) + wfOver / (1.0 + wfOver * 5.5);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, wfCol, uWfLook);
  }
`

const HAZE_APPLY = /* glsl */ `
  {
    float wfNdcZ = gl_FragCoord.z * 2.0 - 1.0;
    float wfDepth = 2.0 * uWfNearFar.x * uWfNearFar.y
      / (uWfNearFar.y + uWfNearFar.x - wfNdcZ * (uWfNearFar.y - uWfNearFar.x));
    float wfK = uWfHazeDensity * max(wfDepth - uWfHazeStart - uWfHazeOffset, 0.0);
    float wfHaze = uWfHazeOn * (1.0 - exp(-(0.6 * wfK + wfK * wfK)));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uWfHazeColor, wfHaze * 0.88);
    gl_FragColor.a *= 1.0 - smoothstep(0.42, 0.98, wfHaze);
  }
  #include <colorspace_fragment>`

/** Which look block a reused fragment shader can take (by its locals). */
function lookFor(source, billboard) {
  if (
    !billboard &&
    source.includes('float recess') &&
    source.includes('float thickness') &&
    source.includes('float curvature') &&
    source.includes('vec3 worldNormal')
  ) {
    return MEMBRANE_LOOK
  }
  if (billboard && source.includes('float edge = pow(1.0 - facing')) return PETAL_LOOK
  return ''
}

function patchMaterial(material, uniforms, billboard) {
  if (material.userData[PATCHED]) return
  material.userData[PATCHED] = true
  if (!billboard && material.uniforms) {
    for (const [name, value] of Object.entries(MEMBRANE_TUNING)) {
      if (material.uniforms[name]) material.uniforms[name].value = value
    }
  }
  const previous = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer)
    Object.assign(shader.uniforms, uniforms)
    const look = lookFor(shader.fragmentShader, billboard)
    shader.fragmentShader =
      DECLARATIONS +
      shader.fragmentShader.replace('#include <colorspace_fragment>', look + HAZE_APPLY)
    if (billboard) {
      shader.vertexShader =
        'uniform vec3 uWfLocalCamera;\n' +
        shader.vertexShader.replaceAll('cameraPosition - restOrigin', 'uWfLocalCamera - restOrigin')
    }
  }
  const baseKey = material.customProgramCacheKey.bind(material)
  material.customProgramCacheKey = () => `${baseKey()}|wf-organism${billboard ? '-billboard' : ''}`
  material.needsUpdate = true
}

/**
 * Call every frame after the organism group's matrices are current.
 * Patching happens once per material; flags and order are re-asserted
 * because the reused components reset them on their own prop changes.
 */
export function syncOrganismRendering(root, uniforms, { bodyDepthWrite = true } = {}) {
  let petalMesh = null
  root.traverse((object) => {
    if (!object.isMesh && !object.isPoints) return
    if (object.userData[BASE_ORDER] === undefined) object.userData[BASE_ORDER] = object.renderOrder
    object.renderOrder = ORGANISM_RENDER_ORDER + object.userData[BASE_ORDER]
    const material = object.material
    if (!material?.isShaderMaterial) return
    const petals = Boolean(object.isInstancedMesh)
    patchMaterial(material, uniforms, petals)
    if (petals) {
      material.depthTest = true
      petalMesh ??= object
    } else if (object.isMesh && bodyDepthWrite) {
      material.depthWrite = true
    }
  })
  return petalMesh
}

const _inverse = new THREE.Matrix4()

/** Camera position in the petals' local frame (for the billboard fix). */
export function updateLocalCamera(uniforms, mesh, camera) {
  if (!mesh) return
  _inverse.copy(mesh.matrixWorld).invert()
  uniforms.uWfLocalCamera.value.copy(camera.position).applyMatrix4(_inverse)
}
