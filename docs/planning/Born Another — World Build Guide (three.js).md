# Born Another — World Build Guide (three.js)

Nov 5, 2026 · @Kira

## Overview

We are building the World page of Born Another as a real-time three.js scene: a shallow nacre basin the user floats through at eye level, populated by the organisms from the Playground. The default state is the calm pearl medium (reference v3); higher moisture grows a blush glow along the terrace edges near the nursery.

**Target experience.** The user drifts through the middle ring, looks toward a warm nursery at the centre, sees mature bodies feeding younger ones through particle streams, and senses the dissolving rim behind them in the fog. The world should never be seen whole from inside: fog and terrain hide the edges.

**What real-time can and cannot match.** The reference images are offline renders. In the browser we can match their palette, fog layering, light shafts, iridescence and scale. We will not match their micro-detail or physically accurate light transport. We close the gap with three things: strong depth fog, selective bloom, and a restrained number of high-quality materials rather than many expensive ones.

## World concept

The basin is the life cycle laid out in space: centre to rim is birth to dissolution. Every system below reads its behaviour from the user's and each organism's normalised radius `r` (0 = centre, 1 = rim).

| Zone | Radius `r` | Life stages | Terrain | Light and colour | Dominant parameter |
| --- | --- | --- | --- | --- | --- |
| Nursery bed | 0.00 – 0.25 | Bud, young | Low, soft, wet; shallow pools | Warm blush glow, densest particles | Moisture |
| Drift ring | 0.25 – 0.75 | Mature | Gentle terraces, open medium | Pearl, iridescent edges | Temperature |
| Dissolving rim | 0.75 – 1.00 | Old → re-birth | Steep calcified cliffs, white strata | Cool, foggy, dissolving haze | Turbulence |

**Environment parameters** (shared with the Playground panel, all 0–1):

- **Temperature** — metabolism speed and membrane breathing; warms the colour grade toward the nursery.
- **Moisture** — drives the growth state: 0.2 = dormant pearl, 0.8 = blush growth bloom along terrace edges.
- **Turbulence** — current strength, particle jitter, fog motion; strongest at the rim.

Each parameter has a world value (the slider) multiplied by a zone curve, so the same slider feels different in different rings.

## Architecture

One world-state module owns every tweakable and the zone curves; each scene system reads from it and never from another system, except that Organisms and the Drift camera both call Terrain's `heightAt(x, z)`.

&#91;embedded content: world architecture · 7 scene systems, 1 shared state\]

Suggested layout: `src/world/config.js`, `terrain.js`, `terrain-material.js`, `atmosphere.js`, `membranes.js`, `particles.js`, `organisms-world.js`, `camera-drift.js`, `post.js`, `hud.js`, plus `index.js` that builds the scene and runs one loop.

## Layer-by-layer implementation

Build in this order; each layer must look right on its own before the next goes on.

### 1. Terrain

A single heightfield is the world's skeleton.

- **Mesh:** `PlaneGeometry(800, 800, 512, 512)` rotated flat, or a radial mesh (denser near the camera ring). Displace vertices on the CPU once at load; recompute normals.
- **Height function** `h(x, z)`, with `r = length(x, z) / R`:
  - Bowl: `bowl = R_depth * smoothstep(0.0, 1.0, r) ^ 1.6` — low centre, rising rim.
  - Terraces: quantise the bowl into 6 steps with a soft step function, `step = floor(t) + smoothstep(0.35, 0.65, fract(t))`, `t = bowl / stepHeight`, so each terrace has a flat tread and a rounded riser.
  - Natural wobble: add 2–3 octaves of simplex noise to `r` before terracing (rings are never perfect circles), plus low-amplitude dune noise on top.
  - Rim: above `r = 0.8`, sharpen risers and add vertical strata noise for the calcified cliffs.
- **Expose** radius, step count, step softness, noise amplitude as tweakable constants.
- **Height query:** keep `h(x, z)` as a pure JS function; the camera and organisms use it to stay above the ground.

### 2. Terrain material

A custom `ShaderMaterial` (or `MeshStandardMaterial` with `onBeforeCompile`) carries the nacre look.

- **Base:** pale pearl `#ece6ee` on treads, slightly darker lavender `#b9b4c8` on risers (blend by slope = `1 - normal.y`).
- **Nacre iridescence:** thin-film approximation from `fresnel = pow(1 - dot(N, V), 3)`; map `fresnel` plus a little world-position noise through a soft pastel hue ramp (blue → pink → mint). Strength 0.15–0.3; it must never dominate.
- **Edge highlight:** brighten where slope changes fast (terrace lips) — use the curvature from the height function baked into a vertex attribute.
- **Zone tint:** mix toward blush `#f3b6c9` by `(1 - smoothstep(0.0, 0.45, r))` — this is the always-on nursery hint.
- **Moisture growth (uniform `uMoisture`):** growth mask = terrace-lip mask × proximity to nursery × noise threshold that grows with moisture. Emissive blush on the mask, intensity `≈ uMoisture²`. At 0.2 almost nothing; at 0.8 the edges glow.

### 3. Atmosphere

This layer makes the scene immersive; spend effort here.

- **Fog:** `FogExp2('#c3c1d0', 0.006)` as a base, plus a custom height fog in the terrain and organism shaders: thicker below the rim line, thinner near the camera height.
- **Sky / background:** a large inverted sphere with a vertical gradient (`#b4b4c8` top, `#d2cddb` horizon). No visible horizon line.
- **Light shafts:** 4–6 tall additive planes or cones with a soft vertical gradient texture, slowly drifting; or a god-rays pass from a hidden sun mesh if budget allows.
- **Lights:** one `HemisphereLight` (sky lavender, ground blush-grey), one soft directional light from above for subtle shading, one `PointLight` at the nursery (blush, distance \~120) that tints nearby terrain and organisms.

### 4. Membranes

Two or three large translucent sheets draped above the terrain, as in the reference.

- `MeshPhysicalMaterial` with `transmission 0.9`, `thickness 0.5`, `roughness 0.15`, `iridescence 1`, `iridescenceIOR 1.3`, `side: DoubleSide`.
- Geometry: a subdivided plane bent with noise; animate the vertices slowly in the vertex shader.
- Transmission is the most expensive material in the scene. Keep it to ≤ 3 sheets and swap to a cheap additive fresnel material on low tier.

### 5. Particles

All particles are GPU-driven `Points` or `InstancedMesh` with simple shaders; no per-particle JS objects.

- **Feeding streams:** per feeding pair, a quadratic Bézier from source to target; each particle carries `t` and a random offset, animated in the vertex shader (`t += speed * dt`, wraps). Brighter and denser near the target.
- **Ambient dust:** 3–5k points in a box around the camera, recycled as the camera moves.
- **Sediment re-birth:** slow upward drift from terrace lips near the rim; spawn rate tied to dissolving organisms.
- **Size attenuation** on, additive blending, soft round sprite.

### 6. Organisms

Reuse the Playground organisms directly.

- Import the existing organism factory and its stage logic (bud, young, mature, old).
- Add a **zone behaviour**: target radius by stage (bud/young → nursery, mature → drift ring, old → rim). Steering = existing seek/avoid rules + a radial pull to the stage's target ring.
- **Height:** float at `h(x, z) + hover(stage)`, with a slow bob.
- **Life cycle:** old bodies reaching `r > 0.9` dissolve into sediment particles, then re-spawn as buds in the nursery (the existing re-birth toggle).

### 7. Camera and exploration

The user floats, never walks.

- **Controls:** drag to look (yaw / pitch with clamped pitch), WASD or arrow keys to drift, scroll to move forward / back. Pointer lock is optional; drag-to-look is friendlier on a website.
- **Feel:** velocity with damping (0.92 per frame), max speed \~6 units/s, gentle vertical bob, slight roll on turns.
- **Ground:** keep camera at `h(x, z) + 3`, eased; never below terrain. Soft boundary at `r = 0.95` that pushes the user back.
- **Follow mode:** click an organism to orbit and trail it; Esc returns to free drift.
- **UI coupling:** the HUD reads `r` and θ for the navigator mini-map and depth bar; the local environment panel shows parameter values sampled at the camera.

### 8. Post-processing

Use `pmndrs/postprocessing` (or three's `EffectComposer`).

- **Selective bloom:** only the nursery light, particles and growth emissive (threshold or a bloom layer). Intensity 0.6–1.0.
- **Tone mapping:** ACES Filmic, exposure \~1.1; colour space sRGB.
- **Subtle vignette** and a very light depth-of-field on near particles only on high tier.
- **No heavy grain**; the look is clean and milky.

## Performance budget and quality tiers

Target 60 fps on a 2021 laptop with integrated graphics at high tier, and 30+ fps on recent phones at low tier. Pick the tier on load from a short GPU benchmark (render 60 frames, measure), and let the user override it.

| Setting | High | Medium | Low |
| --- | --- | --- | --- |
| Terrain grid | 512 × 512 | 384 × 384 | 256 × 256 |
| Membranes | 3, transmission | 2, transmission | 2, fake fresnel |
| Ambient particles | 5,000 | 3,000 | 1,500 |
| Stream particles per pair | 400 | 250 | 120 |
| Organisms | 8 | 6 | 4 |
| Bloom | Full resolution | Half resolution | Quarter resolution |
| Light shafts | God-rays pass | Additive planes | Additive planes, 3 |
| Depth of field | On | Off | Off |
| Device pixel ratio cap | 2.0 | 1.5 | 1.0 |

Rules that keep the budget:

- Draw calls under \~80; merge static geometry, instance anything that repeats.
- All animation in shaders; JS updates only uniforms, camera and organism steering.
- No real-time shadows; bake soft occlusion into terrain vertex colours instead.
- Pause rendering when the tab is hidden; drop to 30 fps when the user is idle for 20 s.

## Working with Cursor

Cursor writes code but cannot see the render, so work in short loops: one prompt, run, screenshot, paste the screenshot back with what is wrong. Never ask for the whole world in one prompt.

**Setup before the first prompt**

- Put this document in the repo as `docs/world-build-guide.md` and add the reference images under `docs/refs/`. Start each chat with `@docs/world-build-guide.md`.
- Add a `.cursorrules` (or project rule) with the house rules: three.js only, ES modules, one system per file under `src/world/`, all tweakables in `src/world/config.js`, no new dependencies without asking, animation in shaders.
- Keep `lil-gui` wired to `config.js` so you can tune values live instead of re-prompting.

**Prompts, in order** (paste one, finish it, then the next)

1. **Scaffold.** "Create a `World` scene module under `src/world/` with its own renderer loop, a `config.js` of tweakables, and a `lil-gui` panel bound to it. Reuse the existing renderer setup from the Playground. Show an empty scene with background `#c3c1d0` and `FogExp2` density 0.006."
2. **Terrain.** "Implement `terrain.js` per section 1 of the guide: a 400-radius bowl with 6 soft terraces, noise-wobbled rings and sharper strata above r = 0.8. Export a pure `heightAt(x, z)`. Use a plain `MeshStandardMaterial` for now. Place the camera at r = 0.55, 3 units above ground, looking at the centre."
3. **Drift camera.** "Implement `camera-drift.js` per section 7: drag to look, WASD and scroll to drift, damped velocity, eased height above `heightAt`, soft boundary at r = 0.95."
4. **Atmosphere.** "Add sky gradient sphere, height fog, hemisphere + top directional light, and a blush point light at the nursery, per section 3. Add 5 drifting additive light-shaft planes."
5. **Terrain material.** "Replace the terrain material with the nacre shader from section 2: slope-based tread/riser colours, fresnel iridescence ramp, terrace-lip highlight, nursery tint by radius, and a `uMoisture` growth mask. Bind `uMoisture` to the GUI."
6. **Organisms.** "Import the Playground organism system into the world. Add zone steering by stage and keep each body at `heightAt + hover`, per section 6. Start with 6 organisms at mixed stages."
7. **Particles.** "Add GPU feeding streams between feeding pairs, ambient dust around the camera and rim sediment, per section 5. All motion in the vertex shader."
8. **Membranes.** "Add 2 draped `MeshPhysicalMaterial` membranes with transmission and iridescence, slowly animated, per section 4."
9. **Post and tiers.** "Add selective bloom, ACES tone mapping and vignette, then the quality tiers from section 'Performance budget', chosen by a 60-frame benchmark on load."
10. **UI hookup.** "Connect the World HUD: navigator mini-map (r, θ, view cone), depth bar, local environment readout and the nearby-organism list with click-to-follow."

**When a result looks wrong**, describe it against the reference, not in code terms: "the terraces read as stripes; treads should be wide and flat, risers short and rounded" works better than "change the smoothstep".

## Milestones and acceptance checks

Each milestone is done when every check passes on the high tier and the scene still holds 30 fps on low.

| Milestone | Prompts | Done when |
| --- | --- | --- |
| M1 · Walkable basin | 1–3 | You can drift from rim to centre; terraces read as wide flat steps, not stripes; the camera never clips the ground. |
| M2 · The medium | 4–5 | From the drift ring the rim is lost in fog; the nursery reads as the warmest point; terrace lips catch light; moisture 0.2 → 0.8 visibly grows the blush edges. |
| M3 · Living world | 6–7 | Organisms settle into their stage rings; at least one feeding stream is visible from any start point; an old body dissolves at the rim and a bud appears in the nursery. |
| M4 · Atmosphere polish | 8–9 | Membranes and bloom add depth without washing out the image; a side-by-side with reference v3 matches palette and mood. |
| M5 · Site integration | 10 | The HUD tracks position correctly; click-to-follow works; UI text stays readable over every part of the scene. |

Open questions:

- Does the World page share one renderer and organism instance with the Playground, or run as a separate page load?
- Should moisture be a global slider only, or also rise automatically as the user drifts toward the nursery?
