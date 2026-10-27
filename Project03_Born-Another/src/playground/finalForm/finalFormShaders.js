/**
 * Final Form Lab — instance-placed petal shaders.
 * Fragment look reuses Explore Scatter iced membrane; vertex path places
 * clusters on World's already-deformed membrane (no Study GPU morph).
 */

/** Re-export Explore iced fragment for a single import site. */
export { scatterAttachmentFragmentShader as finalFormPetalFragmentShader } from '../../surfaceShader.js'

/**
 * Instance matrix = deformed surface frame (+Y = outward normal).
 * Keeps aAttach / fresnel varyings expected by the iced fragment shader.
 */
export const finalFormPetalVertexShader = /* glsl */ `
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

/** Soft grit points — Explore tint aesthetic without Study GPGPU flow. */
export const finalFormGritVertexShader = /* glsl */ `
  attribute float aSize;
  attribute vec3 aTint;
  varying float vAlpha;
  varying vec3 vTint;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float dist = max(0.6, -mvPosition.z);
    gl_PointSize = aSize * (180.0 / dist);
    gl_Position = projectionMatrix * mvPosition;
    vAlpha = 0.22 + aSize * 0.035;
    vTint = aTint;
  }
`

export const finalFormGritFragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  varying vec3 vTint;

  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float d = dot(uv, uv);
    if (d > 1.0) discard;
    float soft = exp(-d * 2.8);
    gl_FragColor = vec4(vTint, soft * vAlpha * uOpacity);
    #include <colorspace_fragment>
  }
`
