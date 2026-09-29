# Finite Digital Life — Shader Studies

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
