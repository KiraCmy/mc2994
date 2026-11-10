/**
 * Exp07 Final Habitat — shaders and material patches (no React), so they can
 * be compiled and checked outside the app.
 */
import * as THREE from 'three'

export const LIGHT_DIR = new THREE.Vector3(0.62, 0.48, -0.62).normalize()

export const nucleusVertex = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vLocal;
  varying vec3 vViewDir;
  void main() {
    vLocal = position;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

export const nucleusFragment = /* glsl */ `
  uniform float uTime;
  uniform float uLevel;
  uniform vec3 uGold;
  uniform vec3 uPink;
  uniform vec3 uFrost;
  uniform vec3 uShell;
  uniform vec3 uBlue;
  uniform float uOpen;
  varying vec3 vNormalW;
  varying vec3 vLocal;
  varying vec3 vViewDir;
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vnoise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
                   mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
               mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
                   mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
  }
  void main() {
    float facing = max(dot(normalize(vNormalW), normalize(vViewDir)), 0.0);
    float fres = pow(1.0 - facing, 2.2);
    vec3 p = vLocal * 2.4;
    float n = vnoise(p + vec3(0.0, uTime * 0.07, 0.0));
    float n2 = vnoise(p * 2.3 + n * 1.8);
    float fil = pow(1.0 - abs(sin((n2 * 5.0 + vLocal.y * 2.6) * 3.14159)), 7.0);
    float core = pow(facing, 3.0);
    vec3 col = mix(uGold, uPink, smoothstep(0.25, 0.8, n)) * (0.18 + 0.5 * fres + 0.55 * core);
    col = mix(col, uBlue * (0.3 + 0.6 * fres + 0.4 * core), smoothstep(0.55, 0.85, n2) * 0.55);
    col += uGold * fil * 0.22 * (0.4 + fres);
    float veins = pow(1.0 - abs(sin(vnoise(p * 2.1 + 7.0) * 15.7)), 30.0);
    col = mix(col, uFrost * 1.3, veins * 0.55 * smoothstep(0.08, 0.85, uLevel));
    col *= 1.0 - 0.12 * smoothstep(0.4, 1.0, uLevel);
    /* No silhouette: the rim fades into the membrane's own pearl tone. */
    float body = smoothstep(0.0, 0.95, facing);
    body *= body;
    col = mix(uShell, col, body);
    /* Unfolding: the core kindles behind the opening. */
    col += mix(uGold, vec3(1.0, 0.9, 0.7), core) * uOpen * (0.5 + 1.4 * core + fil * 0.8);
    gl_FragColor = vec4(col, 1.0);
  }
`

export function patchMembrane(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    /* Optional edge light (silhouette against the habitat). */
    shader.uniforms.uRim ??= { value: 0 }
    shader.uniforms.uRimColor ??= { value: new THREE.Color('#e2f4ff') }
    /* Optional contact dents (up to three neighbours). */
    shader.uniforms.uContactDir ??= { value: [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 1)] }
    shader.uniforms.uContactAmt ??= { value: [0, 0, 0] }
    shader.uniforms.uContactDepth ??= { value: 0 }
    shader.uniforms.uBodyCentre ??= { value: new THREE.Vector3() }
    /* Optional drag: the membrane trails behind its motion through water. */
    shader.uniforms.uDrift ??= { value: new THREE.Vector3() }
    /* Optional end-of-life coil (husk shape). */
    shader.uniforms.uCoil ??= { value: 0 }
    /* Optional unfolding (see UNFOLD notes below): folds, flow strands, and
       an aperture that opens toward the viewer onto a light inside. */
    shader.uniforms.uUnit ??= { value: 1 }
    shader.uniforms.uFold ??= { value: 0 }
    shader.uniforms.uOpen ??= { value: 0 }
    shader.uniforms.uOpenDir ??= { value: new THREE.Vector3(0, 0, 1) }
    shader.uniforms.uFlow ??= { value: 0 }
    shader.uniforms.uFlowTime ??= { value: 0 }
    shader.uniforms.uSwirl ??= { value: 0 }
    shader.uniforms.uInnerLight ??= { value: new THREE.Color('#ffc277') }
    shader.uniforms.uBubble ??= { value: 0 }
    shader.uniforms.uStrata ??= { value: 0 }
    shader.uniforms.uShrink ??= { value: 0 }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aTent;
        attribute float aFrost;
        attribute vec3 aFacetOffset;
        attribute vec3 aFacetNormal;
        attribute vec3 aCoilOffset;
        attribute vec3 aCoilNormal;
        uniform float uCoil;
        uniform float uTime;
        uniform float uBreath;
        uniform float uTent;
        uniform float uFacet;
        uniform vec3 uContactDir[3];
        uniform float uContactAmt[3];
        uniform float uContactDepth;
        uniform vec3 uBodyCentre;
        uniform vec3 uDrift;
        uniform float uUnit;
        uniform float uFold;
        uniform float uOpen;
        uniform vec3 uOpenDir;
        uniform float uFlowTime;
        uniform float uSwirl;
        uniform float uBubble;
        uniform float uStrata;
        uniform float uShrink;
        varying float vBubble;
        varying float vFrost;
        varying vec3 vLocal;
        varying vec3 vFromCentre;
        varying float vFold;
        float bnHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float bnNoise(vec3 x) {
          vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(bnHash(i), bnHash(i + vec3(1.0, 0.0, 0.0)), f.x),
                         mix(bnHash(i + vec3(0.0, 1.0, 0.0)), bnHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
                     mix(mix(bnHash(i + vec3(0.0, 0.0, 1.0)), bnHash(i + vec3(1.0, 0.0, 1.0)), f.x),
                         mix(bnHash(i + vec3(0.0, 1.0, 1.0)), bnHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
        }
        /* Billowed lumps on lumps: rounded bulbs with creases between them. */
        float bnFold(vec3 p) {
          float a = 0.0;
          float w = 0.5;
          for (int i = 0; i < 4; i++) {
            a += abs(bnNoise(p) * 2.0 - 1.0) * w;
            p = p * 2.07 + vec3(1.7, 9.2, 3.1);
            w *= 0.5;
          }
          return a;
        }
        /* The same field, two octaves only: what the mesh can actually carry
           (finer octaves alias into broken-looking facets). */
        float bnFoldLow(vec3 p) {
          return abs(bnNoise(p) * 2.0 - 1.0) * 0.5 + abs(bnNoise(p * 2.07 + vec3(1.7, 9.2, 3.1)) * 2.0 - 1.0) * 0.25 + 0.11;
        }
        /* Frame around the opening axis. */
        void bnFrame(vec3 ax, out vec3 t1, out vec3 t2) {
          t1 = normalize(abs(ax.y) < 0.95 ? cross(ax, vec3(0.0, 1.0, 0.0)) : cross(ax, vec3(1.0, 0.0, 0.0)));
          t2 = cross(ax, t1);
        }
        /* Fibre bundles: meridians converging on the mouth (uOpenDir),
           wavering with a slow warp and twisted by turbulence. */
        float bnMerAt(vec3 fc, vec3 local) {
          vec3 t1; vec3 t2;
          bnFrame(uOpenDir, t1, t2);
          float ang = atan(dot(fc, t2), dot(fc, t1));
          float lat = acos(clamp(dot(fc, uOpenDir), -1.0, 1.0));
          vec3 w = local / max(uUnit, 1e-4) * 1.6;
          float warp = bnNoise(w * 1.3 + vec3(0.0, uFlowTime * 0.03, 0.0)) * 2.0 - 1.0;
          return ang * 9.0 + warp * (1.4 + 2.4 * uSwirl) + lat * (1.2 + 2.6 * uSwirl);
        }
        /* The body's own relief along those bundles: ridges and grooves of
           the skin itself, calm near the mouth and at the far pole. */
        float bnRidge(vec3 fc, vec3 local) {
          float mer = bnMerAt(fc, local);
          float lat = acos(clamp(dot(fc, uOpenDir), -1.0, 1.0));
          float fade = smoothstep(0.18, 0.55, lat) * (1.0 - smoothstep(2.55, 3.05, lat));
          float b = 0.5 + 0.5 * sin(mer);
          float sub = 0.5 + 0.5 * sin(mer * 3.0 + 1.3);
          return (pow(b, 1.6) * 0.75 + pow(sub, 2.0) * 0.25 - 0.36) * fade;
        }
        /* Wet: blisters — domes of different sizes swelling out of the skin. */
        float bnBubble(vec3 fc) {
          vec3 p = fc * 3.2 + vec3(5.3, 1.7, 9.1);
          vec3 i = floor(p);
          vec3 f = p - i;
          float best = 0.0;
          for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
            vec3 c = vec3(float(x), float(y), float(z));
            vec3 ic = i + c;
            vec3 d = c + vec3(bnHash(ic), bnHash(ic + vec3(17.0, 3.0, 11.0)), bnHash(ic + vec3(5.0, 29.0, 7.0))) - f;
            float r = 0.32 + 0.3 * bnHash(ic + vec3(41.0, 13.0, 2.0));
            float q = 1.0 - dot(d, d) / (r * r);
            if (q > 0.0) best = max(best, sqrt(q) * r / 0.62);
          }
          return best;
        }
        /* Turbulent: the body stratifies into stacked bands with grooves. */
        float bnStrata(vec3 local) {
          vec3 w = local / max(uUnit, 1e-4);
          float t = w.y * 3.2 + (bnNoise(w * 1.1 + vec3(3.0, 0.0, 0.0)) - 0.5) * 0.9;
          float f = fract(t);
          return smoothstep(0.0, 0.2, f) * (1.0 - smoothstep(0.72, 1.0, f)) - 0.55;
        }`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        /* Safe blends: a zero-length mix (opposite or degenerate normals) would
           normalize to NaN, which Apple GPUs pass straight into the frame and
           the bloom blur spreads into a screen-wide flash. */
        vec3 nFacet = mix(objectNormal, aFacetNormal, uFacet);
        objectNormal = dot(nFacet, nFacet) > 1e-10 ? normalize(nFacet) : objectNormal;
        if (uCoil > 0.0) {
          vec3 nCoil = mix(objectNormal, aCoilNormal, uCoil);
          objectNormal = dot(nCoil, nCoil) > 1e-10 ? normalize(nCoil) : objectNormal;
        }
        /* UNFOLD — relief along the fibres: the skin rises into ridges and
           sinks into grooves following the bundles (the form itself changes;
           nothing is added on top). The normal follows the relief. */
        vec3 bnSmoothN = objectNormal;
        vec3 bnRel = position - uBodyCentre;
        float bnR = length(bnRel);
        vec3 bnFcN = bnR > 1e-6 ? bnRel / bnR : vec3(0.0, 1.0, 0.0);
        float bnB0 = uBubble > 1e-6 ? bnBubble(bnFcN) : 0.0;
        float bnF0 = uFold * bnRidge(bnFcN, position) + uBubble * bnB0 + (uStrata > 1e-6 ? uStrata * bnStrata(position) : 0.0);
        float bnFoldH = 0.0;
        if (uFold + uBubble + uStrata > 1e-5 && bnR > 1e-6) {
          vec3 tA = normalize(cross(bnFcN, abs(bnFcN.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
          vec3 tB = cross(bnFcN, tA);
          float e = 0.015;
          vec3 fA = normalize(bnFcN + tA * e);
          vec3 fB = normalize(bnFcN + tB * e);
          vec3 lA = position + tA * e * bnR;
          vec3 lB = position + tB * e * bnR;
          float hA = uFold * bnRidge(fA, lA) + (uBubble > 1e-6 ? uBubble * bnBubble(fA) : 0.0) + (uStrata > 1e-6 ? uStrata * bnStrata(lA) : 0.0);
          float hB = uFold * bnRidge(fB, lB) + (uBubble > 1e-6 ? uBubble * bnBubble(fB) : 0.0) + (uStrata > 1e-6 ? uStrata * bnStrata(lB) : 0.0);
          vec3 g = (tA * (hA - bnF0) + tB * (hB - bnF0)) / (e * bnR);
          vec3 nFold = objectNormal - (g - objectNormal * dot(g, objectNormal));
          objectNormal = dot(nFold, nFold) > 1e-10 ? normalize(nFold) : objectNormal;
          bnFoldH = bnF0;
        }`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        transformed += aFacetOffset * uFacet + aCoilOffset * uCoil;
        float wob = sin(position.x * 2.3 + uTime * 0.55) * sin(position.y * 1.9 - uTime * 0.42) * sin(position.z * 2.1 + uTime * 0.37);
        transformed += objectNormal * (wob * uBreath + aTent * uTent);
        /* Soft contact: flatten where a neighbour presses, a slight swell
           around the pressed patch (volume moves aside, like jelly). */
        vec3 fromCentreRaw = position - uBodyCentre;
        vec3 fromCentre = dot(fromCentreRaw, fromCentreRaw) > 1e-10 ? normalize(fromCentreRaw) : vec3(0.0, 1.0, 0.0);
        /* Water drag: the trailing side lags behind, the leading side eases flat. */
        float driftLen = length(uDrift);
        if (driftLen > 1e-5) {
          float lead = dot(fromCentre, uDrift / driftLen);
          transformed -= uDrift * (0.75 * smoothstep(0.0, 1.0, -lead) + 0.2 * smoothstep(0.0, 1.0, lead));
        }
        for (int ci = 0; ci < 3; ci++) {
          float cd = dot(fromCentre, uContactDir[ci]);
          float press = smoothstep(0.5, 1.0, cd);
          float swell = smoothstep(0.1, 0.5, cd) * (1.0 - smoothstep(0.5, 0.78, cd));
          transformed += fromCentre * uContactAmt[ci] * uContactDepth * (0.3 * swell - press);
        }
        /* UNFOLD — the aperture: the skin facing the viewer sinks inward in
           petals, its lip rolling outward, opening onto the light inside. */
        transformed += objectNormal * bnFoldH;
        {
          float apW = 0.03 + 0.5 * uOpen;
          float apD = dot(fromCentre, uOpenDir);
          vec3 at1; vec3 at2;
          bnFrame(uOpenDir, at1, at2);
          float apAng = atan(dot(fromCentre, at2), dot(fromCentre, at1));
          float petal = 0.5 + 0.5 * cos(apAng * 5.0 + bnNoise(fromCentre * 3.0) * 2.4);
          float inCap = smoothstep(1.0 - apW, 1.0, apD);
          transformed -= fromCentre * inCap * uOpen * uUnit * (0.5 - 0.22 * petal);
          float lip = smoothstep(1.0 - apW - 0.28, 1.0 - apW, apD) * (1.0 - smoothstep(1.0 - apW, 1.0 - apW + 0.14, apD));
          transformed += fromCentre * lip * uOpen * uUnit * 0.1 * (0.5 + petal);
        }
        /* Cold: the body contracts and wrinkles. */
        if (uShrink > 1e-4) {
          transformed = uBodyCentre + (transformed - uBodyCentre) * (1.0 - 0.14 * uShrink);
          transformed += objectNormal * (bnNoise(fromCentre * 8.0 + 2.0) - 0.5) * uShrink * uUnit * 0.06;
        }
        vFrost = aFrost;
        vLocal = position;
        vFromCentre = fromCentre;
        vBubble = bnB0 * step(1e-6, uBubble);
        vFold = clamp(0.6 + bnF0 / (max(uUnit, 1e-4) * 0.12), 0.0, 1.0);`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uRime;
        uniform vec3 uCore;
        uniform float uCoreGlow;
        uniform float uFilm;
        uniform float uRim;
        uniform vec3 uRimColor;
        uniform float uTime;
        varying float vFrost;
        varying vec3 vLocal;
        varying vec3 vFromCentre;
        varying float vFold;
        varying float vBubble;
        uniform float uUnit;
        uniform float uOpen;
        uniform vec3 uOpenDir;
        uniform float uFlow;
        uniform float uFlowTime;
        uniform float uSwirl;
        uniform vec3 uInnerLight;
        float frostHash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
        float bnHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float bnNoise(vec3 x) {
          vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(bnHash(i), bnHash(i + vec3(1.0, 0.0, 0.0)), f.x),
                         mix(bnHash(i + vec3(0.0, 1.0, 0.0)), bnHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
                     mix(mix(bnHash(i + vec3(0.0, 0.0, 1.0)), bnHash(i + vec3(1.0, 0.0, 1.0)), f.x),
                         mix(bnHash(i + vec3(0.0, 1.0, 1.0)), bnHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
        }
        /* Billowed lumps on lumps: rounded bulbs with creases between them. */
        float bnFold(vec3 p) {
          float a = 0.0;
          float w = 0.5;
          for (int i = 0; i < 4; i++) {
            a += abs(bnNoise(p) * 2.0 - 1.0) * w;
            p = p * 2.07 + vec3(1.7, 9.2, 3.1);
            w *= 0.5;
          }
          return a;
        }
        /* The same field, two octaves only: what the mesh can actually carry
           (finer octaves alias into broken-looking facets). */
        float bnFoldLow(vec3 p) {
          return abs(bnNoise(p) * 2.0 - 1.0) * 0.5 + abs(bnNoise(p * 2.07 + vec3(1.7, 9.2, 3.1)) * 2.0 - 1.0) * 0.25 + 0.11;
        }
        /* Frame around the opening axis. */
        void bnFrame(vec3 ax, out vec3 t1, out vec3 t2) {
          t1 = normalize(abs(ax.y) < 0.95 ? cross(ax, vec3(0.0, 1.0, 0.0)) : cross(ax, vec3(1.0, 0.0, 0.0)));
          t2 = cross(ax, t1);
        }
        /* Fibre bundles: meridians converging on the mouth (uOpenDir),
           wavering with a slow warp and twisted by turbulence. */
        float bnMerAt(vec3 fc, vec3 local) {
          vec3 t1; vec3 t2;
          bnFrame(uOpenDir, t1, t2);
          float ang = atan(dot(fc, t2), dot(fc, t1));
          float lat = acos(clamp(dot(fc, uOpenDir), -1.0, 1.0));
          vec3 w = local / max(uUnit, 1e-4) * 1.6;
          float warp = bnNoise(w * 1.3 + vec3(0.0, uFlowTime * 0.03, 0.0)) * 2.0 - 1.0;
          return ang * 9.0 + warp * (1.4 + 2.4 * uSwirl) + lat * (1.2 + 2.6 * uSwirl);
        }
        /* The body's own relief along those bundles: ridges and grooves of
           the skin itself, calm near the mouth and at the far pole. */
        float bnRidge(vec3 fc, vec3 local) {
          float mer = bnMerAt(fc, local);
          float lat = acos(clamp(dot(fc, uOpenDir), -1.0, 1.0));
          float fade = smoothstep(0.18, 0.55, lat) * (1.0 - smoothstep(2.55, 3.05, lat));
          float b = 0.5 + 0.5 * sin(mer);
          float sub = 0.5 + 0.5 * sin(mer * 3.0 + 1.3);
          return (pow(b, 1.6) * 0.75 + pow(sub, 2.0) * 0.25 - 0.36) * fade;
        }
        /* Wet: blisters — domes of different sizes swelling out of the skin. */
        float bnBubble(vec3 fc) {
          vec3 p = fc * 3.2 + vec3(5.3, 1.7, 9.1);
          vec3 i = floor(p);
          vec3 f = p - i;
          float best = 0.0;
          for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
            vec3 c = vec3(float(x), float(y), float(z));
            vec3 ic = i + c;
            vec3 d = c + vec3(bnHash(ic), bnHash(ic + vec3(17.0, 3.0, 11.0)), bnHash(ic + vec3(5.0, 29.0, 7.0))) - f;
            float r = 0.32 + 0.3 * bnHash(ic + vec3(41.0, 13.0, 2.0));
            float q = 1.0 - dot(d, d) / (r * r);
            if (q > 0.0) best = max(best, sqrt(q) * r / 0.62);
          }
          return best;
        }
        /* Turbulent: the body stratifies into stacked bands with grooves. */
        float bnStrata(vec3 local) {
          vec3 w = local / max(uUnit, 1e-4);
          float t = w.y * 3.2 + (bnNoise(w * 1.1 + vec3(3.0, 0.0, 0.0)) - 0.5) * 0.9;
          float f = fract(t);
          return smoothstep(0.0, 0.2, f) * (1.0 - smoothstep(0.72, 1.0, f)) - 0.55;
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        /* UNFOLD — flow strands: fine combed fibres running in bundles along
           meridians that converge on the opening, twisted by turbulence and
           drifting slowly toward it while the body lives. */
        vec3 bnFc = normalize(vFromCentre);
        vec3 bnT1; vec3 bnT2;
        bnFrame(uOpenDir, bnT1, bnT2);
        float bnApD = dot(bnFc, uOpenDir);
        float bnAng = atan(dot(bnFc, bnT2), dot(bnFc, bnT1));
        float bnLat = acos(clamp(bnApD, -1.0, 1.0));
        vec3 bnW = vLocal / max(uUnit, 1e-4) * 1.6;
        float bnWarp = bnNoise(bnW * 1.3 + vec3(0.0, uFlowTime * 0.03, 0.0)) * 2.0 - 1.0;
        float bnMer = bnMerAt(bnFc, vLocal);
        /* Two layers of fine fibres (≈ 200 and 330 around), each wavering on
           its own; bundles brighten and part like combed hair. */
        float bnJit = bnNoise(bnW * 5.0) * 2.0 - 1.0;
        float bnS1 = 0.5 + 0.5 * sin(bnMer * 22.0 + bnJit * 2.2 + bnLat * 4.0 - uFlowTime * 0.6);
        float bnS2 = 0.5 + 0.5 * sin(bnMer * 37.0 + bnJit * 3.0 + bnLat * 6.7 - uFlowTime * 0.9 + 1.7);
        float bnStrand = pow(bnS1, 3.0) * 0.72 + pow(bnS2, 5.0) * 0.28;
        float bnBundle = smoothstep(0.15, 0.85, 0.5 + 0.5 * sin(bnMer + bnWarp * 2.0));
        float bnStrandK = uFlow * (0.55 + 0.45 * bnBundle);
        /* Creases sit in shadow; strands are grooves across the skin. */
        float bnCrease = smoothstep(0.22, 0.58, vFold);
        diffuseColor.rgb *= mix(0.42, 1.0, bnCrease) * (1.0 - 0.16 * bnStrandK * (1.0 - bnStrand));
        /* Bundles carry their own pastel cast (lilac, rose-gold, sea-green),
           like oil on the fibres. */
        vec3 bnCast = mix(mix(vec3(0.84, 0.8, 1.0), vec3(1.0, 0.84, 0.74), smoothstep(-0.4, 0.5, bnWarp)), vec3(0.8, 0.95, 0.9), smoothstep(0.55, 0.9, bnNoise(bnW * 0.8 + 11.0)));
        diffuseColor.rgb *= mix(vec3(1.0), bnCast, 0.55 * bnBundle * uFlow);
        /* The opening is a cavity: darker skin between the rays of light. */
        float bnApW = 0.03 + 0.5 * uOpen;
        float bnInCap = smoothstep(1.0 - bnApW, 1.0, bnApD) * uOpen;
        diffuseColor.rgb *= 1.0 - 0.55 * bnInCap;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float frostEdge = 1.0 - uRime * 1.08;
        float frostMask = smoothstep(frostEdge, frostEdge + 0.16, vFrost);
        roughnessFactor = mix(roughnessFactor, 0.42, frostMask);
        roughnessFactor = clamp(roughnessFactor + 0.16 * bnStrandK * (1.0 - bnStrand) + 0.08 * (1.0 - bnCrease), 0.04, 1.0);
        /* Blisters are taut and glossy. */
        roughnessFactor = mix(roughnessFactor, 0.03, smoothstep(0.15, 0.7, vBubble));`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        /* Fibres in relief: screen-space bump from the strand height, faded
           where they get finer than a pixel (no moiré at a distance). */
        {
          float bnH = (bnStrand * 0.6 + bnBundle * 0.4) * bnStrandK;
          vec3 dpx = dFdx(-vViewPosition);
          vec3 dpy = dFdy(-vViewPosition);
          float hx = dFdx(bnH);
          float hy = dFdy(bnH);
          float bnFine = 1.0 - smoothstep(0.25, 0.7, fwidth(bnMer * 22.0) / 6.2831);
          vec3 r1 = cross(dpy, normal);
          vec3 r2 = cross(normal, dpx);
          float det = dot(dpx, r1);
          vec3 grad = sign(det) * (hx * r1 + hy * r2) * 0.012 * bnFine;
          vec3 bumped = abs(det) * normal - grad;
          if (abs(det) > 1e-12 && dot(bumped, bumped) > 1e-20) normal = normalize(bumped);
        }`,
      )
      .replace(
        '#include <transmission_fragment>',
        THREE.ShaderChunk.transmission_fragment.replace(
          'material.transmission = transmission;',
          /* Creases and the cavity are thicker, cloudier skin. */
          'material.transmission = transmission * mix(0.35, 1.0, bnCrease) * (1.0 - 0.5 * bnInCap);',
        ),
      )
      .replace(
        '#include <lights_physical_fragment>',
        `#include <lights_physical_fragment>
        #ifdef USE_IRIDESCENCE
          /* Thin film follows the fibres: oil-slick banding along each strand. */
          material.iridescenceThickness = mix(material.iridescenceThickness, mix(160.0, 920.0, fract(bnStrand * 0.6 + bnBundle * 0.5 + vFold * 0.8)), 0.7 * uFlow);
        #endif`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float glint = step(0.986, frostHash(floor(vLocal * 140.0))) * frostMask;
        totalEmissiveRadiance += vec3(0.92, 0.9, 1.0) * (frostMask * 0.05 + glint * 0.32);
        float inward = pow(max(dot(normal, normalize(vViewPosition)), 0.0), 1.4);
        totalEmissiveRadiance += uCore * inward * uCoreGlow * (1.0 - 0.55 * frostMask);
        /* Soap-film rainbow: bands flow with view angle and the surface, pastel
           so it stays in the Born Another palette but separates the body from
           the habitat. */
        float filmFacing = 1.0 - abs(dot(normal, normalize(vViewPosition)));
        float filmFlow = 0.25 * sin(vLocal.x * 3.1 + vLocal.y * 2.3 + uTime * 0.12) + 0.15 * sin(vLocal.z * 5.2 - vLocal.x * 1.7 - uTime * 0.08);
        vec3 filmHue = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + filmFacing * 2.2 + filmFlow * 1.6));
        filmHue = mix(vec3(1.0), filmHue, 0.82);
        totalEmissiveRadiance += filmHue * uFilm * smoothstep(0.05, 0.7, filmFacing) * (1.0 - 0.6 * frostMask);
        totalEmissiveRadiance += uRimColor * pow(filmFacing, 3.0) * uRim;
        /* UNFOLD — strand sheen, then the light inside: rays in the opening,
           a halo on its lip, and a little warmth seeping out of the creases. */
        totalEmissiveRadiance += filmHue * bnStrand * bnStrandK * 0.035 * (0.3 + filmFacing);
        {
          float apW = 0.03 + 0.5 * uOpen;
          float inCap = smoothstep(1.0 - apW, 1.0, bnApD);
          float heart = smoothstep(1.0 - apW * 0.45, 1.0, bnApD);
          float rays = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(bnAng * 13.0 + bnWarp * 3.0), 2.0);
          float lipGlow = smoothstep(1.0 - apW - 0.32, 1.0 - apW, bnApD) * (1.0 - inCap);
          vec3 hot = mix(uInnerLight, vec3(1.0, 0.88, 0.62), heart * 0.6);
          totalEmissiveRadiance += hot * uOpen * (inCap * rays * (0.25 + 1.0 * bnStrand) * 1.1 + heart * 1.6);
          totalEmissiveRadiance += uInnerLight * uOpen * lipGlow * (0.12 + 0.3 * bnStrand);
          totalEmissiveRadiance += uInnerLight * (1.0 - bnCrease) * (0.04 + 0.18 * uOpen) * (1.0 - frostMask);
        }`,
      )
  }
  material.customProgramCacheKey = () => 'exp07-membrane-v11-morph'
}

export const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`

export const skyFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uBottom;
  uniform vec3 uGlow;
  uniform vec3 uLightDir;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(h, 0.7)) : mix(uHorizon, uBottom, pow(-h, 0.5));
    float sun = max(dot(d, normalize(uLightDir)), 0.0);
    col += uGlow * (pow(sun, 6.0) * 0.55 + pow(sun, 40.0) * 0.6);
    gl_FragColor = vec4(col, 1.0);
  }
`

export const shaftVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const shaftFragment = /* glsl */ `
  uniform float uTime;
  uniform float uStrength;
  uniform float uSeed;
  varying vec2 vUv;
  void main() {
    float across = smoothstep(0.0, 0.5, vUv.x) * smoothstep(1.0, 0.5, vUv.x);
    across = pow(across, 1.6);
    float along = smoothstep(0.0, 0.25, vUv.y) * (0.35 + 0.65 * vUv.y);
    float flicker = 0.75 + 0.25 * sin(uTime * 0.35 + uSeed * 6.0 + vUv.y * 3.0);
    float a = across * along * flicker * uStrength * 1.8;
    gl_FragColor = vec4(vec3(0.86, 0.9, 1.0) * a, a);
  }
`

export const moteVertex = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uScale;
  uniform float uDrift;
  varying float vAlpha;
  varying float vSoft;
  void main() {
    vec3 p = position;
    float t = uTime * (0.12 + uDrift);
    p.x += sin(t + aPhase) * 0.35;
    p.y += mod(uTime * 0.05 + aPhase * 0.37, 1.0) * 0.6 - 0.3;
    p.z += cos(t * 0.8 + aPhase * 1.3) * 0.35;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;
    gl_PointSize = aSize * uScale * (12.0 / dist);
    gl_Position = projectionMatrix * mv;
    vSoft = smoothstep(1.5, 6.0, dist);
    vAlpha = (0.25 + 0.5 * (0.5 + 0.5 * sin(uTime * 0.7 + aPhase))) * (1.0 - smoothstep(14.0, 26.0, dist));
  }
`

export const bubbleVertex = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform float uScale;
  uniform float uTurb;
  varying float vAlpha;
  void main() {
    float speed = aSeed.x * (1.0 + uTurb * 1.2);
    float rise = aSeed.w;
    float h = mod(uTime * speed + aSeed.z, rise);
    vec3 p = position;
    p.y += h;
    float wob = uTime * (1.3 + aSeed.x) + aSeed.z;
    p.x += sin(wob) * 0.12 * (1.0 + h * 0.08) + h * uTurb * 0.35;
    p.z += cos(wob * 0.8) * 0.12;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;
    gl_PointSize = aSeed.y * uScale * (20.0 / dist) * (0.8 + 0.4 * h / rise);
    gl_Position = projectionMatrix * mv;
    vAlpha = smoothstep(0.0, 0.6, h) * (1.0 - smoothstep(rise * 0.75, rise, h)) * (1.0 - smoothstep(18.0, 34.0, dist));
  }
`

export const bubbleFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    vec2 q = gl_PointCoord - 0.5;
    float d = length(q);
    if (d > 0.5) discard;
    float ring = smoothstep(0.5, 0.42, d) * smoothstep(0.26, 0.44, d);
    float glint = smoothstep(0.12, 0.0, length(q - vec2(-0.14, -0.16)));
    float body = smoothstep(0.5, 0.0, d) * 0.06;
    float a = (ring * 0.55 + glint * 0.8 + body) * vAlpha;
    gl_FragColor = vec4(vec3(0.95, 0.97, 1.0), a * 0.6);
  }
`

/** Sand lifted by a storm: still at calm, streaming and rising as turbulence grows. */
export const dustVertex = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uScale;
  uniform float uStorm;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float lift = fract(uTime * (0.15 + uStorm * 0.55) + aPhase);
    p.y += lift * (0.35 + uStorm * 4.2);
    p.x += uTime * (0.4 + uStorm * 5.5) + sin(uTime * 1.4 + aPhase * 6.0) * uStorm * 0.8;
    p.z += cos(uTime * 0.7 + aPhase * 4.0) * uStorm * 0.6;
    p.x = mod(p.x + 20.0, 40.0) - 20.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;
    gl_PointSize = aSize * uScale * (1.0 + uStorm * 1.4) * (16.0 / dist);
    gl_Position = projectionMatrix * mv;
    float body = smoothstep(0.0, 0.12, lift) * (1.0 - smoothstep(0.62, 1.0, lift));
    vAlpha = uStorm * body * (1.0 - smoothstep(10.0, 28.0, dist));
  }
`

export const dustFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d) * vAlpha;
    gl_FragColor = vec4(vec3(0.78, 0.71, 0.6), a * 0.85);
  }
`

export const moteFragment = /* glsl */ `
  varying float vAlpha;
  varying float vSoft;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.5, 0.0, d);
    float disc = smoothstep(0.5, 0.36, d) * 0.12 + core * 0.18;
    float a = mix(disc, core, vSoft) * vAlpha;
    gl_FragColor = vec4(vec3(0.92, 0.94, 1.0) * a, a);
  }
`

export function createEnvironmentScene() {
  const scene = new THREE.Scene()
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(10, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        uTop: { value: new THREE.Color('#e4e8ef') },
        uHorizon: { value: new THREE.Color('#c0c6d0') },
        uBottom: { value: new THREE.Color('#8c93a3') },
        uGlow: { value: new THREE.Color('#ffffff') },
        uLightDir: { value: LIGHT_DIR },
      },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: skyFragment,
    }),
  )
  scene.add(sky)
  const panel = (color, intensity, pos, w, h) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }),
    )
    mesh.position.copy(pos)
    mesh.lookAt(0, 0, 0)
    scene.add(mesh)
  }
  panel('#ffffff', 2, LIGHT_DIR.clone().multiplyScalar(8), 5, 6)
  panel('#ffd6ea', 1.4, new THREE.Vector3(-7, 2, 3), 5, 3)
  panel('#d7ecff', 1.2, new THREE.Vector3(6, 0, 5), 4, 3)
  return scene
}

export function patchFrond(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime
    shader.uniforms.uSway = uniforms.uSway
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aT;\nuniform float uTime;\nuniform float uSway;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float phase = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 1.3;
        #else
          float phase = 0.0;
        #endif
        float tt = aT * aT;
        transformed.x += sin(uTime * 0.8 + phase) * uSway * tt;
        transformed.z += cos(uTime * 0.6 + phase * 1.3) * uSway * 0.6 * tt;`,
      )
  }
  material.customProgramCacheKey = () => 'exp07-frond-v1'
}

export const tuftVertex = /* glsl */ `
  attribute float aT;
  attribute float aPhase;
  uniform float uTime;
  uniform float uSway;
  varying float vT;
  #include <fog_pars_vertex>
  void main() {
    vec3 p = position;
    float tt = aT * aT;
    p.x += sin(uTime * 1.1 + aPhase) * uSway * tt;
    p.z += cos(uTime * 0.9 + aPhase * 1.4) * uSway * 0.7 * tt;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    vT = aT;
    #include <fog_vertex>
  }
`

export const tuftFragment = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uTip;
  varying float vT;
  #include <fog_pars_fragment>
  void main() {
    vec3 col = mix(uBase, uTip, vT) * (0.7 + 0.6 * vT);
    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }
`

export const glintVertex = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  #include <fog_pars_vertex>
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale * (10.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
    vColor = aColor;
    vAlpha = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 1.3 + aPhase), 6.0);
    #include <fog_vertex>
  }
`

export const glintFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  #include <fog_pars_fragment>
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    gl_FragColor = vec4(vColor, a);
    #include <fog_fragment>
  }
`

/*
 * Frost shell — a thin transparent coat over the original Pearlescent body.
 * Only the frosted regions draw (rime grows along aFrost), so the body keeps
 * its own look until the medium freezes it.
 */
export const frostShellVertex = /* glsl */ `
  attribute float aFrost;
  uniform float uLift;
  varying float vFrost;
  varying vec3 vLocal;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vFrost = aFrost;
    vLocal = position;
    vec4 mv = modelViewMatrix * vec4(position + normal * uLift, 1.0);
    vN = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
export const frostShellFragment = /* glsl */ `
  uniform float uRime;
  uniform float uTime;
  varying float vFrost;
  varying vec3 vLocal;
  varying vec3 vN;
  varying vec3 vView;
  float frostHash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
  void main() {
    float edge = 1.0 - uRime * 0.92;
    float m = smoothstep(edge, edge + 0.22, vFrost) * 0.85;
    if (m < 0.01) discard;
    float fres = pow(1.0 - max(dot(normalize(vN), normalize(vView)), 0.0), 2.0);
    float grain = frostHash(floor(vLocal * 90.0));
    float glint = step(0.976, frostHash(floor(vLocal * 160.0) + floor(uTime * 0.5)));
    vec3 col = mix(vec3(0.93, 0.92, 0.98), vec3(1.0, 0.95, 0.98), grain);
    col = col * 0.94 + vec3(0.85, 0.9, 1.0) * fres * 0.12 + glint * 0.45;
    float a = m * (0.32 + 0.3 * grain + 0.2 * fres) + glint * m * 0.35;
    gl_FragColor = vec4(col, clamp(a, 0.0, 0.7));
  }
`
