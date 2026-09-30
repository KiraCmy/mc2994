# Born Another — Shader Studies

## Purpose

This study asks:

> How can a shader make one simple generated form feel like a finite artificial life rather than a static object?

Use the **same simple blob or subdivided sphere** throughout all five studies. Keep the camera, light, and pale background consistent so that the material and behavior—not the geometry—remain the focus.

The visual direction is a **translucent synthetic specimen**:

- soft gray or warm-white background;
- pearly, milky, semi-translucent body;
- subtle cyan, pink, violet, and muted-red accents;
- faint iridescence and visible internal structure;
- gradual instability, fragmentation, and residual traces.

No image textures or noise maps are required. When irregularity is needed, generate noise mathematically inside the shader.

---

## Progressive Workflow

```text
One base blob
    ↓
01 Surface — establish the living synthetic material
    ↓
02 Individuality — create related but distinct identities
    ↓
03 Development — give the entity an internal temporal state
    ↓
04 Decay — make mortality part of the material
    ↓
05 Trace — leave a memory after the body disappears
```

Build and document one stage at a time. For every study:

1. Keep the same base form and scene.
2. Add only the new uniforms and shader logic needed for that stage.
3. Expose a few useful parameters in the UI.
4. Capture a screenshot or short recording.
5. Write two or three sentences about what changed and what you learned.

---

## Prerequisites and Core Concepts

### `ShaderMaterial`

In Three.js, `ShaderMaterial` connects your GLSL programs and uniforms to a mesh.

```js
const material = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    uTime: { value: 0 },
    uAge: { value: 0 },
    uSeed: { value: 1 }
  },
  transparent: true,
  depthWrite: false
});
```

If using React Three Fiber, the same values can be passed to `<shaderMaterial />`. Update animated uniforms such as `uTime` in the render loop rather than recreating the material every frame.

### Vertex shader vs. fragment shader

Keep this distinction clear throughout the studies:

| Stage | Runs for | Mainly controls |
|---|---|---|
| Vertex shader | Each vertex | Position and apparent shape of the geometry |
| Fragment shader | Each visible surface fragment | Color, opacity, pattern, and surface appearance |

A fragment effect can make a surface *look* broken without changing its silhouette. Vertex displacement actually moves points and deforms the geometry.

### Uniforms

Uniforms are values supplied by JavaScript and shared across one draw call. Useful uniforms for this project include:

```glsl
uniform float uTime;      // continuously increasing time
uniform float uSeed;      // stable identity variation
uniform float uAge;       // normalized lifespan: 0.0 to 1.0
uniform float uFresnel;   // edge-effect strength
uniform float uOpacity;
uniform vec3 uColorA;
uniform vec3 uColorB;
```

### Attributes and varyings

`position`, `normal`, and `uv` are geometry attributes available to the vertex shader. A `varying` passes data from the vertex shader to the fragment shader; the GPU interpolates it across each triangle.

```glsl
// Vertex shader
varying vec3 vPosition;
varying vec3 vNormal;

void main() {
  vPosition = position;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

### Position, normal, and view direction

- **Position** answers: where is this point?
- **Normal** answers: which direction is the surface facing?
- **View direction** answers: where is the camera relative to this surface point?

These values support gradients, lighting-like effects, slope comparisons, and Fresnel edges. Be consistent about coordinate spaces. For view-dependent work, view-space position and normals are a convenient pair.

```glsl
vec3 viewDirection = normalize(-vViewPosition);
float facing = dot(normalize(vNormal), viewDirection);
```

### Time, seed, and age

- `uTime` creates ongoing movement.
- `uSeed` creates repeatable differences between entities.
- `uAge` represents one entity's progress from birth (`0.0`) to death (`1.0`).

They have different meanings. Do not substitute random motion for development: time drives motion, while age drives irreversible lifecycle change.

### Essential operations

```glsl
mix(a, b, t);                 // blend between a and b
step(edge, value);            // hard threshold
smoothstep(a, b, value);      // soft threshold
dot(a, b);                    // compare two directions
normalize(v);                 // make a vector length 1
sin(value);                   // periodic motion
discard;                      // remove a fragment completely
```

Alpha controls transparency:

```glsl
gl_FragColor = vec4(finalColor, alpha);
```

`discard` creates hard holes. Alpha creates softer disappearance, but transparent rendering may require careful `transparent`, `depthWrite`, blending, and object-order settings.

### Procedural noise

Procedural noise is a GLSL function calculated from position, seed, and time. It does not use an image map.

```glsl
float n = noise(vPosition * uNoiseScale + vec3(uSeed));
```

Use a tested compact value-noise or simplex-noise GLSL function rather than inventing a new one for every study. Noise should supply structured variation, not become the concept by itself.

### Vertex displacement

Displacement changes geometry in the vertex shader, usually along the normal:

```glsl
float displacement = n * uDisplacement;
vec3 displacedPosition = position + normal * displacement;
```

The form needs enough subdivisions for this to look smooth. Fragment patterns do not need extra geometry; vertex deformation does.

---

## Base Scene Setup

Before Study 01, prepare a controlled test scene:

- one highly subdivided sphere, icosphere, or simple blob;
- pale gray or warm-white background;
- soft neutral lighting if the shader uses lights;
- fixed camera and framing;
- no image textures;
- one panel for changing uniforms;
- optional side-by-side preview or saved presets for comparison.

Start with opaque rendering while debugging. Add transparency only after colors, normals, and Fresnel behavior are correct.

---

## Study 01 — Surface

### Question

How can a simple form feel synthetic, fragile, and faintly alive?

### Shader concept

This study combines a soft position gradient with a restrained Fresnel response. The gradient gives the body depth and internal color variation. Fresnel makes edges react to the viewing angle, suggesting a thin membrane or pearly shell.

This is primarily a **fragment/surface study**. The base geometry does not need to move yet.

### Goal

Create a milky translucent body with subtle cyan and pink variation, a soft interior, and a pale iridescent rim that remains readable against a light background.

### Inputs and uniforms

- local or view-space position;
- transformed normal;
- view direction;
- `uColorA`, `uColorB`, and optional rim color;
- `uFresnel`, `uOpacity`, and gradient range.

### Implementation

1. Pass position, view-space position, and transformed normal to the fragment shader.
2. Normalize one position component into a `0.0–1.0` gradient.
3. Use `mix()` to blend two low-saturation body colors.
4. Compare normal and view direction with `dot()`.
5. Invert and shape the result to produce a Fresnel mask.
6. Add the rim color gently; avoid a bright neon outline.
7. Introduce moderate alpha and test the material on the light background.

### Essential pattern

```glsl
float gradient = smoothstep(uLow, uHigh, vPosition.y);
vec3 bodyColor = mix(uColorA, uColorB, gradient);

float facing = max(dot(normalize(vNormal), normalize(vViewDirection)), 0.0);
float fresnel = pow(1.0 - facing, uFresnelPower);

vec3 finalColor = bodyColor + fresnel * uRimColor * uRimStrength;
float alpha = mix(uBodyAlpha, uEdgeAlpha, fresnel);
```

### Observe and experiment

- Compare local-position and world-position gradients.
- Change the Fresnel power: does it create a thin rim or cover too much of the form?
- Compare a nearly opaque milky body with a clearer glass-like body.
- Check whether the silhouette remains visible on a pale background.

### Concept connection

The entity should sit between organism, mineral, data, and artifact. It is not yet visibly aging, but it establishes an artificial body that can later carry identity, development, and mortality.

### Reflection

What made the blob begin to feel like an entity rather than a rendered sphere?

---

## Study 02 — Individuality

### Question

If several entities share one system, what makes each one an individual rather than a copy?

### Shader concept

Use a stable seed to alter procedural patterns and a small set of related parameters. Entities inherit the same shader rules and palette, while differences in seed, scale, frequency, and accent color produce distinct internal structures.

This remains mainly a **fragment/surface study**, although the same noise may later influence geometry.

### Goal

Generate a family of related specimens. Each should clearly belong to the same lineage while having its own internal markings and color distribution.

### Inputs and uniforms

- position;
- `uSeed`;
- noise scale and contrast;
- base palette and small accent variation;
- optional inherited parameter group from a parent entity.

### Implementation

1. Add one reusable procedural-noise GLSL function.
2. Sample noise from 3D position so the pattern belongs to the form rather than the screen.
3. Offset the sample with `uSeed` to produce a repeatable identity.
4. Remap the noise with `smoothstep()` into soft cloudy regions or internal bands.
5. Blend muted accent colors into the Study 01 material.
6. Create several presets with closely related values rather than fully random values.
7. Record the seed and parameters so each identity can be reproduced.

### Essential pattern

```glsl
vec3 samplePosition = vPosition * uNoiseScale + vec3(uSeed * 7.13);
float identityNoise = noise(samplePosition);
float pattern = smoothstep(uPatternLow, uPatternHigh, identityNoise);

vec3 identityColor = mix(bodyColor, uAccentColor, pattern * uAccentStrength);
```

On the JavaScript side, keep inheritance controlled:

```js
child.noiseScale = parent.noiseScale + mutation;
child.seed = newSeed;
child.accentColor = varySlightly(parent.accentColor);
```

### Observe and experiment

- Hold all values constant and change only `uSeed`.
- Compare slight mutation with unrestricted randomization.
- Decide how much variation can occur before the entities stop appearing related.
- Try internal cloudy structures versus thin procedural bands.

### Concept connection

Inheritance is not only a generator setting; it creates an identity question. Each entity begins with shared or inherited information, but variation gives it a distinct state:

> If something begins from inherited information, when does it become itself?

### Reflection

Which variations communicate individuality without losing lineage?

---

## Study 03 — Development

### Question

How can the entity visibly develop rather than merely loop an animation?

### Shader concept

Introduce time for slow internal movement and subtle vertex displacement. Use age separately to create directional, non-repeating development. The entity can breathe or pulse with time, while its pattern density, color balance, or displacement strength gradually changes with age.

This study combines **fragment/surface change** with **vertex/geometry deformation**.

### Goal

Make the specimen appear active and temporally situated: a living state that is not identical at birth, maturity, and later life.

### Inputs and uniforms

- `uTime` for continuous motion;
- `uAge` for lifecycle progression;
- `uSeed` for individual motion variation;
- displacement amplitude and frequency;
- evolving color or internal-pattern controls.

### Implementation

1. Animate the existing procedural field slowly with `uTime`.
2. Offset timing or direction with `uSeed` so all entities do not move identically.
3. Use a low-amplitude sine or noise value to move vertices along their normals.
4. Use a lifecycle curve to keep displacement restrained at birth and maturity.
5. Let `uAge` gradually alter one or two surface qualities, such as internal pattern scale or color balance.
6. Compare the entity at several fixed age values, not only during playback.

### Essential patterns

Surface motion:

```glsl
float movingNoise = noise(vPosition * uNoiseScale + vec3(0.0, uTime * uSpeed, uSeed));
```

Vertex displacement:

```glsl
float pulse = sin(uTime * uPulseSpeed + uSeed) * 0.5 + 0.5;
float lifeEnvelope = smoothstep(0.0, 0.2, uAge) * (1.0 - smoothstep(0.75, 1.0, uAge));
float amount = (movingNoise * 0.7 + pulse * 0.3) * uDisplacement * lifeEnvelope;
vec3 displacedPosition = position + normal * amount;
```

### Observe and experiment

- Freeze `uTime` and change only `uAge`; is development still visible?
- Reduce displacement until the change feels biological or material rather than rubbery.
- Compare perfectly periodic pulsing with noise-modulated motion.
- Identify a visually convincing maturity state.

### Concept connection

A generated object normally appears as a final result. Development gives the entity a history: its current appearance becomes one moment in a finite existence rather than a permanent design.

### Reflection

Which changes read as development, and which read only as decorative animation?

---

## Study 04 — Decay

### Question

How can finite lifespan be built into the material from the beginning?

### Shader concept

Compare a stable procedural field against an age-controlled threshold. As age increases, selected surface regions become thin, transparent, or absent. A second age curve can increase instability and displacement near the end of life.

This study uses both **fragment removal** and **vertex deformation**. They should be tested separately before being combined.

### Goal

Move from an intact milky membrane to an incomplete, fragile structure with exposed internal patterns and broken boundaries. Avoid a simple whole-object fade.

### Inputs and uniforms

- normalized `uAge` from `0.0` to `1.0`;
- stable position-based noise and `uSeed`;
- decay start, edge softness, and hole threshold;
- late-life displacement and accent colors.

### Implementation

1. Create a stable decay field from position and seed; do not animate it rapidly.
2. Map `uAge` to a threshold that begins changing only after maturity.
3. Visualize the mask in grayscale before using transparency or `discard`.
4. Use `smoothstep()` for thinning and soft boundaries.
5. Optionally use `discard` only where the mask is fully gone.
6. Add a narrow accent at the decay boundary to reveal the transition.
7. Increase vertex instability late in life with a separate age curve.
8. Verify transparency, depth writing, back faces, and silhouette behavior.

### Essential patterns

```glsl
float decayField = noise(vPosition * uDecayScale + vec3(uSeed));
float decayProgress = smoothstep(uDecayStart, 1.0, uAge);
float remaining = smoothstep(decayProgress - uEdgeSoftness,
                             decayProgress + uEdgeSoftness,
                             decayField);

float boundary = 1.0 - smoothstep(0.0, uBoundaryWidth, abs(decayField - decayProgress));
vec3 finalColor = mix(decayAccent, bodyColor, remaining);
float alpha = baseAlpha * remaining;

if (alpha < uDiscardThreshold) discard;
```

Late-life deformation:

```glsl
float instability = smoothstep(0.65, 1.0, uAge);
vec3 displacedPosition = position + normal * decayNoise * uDecayDisplacement * instability;
```

### Observe and experiment

- Scrub age slowly from `0.0` to `1.0`.
- Compare a hard `step()` threshold with a soft `smoothstep()` boundary.
- Compare alpha-only decay, discard-only decay, and a controlled combination.
- Check whether the decay looks causally connected to age rather than like random glitching.
- Preserve some internal structure while the outer membrane disappears.

### Concept connection

Mortality is not a software failure. It is encoded as a condition of the entity's existence. The stable seed means its pattern of disappearance also belongs to its identity.

### Reflection

At what point does instability become legible as mortality rather than visual noise?

---

## Study 05 — Trace

### Question

If the entity cannot remain alive, what can the world remember after it disappears?

### Shader concept

Separate the living body from its residue. Near death, the main membrane vanishes while a much sparser mask preserves selected boundaries, internal lines, fragments, or points. The trace can be rendered by a second mesh/material or by freezing a selected state before death.

This is mainly a **surface and rendering-system study**. If particles or line geometry are added, they become a separate geometry system rather than a fragment shader magically creating new particles.

### Goal

Leave a faint, light-background memory imprint: pale fragments, a ghostly edge, or a sparse internal structure. It should feel like an archive or fossilized record, not a neon explosion.

### Inputs and uniforms

- final or preserved `uAge` state;
- entity seed and identity field;
- preserved-moment data, if the user selected a moment;
- trace density, opacity, color, and persistence;
- optional second material for the residue.

### Implementation

1. Decide what the trace records: silhouette, internal pattern, decay boundary, or a preserved moment.
2. Reuse the entity's seed so the trace belongs specifically to that life.
3. Derive a sparse trace mask from the identity and decay fields.
4. Render the living body and trace separately so the body can disappear without deleting the memory.
5. Freeze or store the relevant parameters at death; do not let the trace keep behaving like a living entity.
6. Lower contrast and saturation so the trace reads as residue on the pale background.
7. Test whether a future entity can inherit one trace parameter without copying the entire previous entity.

### Essential patterns

Sparse residual mask:

```glsl
float identityField = noise(vPosition * uTraceScale + vec3(uSeed));
float sparseTrace = smoothstep(uTraceThreshold, 1.0, identityField);
float rimTrace = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDirection)), 0.0),
                     uTraceFresnelPower);

float traceMask = max(sparseTrace * uInternalTrace, rimTrace * uRimTrace);
float traceAlpha = traceMask * uTraceOpacity;
```

Preserve lifecycle data in JavaScript:

```js
const trace = {
  seed: entity.seed,
  preservedAge: entity.age,
  noiseScale: entity.noiseScale,
  accentColor: entity.accentColor
};
```

### Observe and experiment

- Compare silhouette memory, internal-pattern memory, and boundary memory.
- Remove information until the trace is barely—but still specifically—recognizable.
- Test a permanent trace versus one that fades very slowly.
- Ask whether the trace looks dead, archived, or still active.

### Concept connection

Death removes the current body but not every consequence of its existence. The trace connects one individual life to memory and possible inheritance:

```text
Life → Death → Trace → Memory → New Life
```

### Reflection

What is the minimum visual information needed for a trace to feel like the memory of one particular entity?

---

## Study 06 — Lifecycle

### Question

How can the five shader studies become one continuous, irreversible life rather than five separate demos?

### System concept

Studies 01–05 each isolate one visual strategy. Study 06 connects them through a single **lifecycle state** in JavaScript / React. The GPU still receives the same uniforms; what changes is **who owns `uAge`** and **when each study’s behavior is active**.

Until now, age is often scrubbed by hand. In Study 06, age becomes a **clock-driven lifespan**: once life begins, `uAge` advances automatically from `0.0` to `1.0`. The shaders from earlier studies are reused—not rewritten. React decides the current stage, updates `uAge` each frame, and switches (or layers) the appropriate material behavior.

Keep two clocks separate:

| Value | Meaning | Changes when |
|---|---|---|
| `uTime` | Continuous world time | Every frame while the scene runs |
| `uAge` | Progress through one life | Only while life is playing; stops at death |

`uTime` can still drive breathing and noise motion in Studies 03–05. `uAge` drives **irreversible** change: development, decay, death, and the handoff to trace. Do not tie age to `sin(uTime)` or any looping function.

Suggested stage map (one life, normalized age):

```text
Birth          0.00
Development    0.00 → 0.25
Maturity       0.25 → 0.55
Instability    0.55 → 0.75
Decay          0.75 → 0.95
Death          0.95 → 1.00
Trace          after 1.00 (body gone, residue remains)
```

This is mainly a **JavaScript / React state-system study**, not a new shader effect.

### Goal

Run one specimen through a full life automatically: surface and identity at birth, visible development and motion in mid-life, instability and decay near the end, irreversible death, then the existing Trace residue. The user should press one control (or Space) to begin and watch the journey unfold without scrubbing age by hand.

### Inputs and state

**React state (minimal):**

- `age` — current `uAge`, `0.0` to `1.0`;
- `playing` — whether the lifespan clock is running;
- `isDead` — set once age reaches `1.0`; death is not reversible for this life;
- `preserved` — snapshot taken near death (seed, accent, decay settings, `preservedAge`) for Study 05 trace;
- existing parameter groups from Studies 01–04 (surface, individuality, development, decay, trace).

**Uniforms passed to the GPU (unchanged):**

- `uAge` ← from React `age`;
- `uTime` ← from render loop / `useFrame`, independent of lifecycle play/pause logic for age;
- `uSeed` and material params ← from individuality / surface state.

**Optional UI:**

- Animate / Pause (and Space to toggle);
- Birth–Death marker (already tied to age);
- Reset or “New life” only after death—not a rewind mid-life.

### Implementation

1. **Centralize age.** One function updates `age` and writes the same value to every study’s `uAge` uniform (development, decay, trace body).
2. **Lifecycle loop.** When `playing` is true and `!isDead`, advance age each frame: `age += delta / lifeDuration`. Use `requestAnimationFrame` or `useFrame`; clamp to `1.0`.
3. **Map stages.** Derive a stage label from age (birth, development, maturity, …) for HUD or debugging. Shaders can keep using smooth `uAge` curves; the stage map is mainly for you and the UI.
4. **Reuse study materials.** Do not add a sixth GLSL effect. At each age range, the active look comes from existing study logic:
   - early life: Surface + Individuality base;
   - mid life: Development displacement and evolving pattern (Studies 02–03);
   - late life: Decay thinning and instability (Study 04);
   - after death: Trace residue only (Study 05).
5. **Preserve at death.** When `age >= ~0.95`, copy identity/decay fields into `preserved` once. After `age === 1.0`, set `isDead`, stop the age clock, hide the living body, show the trace mesh with frozen `preservedAge`.
6. **Irreversibility.** While `isDead`, ignore age decreases. Scrubbing age backward mid-life may pause animation, but do not revive a dead entity without an explicit “New life” that resets age to `0` and clears `preserved`.
7. **Start / stop.** Animate button or Space: if not dead and not playing → start from current age (or from `0` if previous life finished); if playing → pause. Keep `uTime` advancing in the render loop if you still want ambient motion while paused—or document a choice; age must not advance while paused.
8. **Wire the HUD.** Life journey dot follows `age`. Stage name optional in meta readout.

### Essential patterns

Lifecycle tick (React):

```js
const LIFE_DURATION = 16 // seconds for 0 → 1

function setAge(next) {
  const age = Math.min(1, Math.max(0, next))
  setDevelopment((s) => ({ ...s, age }))
  setDecay((s) => ({ ...s, age }))
  setTrace((s) => ({ ...s, age }))
  if (age >= 0.95 && !preserved) {
    setPreserved(captureTrace(individuality, decay, age))
  }
  if (age >= 1) {
    setPlaying(false)
    setIsDead(true)
  }
}

// in animation loop, when playing && !isDead:
setAge(ageRef.current + (deltaMs / 1000) / LIFE_DURATION)
```

Stage from age (for HUD or logs):

```js
function lifecycleStage(age) {
  if (age >= 1) return 'trace'
  if (age >= 0.95) return 'death'
  if (age >= 0.75) return 'decay'
  if (age >= 0.55) return 'instability'
  if (age >= 0.25) return 'maturity'
  if (age > 0) return 'development'
  return 'birth'
}
```

Handoff to Trace (conceptual):

```js
// After death: body material off or fully transparent;
// residue material uses preserved seed + preservedAge, not live uTime-driven development.
{isDead && (
  <TraceMesh preserved={preserved} traceParams={trace} />
)}
```

Space to toggle (same behavior as Animate):

```js
useEffect(() => {
  function onKeyDown(e) {
    if (e.code !== 'Space') return
    if (e.target.matches('input, button, textarea')) return
    e.preventDefault()
    toggleLifecycle()
  }
  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}, [])
```

### Observe and experiment

- Run a full life with Animate or Space; confirm the dot moves Birth → Death without manual scrubbing.
- Pause mid-development: does motion (`uTime`) continue while age stays fixed?
- Compare the same seed at age `0.2`, `0.5`, and `0.9` by pausing at those moments.
- Let one life finish: does the body disappear and leave only Study 05 trace?
- Try starting a second life only via reset—not by dragging age backward after death.
- Adjust `LIFE_DURATION`: does a slower pass make stages easier to read?

### Concept connection

Studies 01–05 taught **what** can change on the surface and in the mesh. Study 06 teaches **when** those changes happen in one ordered existence:

```text
Birth → Development → Maturity → Instability → Decay → Death → Trace
```

The specimen is no longer a material preset you inspect at arbitrary ages. It becomes a process you witness. Death is a state transition in the app, not a shader bug; trace is the consequence, not a separate artwork.

### Reflection

Where does “animation” end and “lifespan” begin in your implementation? What is the smallest state object you need so death feels final but the trace still belongs to that one individual?

---

## Study 07 — Material Variation

### Question

How can the same artificial life have different material identities without becoming a completely different object?

### Shader concept

Hold geometry, seed, age, lifecycle, and scene fixed. Change only how light, opacity, and internal color are composed in the **fragment shader**. The comparison then isolates material behavior: the specimen remains one lineage of form, while its substance reads as membrane, crystal, or something between.

Reuse the surface tools already built in Studies 01–05:

- soft position gradients and body/rim mixes (Study 01);
- seed-locked procedural noise for internal structure (Study 02);
- view-dependent Fresnel for thin edges (Study 01);
- layered alpha so the pale background shows through.

Add only what material families need: stronger edge and iridescence curves, clearer transmission-like darkening or brightening through the body, and a noise-driven mask that blends milky and crystalline regions in the Hybrid family. Do not introduce image textures or physically accurate path-traced glass. A simple Fresnel-weighted “fake refraction” tint—sampling the body color with a small view-dependent shift—is enough to suggest clear depth.

This remains primarily a **fragment/surface study**. Vertex displacement from Study 03 may stay on for continuity, but it should not be the variable you change between material families.

Treat each family as a **parameter bundle** (opacity curve, Fresnel power, iridescence strength, internal contrast, transmission mix), not as a cosmetic palette swap.

### Goal

Present three related material identities on the same living form:

1. **Membrane** — milky, semi-translucent, soft Fresnel edges, subtle cyan / pink / violet interior; reads organic and synthetic at once.
2. **Crystalline** — clearer and more mineral or glass-like; stronger edge response and iridescence; sharper internal contrast; fragile rather than polished display glass.
3. **Hybrid** — translucent crystalline patches mixed with soft opaque or milky regions; visible internal color or structure; sits between organism, mineral, and artifact.

A viewer should recognize the same seed and silhouette across all three, while still naming three different substances.

### Inputs and uniforms

- existing surface and identity inputs: position, normal, view direction, `uSeed`, noise scale;
- `uMaterialMode` or discrete presets (`membrane`, `crystal`, `hybrid`);
- body opacity / edge opacity (or a single clarity control);
- Fresnel power and rim / iridescence strength;
- internal contrast (how hard Study 02 noise regions read);
- transmission or clarity amount (how much the body “opens” toward glass);
- optional hybrid mask soft/hard edge from noise;
- shared lifecycle uniforms (`uAge`, `uTime`) left unchanged for this study—do not yet route material into decay or trace rates.

### Implementation

1. Keep the mesh, camera, lighting, seed, and age path identical to Study 06 when comparing materials.
2. Factor the living fragment look into shared blocks: body gradient, identity noise, Fresnel rim, final alpha.
3. Define three uniform presets (or one mode enum) that only retune those blocks:
   - Membrane: higher body alpha, lower Fresnel power, soft rim, muted noise contrast, little transmission.
   - Crystalline: lower body alpha, higher Fresnel power, stronger iridescence, sharper noise `smoothstep` bands, more transmission tint.
   - Hybrid: use identity noise as a mask; milky settings where the mask is low, crystalline settings where it is high.
4. Implement transmission as a fragment approximation: darken or cool the interior with facing angle, or slightly tint `bodyColor` with a second hue as `facing` rises—avoid real environment refraction probes for now.
5. Keep iridescence view-dependent (for example, mix rim hues with `normal.x` or fresnel), stronger for crystal than membrane.
6. Expose only a few UI controls: material family, clarity, Fresnel, iridescence, internal contrast. Prefer presets over dozens of raw sliders.
7. Capture side-by-side screenshots of the same seed and age under each family.
8. Note for later: the same presets could bias development, decay start, or trace density—but leave that lifecycle coupling for a future study.

### Essential patterns

Material preset (conceptual uniforms):

```js
const MATERIAL = {
  membrane: {
    bodyAlpha: 0.86,
    fresnelPower: 2.4,
    rimStrength: 0.35,
    iridescence: 0.25,
    internalContrast: 0.45,
    transmission: 0.1,
  },
  crystal: {
    bodyAlpha: 0.42,
    fresnelPower: 4.2,
    rimStrength: 0.75,
    iridescence: 0.7,
    internalContrast: 0.8,
    transmission: 0.55,
  },
  hybrid: {
    bodyAlpha: 0.7,
    fresnelPower: 3.2,
    rimStrength: 0.55,
    iridescence: 0.5,
    internalContrast: 0.65,
    transmission: 0.35,
    hybridMix: 1.0,
  },
}
```

Fragment composition (reuse Study 01–02 ideas):

```glsl
float gradient = smoothstep(uLow, uHigh, vPosition.y);
vec3 bodyColor = mix(uColorA, uColorB, gradient);

float identityNoise = noise(vPosition * uNoiseScale + vec3(uSeed));
float band = mix(0.35, 0.06, uInternalContrast);
float pattern = smoothstep(0.5 - band, 0.5 + band, identityNoise);
bodyColor = mix(bodyColor, uAccentColor, pattern * uAccentStrength);

float facing = max(dot(normalize(vNormal), normalize(vViewDirection)), 0.0);
float fresnel = pow(1.0 - facing, uFresnelPower);

// Soft fake transmission: clearer materials open toward a cooler interior tint.
vec3 transmitted = mix(bodyColor, uTransmitTint, facing * uTransmission);
vec3 surfaceColor = mix(transmitted, bodyColor, 1.0 - uTransmission * 0.5);

float irid = fresnel * uIridescence;
vec3 rim = mix(uRimColor, uIridSecondary, 0.5 + 0.5 * normalize(vNormal).x);
vec3 finalColor = surfaceColor + rim * uRimStrength * (fresnel + irid);

float alpha = mix(uBodyAlpha, uEdgeAlpha, fresnel);
```

Hybrid mask (same seed, two substance responses):

```glsl
float hybridMask = smoothstep(0.35, 0.65, identityNoise); // 0 milky → 1 crystal
float bodyAlpha = mix(uMembraneAlpha, uCrystalAlpha, hybridMask);
float fresnelPower = mix(uMembraneFresnel, uCrystalFresnel, hybridMask);
float transmission = mix(uMembraneTransmission, uCrystalTransmission, hybridMask);
```

### Observe and experiment

- Freeze seed and age; switch only the material family. Does the silhouette still read as the same individual?
- Push crystalline clarity until it becomes generic glass—then pull back until it feels fragile and mineral.
- For Hybrid, soften vs harden the noise mask: when does the mix feel like one substance with regions, and when like two materials glued together?
- Compare membrane and crystal under the same Fresnel power: which other parameters carry the family difference?
- View the same preset on the pale background; check that translucent crystal still has a readable edge.
- Scrub age while holding material fixed (optional): notice what *could* later depend on material, without implementing that link yet.

### Concept connection

Identity so far has meant seed, pattern, and lifespan. Material adds another axis of kinship: related beings may share a lifecycle while differing in substance—membrane lineage, crystalline lineage, or unstable hybrids. The object stays one artificial life; the matter is what changes.

Later, material can bias how that life unfolds (how it develops, how it fails, what residue it leaves). This study only establishes the families so that coupling remains a deliberate next step rather than an accidental side effect of color.

### Reflection

Which parameters actually change the *kind* of matter, and which only recolor the same membrane? Where is the line between a material family and a cosmetic preset?

---

## Study 08 — Material Behavior

### Question

If an entity’s material is part of its identity, should different materials age, decay, and disappear differently?

### Shader / system concept

Study 07 treated material as a living surface preset: membrane, crystalline, or hybrid on the same seed and silhouette. Study 08 couples those families to the **existing lifecycle and decay path**. `uAge` still drives irreversible progress; `uSeed` still locks which regions fail first. Material type answers a different question: **how** the body thins, breaks, and exits—not when the user presses Animate.

Do not build three separate decay shaders. Keep one shared aging pipeline (Study 04 discard field + Study 03 late instability + Study 05 residue handoff), then let `uMaterialMode` (or the Study 07 preset bundle) bias that pipeline:

| Concern | Shared for all families | Biased by material |
|---|---|---|
| When life advances | `uAge` clock, stage bands | Soft retunes of thresholds, not separate timelines |
| Which regions fail | Seed-locked noise / identity field | Soft vs sharp response curves; hybrid mask |
| How failure looks | Thinning, holes, warp, then trace | Soft dissolve vs brittle fracture vs mixed |
| What remains | Study 05 residue mesh | Density / hardness of leftover structure |

Keep **fragment** work as the primary place for organic thinning, soft holes, sharp fracture masks, and alpha exit. Use **vertex** deformation only where the family needs a different late-life instability: soft crumple for membrane, harder angular-looking warp for crystal (still procedural displacement—no rigid-body fracture or particle systems). Avoid image textures and over-engineered physics.

### Goal

At the **same seed and age**, three material families should read as the same individual living different kinds of mortality:

1. **Membrane** — gradually thinner and more transparent; soft holes and dissolving boundaries; organic, gradual decay.
2. **Crystalline** — sharper fractures and fragmented islands; brittle instability; disappearance through broken or isolated regions rather than a gentle melt.
3. **Hybrid** — milky regions thin and dissolve while crystalline patches fracture and linger; internal structure may read more clearly as soft areas open.

Material becomes part of lifecycle behavior, not only a cosmetic surface look.

### Inputs and uniforms

Reuse Studies 04–07:

- `uAge` — irreversible lifecycle driver (unchanged ownership from Study 06);
- `uSeed`, identity / decay noise scales — stable individual variation;
- `uMaterialMode` or family presets from Study 07;
- shared decay uniforms: `uDecayStart`, `uDecayScale`, `uEdgeSoftness`, `uBoundaryWidth`, `uDiscardThreshold`, `uDecayDisplacement`;
- optional bias uniforms (or derived in GLSL from mode):
  - `uDecaySoftness` / edge width (membrane high, crystal low);
  - `uFractureSharpness` (crystal high: harder `smoothstep` or absolute-edge masks);
  - `uThinningRate` (how fast body alpha falls with age before holes dominate);
  - hybrid mask from identity noise (Study 07).

Do not add a second age clock. Material should not invent a parallel lifespan; it only reshapes response to the same `uAge`.

### Implementation

1. **Start from the shared path.** Keep one body mesh, one age clock, and the same seed-locked decay field used in Study 04. Trace still appears near death via the existing preserve / residue logic.
2. **Factor decay into stages inside one fragment (and optional late vertex).** Pseudocode order: living material look (Study 07) → age-based thinning → material-biased hole / fracture mask → boundary accent → discard / alpha → near-death body exit.
3. **Membrane bias (mostly fragment):**
   - Raise edge softness; widen soft transitions so openings bloom gradually.
   - Accelerate opacity / transmission thinning with age before aggressive discard.
   - Prefer low-frequency holes that feel like dissolving tissue.
   - Vertex: mild, smooth late warp only.
4. **Crystalline bias (fragment + light vertex):**
   - Narrow edge softness; push the remaining mask toward hard steps so holes read as cracks or broken panes.
   - Optional fracture cue: combine the decay field with a second, higher-frequency ridge or `abs(noise - 0.5)` so remnants form isolated shards.
   - Vertex: slightly stronger, noisier late displacement so instability feels brittle, not rubbery—still normal-offset displacement, not real fracture meshes.
5. **Hybrid bias:**
   - Reuse Study 07’s hybrid mask.
   - Where mask is milky: membrane thinning and soft remaining.
   - Where mask is crystalline: sharper remaining and slower local disappearance so hard patches outlast soft ones.
   - As soft regions open, accent / interior color can read more strongly (exposed structure)—keep this a color/alpha cue, not a new geometry pass.
6. **Compare fairly.** Freeze seed and scrub or animate the same ages (e.g. 0.4, 0.65, 0.8, 0.95) under each family. Differences should come from bias curves, not from different seeds or different life durations.
7. **UI.** Family tabs from Study 07 remain primary. Optional: one “decay character” readout or soft/hard bias slider for debugging—avoid a full second decay panel per material.
8. **Stop before overbuild.** No particle shatter, no crack texture maps, no separate timelines per family.

### Essential patterns

Material biases on shared decay progress:

```js
// Same age and seed for every family; only response curves change.
const DECAY_BIAS = {
  membrane: {
    thinning: 0.75,
    edgeSoftness: 0.22,
    fractureSharpness: 0.15,
    lateWarp: 0.7,
  },
  crystal: {
    thinning: 0.35,
    edgeSoftness: 0.06,
    fractureSharpness: 0.85,
    lateWarp: 1.15,
  },
  hybrid: {
    thinning: 0.55,
    edgeSoftness: 0.14,
    fractureSharpness: 0.5,
    lateWarp: 0.9,
  },
}
```

Shared fragment decay, then material reshape:

```glsl
float decayField = fbm(vPosition * uDecayScale + seedOffset);
float holeOpen = smoothstep(uDecayStart, 0.9, uAge);

// Membrane: soft remaining. Crystal: hard cut. Hybrid: mix by mask.
float softRemain = smoothstep(holeOpen - uEdgeSoftness, holeOpen + uEdgeSoftness, decayField);
float hardRemain = step(holeOpen, decayField); // or a very narrow smoothstep
float remain = mix(softRemain, hardRemain, uFractureSharpness);

// Optional crystal shards: isolated high ridges survive longer.
float ridge = abs(decayField - 0.5) * 2.0;
float shard = smoothstep(0.55, 0.9, ridge);
remain = mix(remain, max(remain, shard * remain), uFractureSharpness);

// Age thinning before holes dominate (membrane leans on this).
float thin = 1.0 - holeOpen * uThinningRate;
float alpha = baseAlpha * thin * remain;
if (alpha < uDiscardThreshold) discard;
```

Hybrid regional behavior (fragment):

```glsl
float hybridMask = smoothstep(0.32, 0.68, identityNoise); // 0 membrane → 1 crystal
float remain = mix(membraneRemain, crystalRemain, hybridMask);
float thin = mix(membraneThin, crystalThin, hybridMask);
// Soft areas dissolve first; crystalline patches can retain alpha longer.
```

Vertex note (late life only):

```glsl
// Same displacement field; scale amplitude by material lateWarp bias.
float instability = smoothstep(0.65, 1.0, uAge);
float warp = (decayNoise * 2.0 - 1.0) * uDecayDisplacement * instability * uLateWarp;
// Membrane: lower uLateWarp. Crystal: higher, still continuous mesh offsets.
```

### Observe and experiment

- Same seed, age `0.7`: does membrane look softly eaten while crystal looks cracked or islanded?
- Same seed, age `0.9`: which family leaves clearer isolated remnants before trace?
- Hybrid only: scrub mid-decay—do milky zones open while brighter / clearer patches hold?
- Swap family without changing seed or age: silhouette kinship should remain; mortality character should change.
- Push crystal sharpness until it looks noisy or digital—then ease until fractures feel intentional.
- Confirm membrane never needs a second age clock to feel “slower”—soft curves alone should carry gradualism.

### Concept connection

Study 07 made substance visible. Study 08 makes substance **consequential**. Identity is no longer only pattern and lifespan length; it includes how a body fails. Membrane lineages dissolve; crystalline lineages shatter; hybrids can do both in different regions. The lifecycle system stays one story; material writes a dialect of death into that story.

Trace can later inherit the same bias (softer haze vs sharper shard residue). This study only needs the living-body path to prove the idea.

### Reflection

If two entities share a seed and a lifespan but die differently, what still makes them the same individual—and what makes them different kinds of being?

---

## Study 09 — Layered Body

### Question

How can one artificial life feel like it has an outer body and an internal living structure?

### Shader / system concept

Studies 01–08 treated the specimen as a **single** living surface—one mesh whose fragment and vertex programs carried membrane, crystal, decay, and material bias. Study 09 splits the body into **two nested meshes** that still belong to one individual:

```text
Entity
├── OuterShell   (scale ≈ 1.0)
└── InnerCore    (scale ≈ 0.55–0.7)
```

The outer shell is a larger, milky, translucent membrane: soft Fresnel edges, subtle cyan / pink tint, lower opacity toward the center, slow soft deformation. Through that shell you should see a denser inner core—stronger cyan / violet / pink / pale-yellow iridescence, procedural color variation, and motion that is related but not identical.

Why two meshes instead of faking depth in one fragment shader?

- A single transparent sphere can tint and Fresnel, but it cannot convincingly place a **smaller, independently deforming** volume inside itself.
- Nested meshes give real occlusion and parallax as you orbit: the core sits in space, not as a painted-on highlight.
- Each layer can run its own material, noise scale, time offset, and displacement amplitude without packing every behavior into one GLSL program.

Reuse Study 01–03 tools (gradient, Fresnel, seeded noise, soft vertex breath) and Study 07’s restrained pearly palette. Do **not** redesign the full Study 04–08 decay system here. Both layers still receive the same `uAge` so they share a lifespan clock, but the goal of this study is only **outer body + internal structure**. Later work can decide how the membrane opens and exposes the core at death.

### Goal

Present one entity that reads as layered life:

1. **Outer membrane** — larger translucent shell; milky / pearly / soft; subtle cyan and pink; visible Fresnel; low opacity toward the center; slow, soft deformation.
2. **Inner core** — smaller form visible through the membrane; denser and more defined; procedural cyan → violet → pink → pale-yellow transitions (not a literal rainbow); independently moving and deforming; synthetic internal structure, not a second decorative ball.

A viewer should feel one organism / mineral / artifact with insides—not two unrelated spheres stacked for effect.

### Inputs and uniforms

**Shared (one identity):**

- `uSeed` — base individual identity;
- `uAge` — irreversible lifecycle progress (same value for both layers; no new decay redesign);
- `uTime` — continuous motion clock;
- camera, lighting, pale background, highly subdivided base geometry (same sphere topology, different scale).

**Outer shell (conceptually):**

- softer body / edge alpha (center more open, rim more present);
- lower Fresnel power, soft rim, subtle cyan / pink tint;
- lower-frequency noise, smaller displacement, slower speed / pulse;
- `outerSeed = uSeed` (or a tiny fixed offset).

**Inner core:**

- higher opacity and internal contrast; stronger iridescent mix;
- different noise scale and `innerSeed = uSeed + offset`;
- stronger displacement, slightly faster or phase-shifted time (`uTime + uInnerTimeOffset`);
- restrained palette stops: cyan, violet, pink, pale yellow—blended with noise and position, not `hue = angle`.

Keep UI small: layer visibility (Outer / Inner / Both), maybe outer opacity, inner scale, and one shared age scrubber.

### Scene / component structure

In React Three Fiber (or equivalent), nest two meshes under one group:

```text
<group>                    // one entity, one orbit pivot
  <mesh scale={1.0}>       // OuterShell
    shellMaterial
  </mesh>
  <mesh scale={0.62}>      // InnerCore
    coreMaterial
  </mesh>
</group>
```

Both can start from the same `sphereGeometry` with high segment counts so displacement stays smooth. Assign **separate** `ShaderMaterial` instances (or two `<shaderMaterial />`s) so uniforms and motion do not stay locked together.

### Implementation

1. **Duplicate the living mesh path.** Clone or instantiate a second sphere; scale the inner mesh to roughly `0.55–0.7`. Keep seed, age, camera, and background identical while testing.
2. **Layered transparency (outer).** Set the shell material to `transparent: true`, write alpha from Fresnel-weighted opacity (lower toward facing center, higher at the rim). Prefer `depthWrite: false` on the translucent shell so the core is not blocked by an opaque depth mask. `DoubleSide` can help thin membranes but often doubles color and sorting cost—try front side first; enable both sides only if the shell disappears when looking through open regions.
3. **Transparency sorting.** Two transparent objects can flicker or draw in the wrong order. Practical fixes for this study: draw the **inner core first** (lower `renderOrder`) and the shell after; keep both with `depthWrite: false` if needed; avoid a third overlapping transparent body. You do not need a perfect OIT solution for a two-layer specimen.
4. **Outer look.** Reuse Study 01–02 membrane cues: soft gradient, muted accents, gentle Fresnel. Keep vertex displacement calm (Study 03 breath at low amplitude and low-frequency noise).
5. **Inner look.** Build color from procedural fields, for example mix four restrained colors with `smoothstep` bands on noise and a bit of `vPosition` so patches feel irregular and pearly—not a continuous RGB rainbow or a neon orb. Raise definition (contrast, accent strength) so the core reads denser through the shell.
6. **Independent motion.** Outer: slower `uSpeed` / `uPulseSpeed`, softer `uDisplacement`, larger-scale (lower-frequency) noise. Inner: different noise scale, `uSeed + offset`, optional time offset, slightly stronger displacement. Both still sample the same `uAge` for shared life progress (subtle aging tint is enough; no new decay pipeline).
7. **Compare.** Toggle Outer only → Inner only → Outer + Inner at fixed seed and age. Confirm the shell contributes milky enclosure and the core contributes living interior.
8. **Stop before overbuild.** No image textures, organ metaphors, heavy refraction, glass probes, or particles. Leave “membrane dies and exposes core” for a later study.

### Essential patterns

Nested entity (R3F sketch):

```jsx
<group>
  <mesh scale={1} renderOrder={1}>
    <sphereGeometry args={[1, 128, 128]} />
    <shaderMaterial
      transparent
      depthWrite={false}
      uniforms={outerUniforms}
      vertexShader={outerVertex}
      fragmentShader={outerFragment}
    />
  </mesh>
  <mesh scale={0.62} renderOrder={0}>
    <sphereGeometry args={[1, 128, 128]} />
    <shaderMaterial
      transparent
      depthWrite={false}
      uniforms={innerUniforms}
      vertexShader={innerVertex}
      fragmentShader={innerFragment}
    />
  </mesh>
</group>
```

Shared seed, different fields:

```js
const outerSeed = seed
const innerSeed = seed + 17.13 // fixed offset; still one individual
```

Outer alpha (center opens, rim holds):

```glsl
float facing = max(dot(normalize(vNormal), normalize(vViewDirection)), 0.0);
float fresnel = pow(1.0 - facing, uFresnelPower);
float alpha = mix(uBodyAlpha * 0.35, uEdgeAlpha, fresnel); // milky shell, readable rim
```

Inner restrained iridescence (not a rainbow gradient):

```glsl
float n = noise(vPosition * uNoiseScale + vec3(uSeed));
float t = clamp(n * 0.7 + vPosition.y * 0.15 + 0.5, 0.0, 1.0);
vec3 c0 = vec3(0.55, 0.82, 0.86); // cyan
vec3 c1 = vec3(0.72, 0.62, 0.88); // violet
vec3 c2 = vec3(0.90, 0.72, 0.80); // pink
vec3 c3 = vec3(0.92, 0.90, 0.72); // pale yellow
vec3 core = mix(c0, c1, smoothstep(0.0, 0.35, t));
core = mix(core, c2, smoothstep(0.3, 0.65, t));
core = mix(core, c3, smoothstep(0.55, 1.0, t));
```

Independent breath (vertex uniforms differ per layer):

```js
outer: { speed: 0.22, pulseSpeed: 0.8, displacement: 0.12, noiseScale: 1.8 }
inner: { speed: 0.4,  pulseSpeed: 1.35, displacement: 0.2,  noiseScale: 3.2, timeOffset: 1.7 }
```

### Observe and experiment

- Outer only: does the shell feel like a membrane with an empty interior, or already “complete”?
- Inner only: does the core feel like structure, or like a second hero blob competing with the shell?
- Both: can you see the core move differently while the shell slowly breathes?
- Raise outer opacity until the core vanishes—then pull back until insides return without losing the milky skin.
- Change only the inner seed offset: when does kinship break and become two entities?
- Scrub `uAge` lightly: both should age in sync without needing Study 08’s full fracture redesign yet.
- Orbit the camera: nested meshes should parallax; a faked single-shader “core” usually will not.

### Concept connection

Until now, identity lived on one surface. Layering introduces **depth of body**: an exterior that mediates the world and an interior that continues the same seed. The entity becomes less like a shaded ball and more like a vessel—still ambiguous between organism, mineral, data, and artifact. Death can later mean the outer membrane failing while the core remains, changes, or becomes the trace. This study only proves that the two-layer body is legible and kin to one seed.

### Reflection

What visual cues convince you the inner form is *inside* the same life—and what cues make it look like a prop trapped in glass?

---

## Compact Comparison

| Study | Main inputs | Fragment/surface effect | Vertex/geometry effect | Conceptual role |
|---|---|---|---|---|
| 01 Surface | Position, normal, view direction | Gradient, Fresnel, alpha | None required | Establish artificial living material |
| 02 Individuality | Position, seed, procedural noise | Internal pattern and color variation | Optional later | Distinguish individuals within a lineage |
| 03 Development | Time, age, seed, noise | Moving/evolving internal state | Subtle breathing or deformation | Give the entity temporal history |
| 04 Decay | Age, seed, stable noise field | Thinning, holes, boundary accents | Late-life instability | Encode finite lifespan and mortality |
| 05 Trace | Seed, preserved state, identity field | Sparse residue and ghost edges | Optional separate points/lines | Preserve memory after bodily disappearance |

---

## Suggested UI Controls

Keep the interface small and use presets where possible.

```text
STUDY
[ Surface | Individuality | Development | Decay | Trace ]

LIFECYCLE
Age        0.00 ───────── 1.00
Time       Play / Pause / Reset

IDENTITY
Seed
Mutation

MATERIAL
Body Alpha
Fresnel
Noise Scale
Displacement
Decay Softness
Trace Density
```

The study switcher should compare strategies. The age control should scrub the same entity through its lifespan. Do not hide the distinction between changing a shader strategy and changing lifecycle state.

---

## Documentation Template for Each Result

```markdown
### Result

![Study result](path-to-image)

**Parameters:** seed, age, colors, noise scale, displacement, opacity

**What changed:**

**What I observed:**

**What I learned:**

**What I would change next:**
```

---

## Final Checklist

### Shared setup

- [ ] The same base blob and scene are used for all five studies.
- [ ] The background remains light and low contrast.
- [ ] The form has enough subdivisions for vertex displacement.
- [ ] No image texture or noise map is required.
- [ ] Procedural noise is stable, reusable, and seeded.

### Technical understanding

- [ ] I can explain what belongs in the vertex shader and fragment shader.
- [ ] I can explain uniforms and varyings in my implementation.
- [ ] I use compatible coordinate spaces for normal and view direction.
- [ ] I understand how `mix()`, `smoothstep()`, `dot()`, alpha, and `discard` affect the result.
- [ ] I understand why geometry deformation needs sufficient vertices.
- [ ] I keep `uTime`, `uSeed`, and `uAge` conceptually separate.

### Studies

- [ ] Surface reads as milky, translucent, subtle, and synthetic—not neon glass.
- [ ] Individuality creates related entities without making identical copies.
- [ ] Development is more than a decorative loop.
- [ ] Decay is driven by age and avoids a simple whole-object fade.
- [ ] Trace persists separately from the living body.

### Documentation

- [ ] Each study has a screenshot or short recording.
- [ ] Important parameter values are recorded.
- [ ] Each study includes observations and a short reflection.
- [ ] The final comparison clearly identifies surface effects versus geometry deformation.
- [ ] The visual results connect back to identity, lifespan, death, memory, and lineage.

---

## Final Mental Model

The five studies are not five unrelated visual effects. They are one shader system viewed through a lifecycle:

```text
Shared rules + inherited parameters
                ↓
         individual identity
                ↓
        development through time
                ↓
        age-driven instability
                ↓
      bodily disappearance + trace
```

The finished study should demonstrate both technical learning and conceptual intent: shader math controls not only how the entity looks, but how its identity, finite lifespan, and memory become visible.
