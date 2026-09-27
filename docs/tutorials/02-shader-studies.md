# Shader Studies

Hands-on experiments for Noise Lab (React + Three.js / React Three Fiber).

**Prerequisites:** [1-shader-fundamentals.md](./1-shader-fundamentals.md) — pipeline, uniforms / attributes / varyings, GLSL basics, spatial data. This guide does **not** re-teach those.

**How to use:** implement one study at a time on a terrain mesh (or a simple plane). Keep a flat-color baseline so you can switch back and compare. Do not combine strategies until the end section.

**Current Noise Lab context:** terrain height is sampled from noise on the CPU and written into vertex positions; shading today is mostly `meshStandardMaterial` + vertex colors. These studies replace / extend that look with `ShaderMaterial` strategies you can later expose in the UI.

---

## Study 01 — Flat / Uniform Color

### Goal

Learn the simplest fragment shader and how a **uniform** drives output color.

### Core Concept

Ignore position, normals, and lighting. Every fragment outputs the same `uColor`. The vertex shader only transforms positions. This isolates the path: **JS uniform → fragment → screen**.

### Data Flow

```text
JavaScript uColor → uniform → fragment shader → gl_FragColor
```

### Implementation Steps

1. Create a `ShaderMaterial` with one uniform: `uColor`.
2. Pass-through vertex shader (`position` → `gl_Position` with Three.js matrices).
3. Fragment shader: `gl_FragColor = vec4(uColor, 1.0)`.
4. Attach to a mesh; change `uColor` from JS / R3F and confirm the whole surface updates.

### Key Code

```js
uniforms: {
  uColor: { value: new THREE.Color('#6b8f71') },
}
```

```glsl
// vertex
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}

// fragment
uniform vec3 uColor;
void main() {
  gl_FragColor = vec4(uColor, 1.0);
}
```

### Parameters to Explore

| Parameter | Effect |
|-----------|--------|
| `uColor` | Entire surface tint |
| Opacity / alpha (if you add it) | Transparency of the flat fill |

### Expected Result

A solid, flat-colored mesh. No height bands, no lighting variation from the shader itself — a clean baseline.

### Experiment

1. Animate `uColor` over time (lerp between two colors in `useFrame`).
2. Bind `uColor` to a UI color picker in Noise Lab.
3. Temporarily multiply `uColor` by a constant (e.g. `0.5`) — confirm uniform math lands on every pixel the same way.

### Application to Noise Lab

Baseline strategy for A/B comparison. When a later study looks “wrong,” switch back to flat color to check mesh / camera / material wiring before blaming the new math.

### What I Learned

<!-- After implementing: what clicked? what was confusing? -->

_

### Screenshot

<!-- Paste or link your result -->

`[screenshot: study-01-flat-color]`

---

## Study 02 — Position / Height Gradient

### Goal

Use **vertex position** as visual data — especially height — to color the surface.

### Core Concept

Pass position (local or world) from the vertex shader as a varying. In the fragment shader, normalize a height channel (usually `y`) into `0…1`, then `mix` two (or more) colors. Same mesh as Study 01; only the color rule changes.

### Data Flow

```text
position.y → (optional world transform) → normalize → mix(lowColor, highColor) → color
```

### Implementation Steps

1. Start from Study 01 material.
2. In the vertex shader, pass `position` (local) and/or `worldPosition` via varyings.
3. In the fragment shader, map height with uniforms `uMinY` / `uMaxY` (or `uDisplace` matching Noise Lab’s displace scale).
4. `float t = clamp((h - uMinY) / (uMaxY - uMinY), 0.0, 1.0);`
5. `vec3 col = mix(uLowColor, uHighColor, t);`
6. Compare **local** `position.y` vs **world** `(modelMatrix * vec4(position,1.0)).y` on a translated / rotated mesh.

### Key Code

```glsl
// vertex
varying float vHeight;
void main() {
  // local:
  vHeight = position.y;
  // or world:
  // vHeight = (modelMatrix * vec4(position, 1.0)).y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}

// fragment
uniform vec3 uLowColor;
uniform vec3 uHighColor;
uniform float uMinY;
uniform float uMaxY;
varying float vHeight;

void main() {
  float t = clamp((vHeight - uMinY) / max(0.0001, uMaxY - uMinY), 0.0, 1.0);
  gl_FragColor = vec4(mix(uLowColor, uHighColor, t), 1.0);
}
```

### Parameters to Explore

| Parameter | Effect |
|-----------|--------|
| `uMinY` / `uMaxY` | Which elevation range maps to 0…1 (stretch / crush bands) |
| `uLowColor` / `uHighColor` | Valley vs peak palette |
| Local vs world height | Whether color sticks to the mesh or the scene |

### Expected Result

Low areas one color, high areas another, smooth blend in between. Peaks of the noise heightfield should read clearly as “taller.”

### Experiment

1. Set `uMinY` / `uMaxY` too narrow — bands crush to two flats.
2. Invert the mix (`mix(high, low, t)`) — peaks become “valleys” visually.
3. Color by `position.x` or length in XZ instead of `y` — see non-elevation encodings.

### Application to Noise Lab

Noise Lab already encodes height in vertex `y` (CPU displace). This study moves elevation visualization into the GPU and prepares altitude-based biomes / bands without baking vertex colors in JS.

### What I Learned

_

### Screenshot

`[screenshot: study-02-height-gradient]`

---

## Study 03 — Interpolation

### Goal

Control **how** values transition — hard edges vs soft blends — using GLSL interpolation helpers.

### Core Concept

You already map height → `t`. Now change the *shape* of `t` before coloring:

- `mix(a, b, t)` — linear blend by `t`
- `step(edge, x)` — hard threshold (`0` or `1`)
- `smoothstep(edge0, edge1, x)` — smooth Hermite ramp between two edges

Same input (e.g. height); different transition character.

### Data Flow

```text
height → t
       → mix / step / smoothstep
       → color regions
```

### Implementation Steps

1. Reuse Study 02 height → `t` (or raw height).
2. Add a mode (or three side-by-side materials) for `mix`, `step`, `smoothstep`.
3. For bands: pick thresholds (e.g. water / ground / rock) and blend or hard-cut between palette colors.
4. For `smoothstep`, expose `uEdge0` / `uEdge1` (or a center + width) as uniforms.
5. Orbit the terrain and compare contour sharpness.

### Key Code

```glsl
float h = vHeight; // or normalized t

// A) soft linear (after normalize)
vec3 colA = mix(uColorA, uColorB, t);

// B) hard band
float rock = step(uRockStart, h);
vec3 colB = mix(uColorA, uColorB, rock);

// C) soft band
float rockSoft = smoothstep(uRockStart, uRockStart + uRockWidth, h);
vec3 colC = mix(uColorA, uColorB, rockSoft);
```

### Parameters to Explore

| Parameter | Effect |
|-----------|--------|
| Threshold (`uRockStart`) | Where the cut / ramp begins |
| `uRockWidth` (smoothstep span) | Narrow = almost hard; wide = long soft blend |
| Number of bands | Contours vs continuous gradient |

### Expected Result

- `mix` on normalized height → continuous wash  
- `step` → crisp contour lines / hard biomes  
- `smoothstep` → controllable soft borders between regions  

### Experiment

1. Drive three colors with two `smoothstep` masks (low / mid / high).
2. Animate the threshold with `uTime` — watch bands crawl up the terrain.
3. Use `1.0 - smoothstep(...)` to invert a mask (e.g. snow only on peaks).

### Application to Noise Lab

Terrain regions (waterline, grass, rock, snow) need deliberate edges. This study is the control layer for readable procedural biomes on the heightfield without changing the noise itself.

### What I Learned

_

### Screenshot

`[screenshot: study-03-interpolation]`

---

## Study 04 — Slope Shader

### Goal

Use **surface orientation** to visualize steepness — independent of elevation color.

### Core Concept

Normals point “out” from the surface. Compare each normal to world **up** `(0, 1, 0)`. Flat ground aligns with up; cliffs do not. Convert that into a slope factor and color it.

Typical pattern:

```text
slope = 1.0 - abs(dot(normalWS, up))
```

(or `acos` of the alignment — keep it simple with the absolute dot first).

### Data Flow

```text
normal → (to world space) → dot with up → slope → color
```

### Implementation Steps

1. In the vertex shader, transform `normal` with `normalMatrix` / world normal matrix; pass `vNormal` (normalize again in the fragment shader).
2. `float alignment = abs(dot(normalize(vNormal), vec3(0.0, 1.0, 0.0)));`
3. `float slope = 1.0 - alignment;` // 0 = flat, 1 = vertical
4. `mix` flat color ↔ steep color by `slope` (optionally `smoothstep` the factor).
5. Confirm Noise Lab recomputes normals after CPU displacement (`computeVertexNormals`) so slopes match the heightfield.

### Key Code

```glsl
// vertex
varying vec3 vNormal;
void main() {
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}

// fragment
uniform vec3 uFlatColor;
uniform vec3 uSteepColor;
varying vec3 vNormal;

void main() {
  float alignment = abs(dot(normalize(vNormal), vec3(0.0, 1.0, 0.0)));
  float slope = 1.0 - alignment;
  float s = smoothstep(0.2, 0.8, slope);
  gl_FragColor = vec4(mix(uFlatColor, uSteepColor, s), 1.0);
}
```

### Parameters to Explore

| Parameter | Effect |
|-----------|--------|
| Slope `smoothstep` range | What counts as “steep” |
| Flat / steep colors | Readability of cliffs vs plateaus |
| Normal space (view vs world) | Wrong space → slope breaks when you orbit |

### Expected Result

Plateaus / gentle hills one color; ridges and cliffs another. Rotating the camera should **not** change which areas look steep (unlike Fresnel).

### Experiment

1. Color by `alignment` alone (no `1.0 - …`) — flats become the “hot” color.
2. Raise Noise Lab `displace` — steeper derivatives → more steep coloring.
3. Break normals on purpose (skip `computeVertexNormals`) — slope map goes wrong; fix and compare.

### Application to Noise Lab

Steepness matters for erosion stories, walkable vs cliff regions, and visual structure of FBM / ridged terrain. Slope shading reveals the *shape* of the noise, not just its height range.

### What I Learned

_

### Screenshot

`[screenshot: study-04-slope]`

---

## Study 05 — Fresnel

### Goal

Understand **view-dependent** shading: color that changes with the camera, not only with the mesh.

### Core Concept

Fresnel (beginner form): surfaces facing the camera look different from surfaces seen at a grazing angle.

```text
fresnel = pow(1.0 - max(dot(n, v), 0.0), uPower)
```

- `n` = world (or view-space) normal  
- `v` = view direction (camera → or surface → camera; keep consistent and normalized)  
- High fresnel near silhouettes / edges  

### Data Flow

```text
normal + viewDir → dot → 1 - dot → pow → rim strength → color
```

### Implementation Steps

1. Pass world position and world normal from the vertex shader.
2. In the fragment shader, build `viewDir` from camera position (Three.js: `cameraPosition` uniform is available in `ShaderMaterial`) toward the surface point — or the opposite; normalize and use `abs`/`max` carefully.
3. Compute fresnel; `mix` base color with rim color by that factor.
4. Orbit the camera: rim should crawl around the silhouette. Contrast with Study 04 (slope stays put).

### Key Code

```glsl
varying vec3 vWorldPos;
varying vec3 vNormal;

uniform vec3 uBaseColor;
uniform vec3 uRimColor;
uniform float uPower;

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(cameraPosition - vWorldPos);
  float fresnel = pow(1.0 - max(dot(n, v), 0.0), uPower);
  vec3 col = mix(uBaseColor, uRimColor, fresnel);
  gl_FragColor = vec4(col, 1.0);
}
```

### Parameters to Explore

| Parameter | Effect |
|-----------|--------|
| `uPower` | Higher → thinner, tighter rim |
| `uRimColor` | Edge highlight color |
| `uBaseColor` | Facing-camera fill |

### Expected Result

Bright (or tinted) edges / silhouettes when viewed at a glance; facing surfaces closer to base color. **Moving the camera changes the look** even if the terrain is static.

### Experiment

1. Set `uPower` to `1.0` vs `5.0` — wide glow vs sharp outline.
2. Invert: `mix(rim, base, fresnel)` — facing surfaces get the “rim” color.
3. Add fresnel on a flat plane vs the displaced heightfield — curved terrain shows richer rims.

### Application to Noise Lab

Rim cues help terrain read in a dense UI (wireframe + particles + wind). View-dependent highlight separates “edge of the landform” from slope/height encoding — useful later for atmosphere or selection affordances, without claiming a full lighting model.

### What I Learned

_

### Screenshot

`[screenshot: study-05-fresnel]`

---

## Study 06 — Vertex Displacement

### Goal

Move from **look** (fragment color) to **shape** (vertex positions). The mesh geometry itself changes.

### Core Concept

In the vertex shader, offset `position` before projection — often along the normal, or along world up for heightfields — using `uTime` and/or a procedural function (noise, sine waves). Fragment shading can stay simple (flat or height gradient) so you can see the deformation clearly.

Noise Lab already displaces on the **CPU** from the noise map. This study does analogous work on the **GPU**, optionally animated.

### Data Flow

```text
position (+ normal) + uTime / procedural → displacedPosition → gl_Position
```

### Implementation Steps

1. Start from Study 01 or 02 fragment (keep fragment simple).
2. In the vertex shader, compute `float d = ...` (e.g. `sin` of xz + time, or a tiny hash/noise).
3. `vec3 displaced = position + normal * d * uAmplitude;` (or `position.y += d` for a heightfield-style offset on an already flat base).
4. Output `gl_Position` from `displaced`; pass displaced height to the fragment if you want height coloring to match.
5. Drive `uTime` in `useFrame`. Compare CPU Noise Lab displace vs GPU motion.

### Key Code

```glsl
uniform float uTime;
uniform float uAmplitude;
uniform float uFrequency;

void main() {
  float d = sin(position.x * uFrequency + uTime)
          * sin(position.z * uFrequency * 0.8 + uTime * 0.7);
  vec3 displaced = position + vec3(0.0, d * uAmplitude, 0.0);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
```

### Parameters to Explore

| Parameter | Effect |
|-----------|--------|
| `uAmplitude` | How far vertices move |
| `uFrequency` | Ripple / feature size |
| `uTime` speed | Animation rate |
| Offset along normal vs along up | Bulge vs heightfield-like lift |

### Expected Result

The mesh **moves or warps** — not just its colors. Silhouette and normals (if recomputed or approximated) change over time. With a height gradient fragment, colors should track the animated peaks if you pass displaced height.

### Experiment

1. Zero `uAmplitude` — back to static mesh (sanity check).
2. Displace along `normal` on a sphere vs along `y` on the terrain plane — different silhouettes.
3. Use UV or world XZ as the domain for `sin` / noise so adjacent Noise Lab tiles could match later.

### Application to Noise Lab

Bridges CPU heightfields and GPU procedural motion: wind-reactive grass-scale motion, animated preview meshes, or eventually sampling noise on the GPU. Treat this as the geometry counterpart to fragment-only studies — still one concept: **vertices move**.

### What I Learned

_

### Screenshot

`[screenshot: study-06-vertex-displacement]`

---

## Comparing the Strategies

| Shader | Main Input | Changes Geometry? | View-dependent? | Useful For |
|--------|------------|-------------------|-----------------|------------|
| Flat / uniform color | `uColor` | No | No | Baseline, debug, solid fill |
| Height gradient | `position.y` (local/world) | No | No | Elevation / altitude bands |
| Interpolation | Mapped scalar (`t` / height) | No | No | Hard vs soft region edges |
| Slope | Surface normal vs up | No | No | Steep vs flat terrain |
| Fresnel | Normal + view direction | No | **Yes** | Silhouettes, rim cue |
| Vertex displacement | Position + time / function | **Yes** | No* | Animate / deform terrain |

\*Displacement itself is not view-dependent; lighting or fresnel on top can be.

---

## Combining Strategies

These techniques stack. You do **not** need to implement combinations yet — only keep the idea in mind:

- **Height + slope** — altitude palette, then darken or recolor steep faces  
- **Height + Fresnel** — biomes with a camera-facing rim  
- **Noise + vertex displacement** — procedural domain drives both motion and (later) color  
- **Slope + height + smooth interpolation** — soft biome bands that also respect steepness  

When combining, add **one** influence at a time and keep uniforms for blend weights so you can solo each term.

---

## Next Steps

Once each study works in isolation:

1. Keep them as separate GLSL snippets or material factories (`createFlatShader`, `createHeightShader`, …).
2. Expose a **shader strategy** control in the Noise Lab UI (dropdown / tabs) that swaps `ShaderMaterial` (or shader strings + uniforms) on the terrain mesh.
3. Share common uniforms (`uMinY`, `uMaxY`, palette colors, `uTime`) so switching strategies does not reset the whole lab state.
4. Only then start combining (height + slope, etc.) as named presets.

Fundamentals → isolated studies → switchable strategies → combined presets.
