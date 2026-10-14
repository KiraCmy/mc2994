import {
  developmentDisplacementGlsl,
  macroMorphologyGlsl,
} from '../surfaceShader.js'

/**
 * Deforms rest-space vein ribbons with the exact body formula used by the
 * lifecycle Specimen (individuality / development / decay), so veins stay
 * glued to the membrane through AGE morphing, breathing and late warp.
 */
export const veinVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uAge;
  uniform float uSeed;
  uniform float uNoiseScale;
  uniform float uSpeed;
  uniform float uPulseSpeed;
  uniform float uDisplacement;
  uniform float uNoiseAmount;
  uniform float uDecayScale;
  uniform float uDecayDisplacement;
  uniform float uLateWarp;

  uniform float uOffset;
  uniform float uBaseThickness;
  uniform float uTaper;
  uniform float uMinWidth;
  uniform float uLag;
  uniform float uBodySegments;

  attribute vec3 aTangent;
  attribute vec4 aInfo;
  attribute vec2 aBranch;

  varying float vAlpha;
  varying float vEdge;

  ${developmentDisplacementGlsl}
  ${macroMorphologyGlsl}

  vec3 veinSurface(vec3 rest, out vec3 n) {
    vec3 rn = normalize(rest);
    if (uAge <= 0.02) {
      n = rn;
      return rn;
    }
    vec3 macroPos = macroMorphologyPosition(rn);
    vec3 macroN = macroMorphologyNormal(rn, rn);
    float amount = developmentDisplaceAmount(macroPos);
    if (uAge >= 0.8) {
      float warpBias = max(uLateWarp, 0.001);
      float decayNoise = fbm(macroPos * uDecayScale + vec3(uSeed * 0.41, uSeed * 0.17, 2.3));
      float brittle = fbm(macroPos * uDecayScale * 2.8 + vec3(uSeed * 0.11, 5.2, 1.4));
      float warpField = mix(decayNoise, abs(brittle - 0.5) * 2.0, clamp(warpBias - 0.7, 0.0, 1.0));
      float instability = smoothstep(0.65, 1.0, uAge);
      amount += (warpField * 2.0 - 1.0) * uDecayDisplacement * instability * warpBias;
    }
    n = macroN;
    return macroPos + macroN * amount;
  }

  // The body is a THREE.SphereGeometry grid; the GPU draws flat facets between
  // its deformed vertices. Veins are placed on those same facets.
  const float VEIN_PI = 3.141592653589793;

  vec3 bodyGridRest(float ix, float iy) {
    float phi = ix / uBodySegments * 2.0 * VEIN_PI;
    float theta = iy / uBodySegments * VEIN_PI;
    return vec3(-cos(phi) * sin(theta), cos(theta), sin(phi) * sin(theta));
  }

  vec2 bodyGridCoord(vec3 r) {
    float theta = acos(clamp(r.y, -1.0, 1.0));
    float phi = atan(r.z, -r.x);
    if (phi < 0.0) phi += 2.0 * VEIN_PI;
    return vec2(phi / (2.0 * VEIN_PI), theta / VEIN_PI) * uBodySegments;
  }

  // mode 0/1: the two triangles of a regular cell; 2: top pole row; 3: bottom pole row.
  vec2 facetWeights(vec2 f, float mode) {
    if (mode < 0.5) return vec2(f.x - f.y, f.y);
    if (mode < 1.5) return vec2(f.y - f.x, f.x);
    if (mode < 2.5) return vec2(f.y * (1.0 - f.x), f.x * f.y);
    return vec2(f.x * (1.0 - f.y), f.y);
  }

  void main() {
    float side = aInfo.x;
    float along = aInfo.y;
    float dist = aInfo.z;
    float h = aInfo.w;
    float width0 = aBranch.x;
    float nest = aBranch.y;

    vec3 rest = normalize(position);
    float S = uBodySegments;
    vec2 g = bodyGridCoord(rest);
    float ix = clamp(floor(g.x), 0.0, S - 1.0);
    float iy = clamp(floor(g.y), 0.0, S - 1.0);
    vec2 f = g - vec2(ix, iy);
    float mode = iy < 0.5 ? 2.0 : (iy > S - 1.5 ? 3.0 : (f.x >= f.y ? 0.0 : 1.0));
    vec2 o1 = (mode < 0.5 || mode > 2.5) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec2 o2 = mode > 2.5 ? vec2(0.0, 1.0) : vec2(1.0, 1.0);

    vec3 nTmp;
    vec3 P0 = veinSurface(bodyGridRest(ix, iy), nTmp);
    vec3 P1 = veinSurface(bodyGridRest(ix + o1.x, iy + o1.y), nTmp);
    vec3 P2 = veinSurface(bodyGridRest(ix + o2.x, iy + o2.y), nTmp);
    vec3 e1 = P1 - P0;
    vec3 e2 = P2 - P0;

    vec2 bw = facetWeights(f, mode);
    vec3 p = P0 + e1 * bw.x + e2 * bw.y;
    vec3 n = cross(e1, e2);
    n = length(n) > 1e-9 ? normalize(n) : normalize(p);
    if (dot(n, p) < 0.0) n = -n;

    vec2 gq = bodyGridCoord(normalize(rest + aTangent * 0.01));
    if (gq.x - g.x > S * 0.5) gq.x -= S;
    else if (g.x - gq.x > S * 0.5) gq.x += S;
    vec2 wq = facetWeights(gq - vec2(ix, iy), mode);
    vec3 t = e1 * (wq.x - bw.x) + e2 * (wq.y - bw.y);
    t -= n * dot(t, n);
    float tl = length(t);
    t = tl > 1e-9 ? t / tl : normalize(cross(n, vec3(0.0, 1.0, 0.0)));
    vec3 s = normalize(cross(t, n));

    float age = clamp(uAge, 0.0, 1.0);

    // Growth (0–0.5): a front travels out from each hub; deeper levels lag.
    float growT = clamp(age / 0.5, 0.0, 1.0);
    float front = growT * (1.0 + 2.0 * uLag) - nest * uLag;
    float lead = front - dist;
    float grown = step(0.0, lead);
    float tipShape = sqrt(clamp(lead / 0.08, 0.0, 1.0));

    // Decay (0.7–1): finer levels thin, retreat and fragment first.
    float fade = clamp((age - 0.7) / 0.3, 0.0, 1.0);
    float isP = 1.0 - step(0.5, nest);
    float isS = step(0.5, nest) * (1.0 - step(1.5, nest));
    float isT = step(1.5, nest);
    float thick =
      isP * (1.0 - smoothstep(0.0, 0.55, fade) * 0.62) +
      isS * (1.0 - smoothstep(0.0, 0.6, fade) * 0.8) +
      isT * (1.0 - smoothstep(0.0, 0.35, fade) * 0.9);
    float retreat =
      isP * (1.0 - smoothstep(0.12, 0.9, fade) * 0.5) +
      isS * (1.0 - smoothstep(0.04, 0.5, fade) * 0.96) +
      isT * (1.0 - smoothstep(0.0, 0.32, fade));
    float frag =
      isP * smoothstep(0.08, 0.75, fade) * 0.72 +
      isS * smoothstep(0.05, 0.55, fade) +
      isT * smoothstep(0.0, 0.4, fade);

    float keep = grown * step(along, retreat) * step(frag, h) * step(1e-4, age);
    float retreatTip = clamp((retreat - along) / 0.06, 0.0, 1.0);

    float taperExp = 0.35 + clamp(uTaper, 0.0, 1.0) * 2.15;
    float w = uBaseThickness * width0 * pow(max(0.0, 1.0 - along), taperExp);
    w *= thick * tipShape * mix(1.0, retreatTip, step(0.001, fade));

    float drawW = keep * max(w, uMinWidth);
    vAlpha = keep * clamp(w / uMinWidth, 0.45, 1.0) * (1.0 - fade * 0.45);
    vEdge = side;

    vec3 displaced = p + n * uOffset + s * side * drawW;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`

export const veinFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying float vAlpha;
  varying float vEdge;

  void main() {
    float a = vAlpha * uOpacity * (1.0 - smoothstep(0.55, 1.0, abs(vEdge)));
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor, a);
  }
`
