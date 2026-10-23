# Born Another — Shader Study

## Base environment

The test scene is a plain sphere on a cool gray field. A soft falloff in the background gives a little depth. There is no cast shadow and no side panel.

The labels float on the background in white. The title is larger than the age, seed, study name, and the line from birth to death. Type size follows the browser width.

![[born-another-base-setup.png]]

## Study 01 — Surface

The same sphere now has a milky surface. A vertical gradient mixes a muted pink with a muted cyan. A restrained Fresnel rim lightens the edge and shifts slightly between pink and cyan. The body stays translucent enough to feel like a membrane, and the silhouette still reads on the gray field.

![[born-another-study-01-surface.png]]

A thin parameter strip sits under the sphere: lower, upper, and rim colors, then Fresnel, strength, and opacity. This frame is Fresnel 1.00, strength 1.00, opacity 0.00, so the cyan reads stronger and the body stays more open.

![[born-another-study-01-surface-controls.jpg]]

## Study 01 — Parameter overlay

The bottom strip is gone. Parameters now sit on the right as a floating overlay. Closed, only `+ PARAMETERS` shows. Open, the same controls return—Fresnel, strength, opacity, plus lower, upper, and rim as small color circles—with `− PARAMETERS` to collapse. There is no panel, card, shadow, or divider line; spacing alone keeps the rows readable. Type scales with the stage so the layout holds across window sizes.

![[born-another-study-01-parameters.jpg]]

## Study 02 — Individuality

Study 01 stays clean: gradient and Fresnel only, no noise. Study 02 keeps the same sphere and surface base, then adds object-space procedural noise so soft cloudy regions sit on the form. A seed offsets the sample so each identity is stable and repeatable; noise scale, pattern contrast, accent color, and accent strength tune how strongly the markings read. The pattern rides with the surface when the sphere is rotated. Geometry does not change.

Both studies sit in the lower left. The active label is bright; the other is dim. Age and seed stay in the upper right. Opening parameters on Study 02 shows individuality controls in the same floating overlay as Study 01.

![[born-another-study-02-individuality.jpg]]

## Study 03 — Development

Study 03 keeps the Study 02 identity on the same sphere, then adds time and age. Soft noise motion runs through the markings. Vertices shift along their normals, stronger in mid-life and quieter near birth and late age. Age also stretches the pattern scale and tips the color balance, so scrubbing age reads as development rather than a flat loop.

The lower-left list includes Study 03. Development parameters use the same floating overlay: age, speed, pulse, displacement, and Identity Noise. Identity Noise pushes Study 02’s markings harder—extra detail and stronger accent—while motion and breath stay visible.

![[born-another-study-03-development.jpg]]

### Study 03 — Stronger noise form

The first displacement pass was too gentle: noise mostly pushed outward, pulse shared the weight, and lighting still followed the smooth sphere. The pass was rewritten so the noise field is bipolar—ridges and valleys—with an extra low-frequency ridge layer, higher default displacement and Identity Noise, and approximate normals so light follows the deformed surface. The Displacement slider now goes higher. Study 04 reuses the same breath logic so the living form stays consistent when decay begins.

## Study 04 — Decay

Study 04 keeps the developed identity and breath, then encodes mortality in the material. A stable, seed-locked noise field is compared against an age-driven threshold: after maturity, regions thin, turn transparent, and eventually discard, so the membrane breaks into incomplete structure rather than fading as a whole. Soft edges and a muted decay accent mark the boundary. Late in life, a separate age curve adds vertex instability so the body warps as it fails.

The lower-left list now includes Study 04. Decay uses the same floating parameter overlay: age, decay start, edge softness, boundary, discard, instability, decay scale, and a decay accent color. Scrubbing age from mid-life toward death shows holes opening along the entity’s own pattern. A white marker on the Birth–Death line moves with age to show the life journey.

![[born-another-study-04-decay.jpg]]

## Study 05 — Trace

Study 05 separates the living body from what remains after it. The developed form still runs through decay, but near death the membrane exits while a second, sparse residue layer stays on the field. That trace is built from the same seed and identity noise as the life it belonged to—internal filaments, a ghost rim, and decay-boundary marks—rendered in a pale, low-contrast archive color rather than as active living material.

The lower-left list now includes Study 05. Trace uses the same floating parameter overlay: age, density, trace scale, internal, rim trace, boundary, opacity, Fresnel, persistence, and trace color. Scrubbing age past late decay—or running Animate—shows the body thin out while the imprint lingers. At age ≥ 0.95 the entity’s identity is frozen in JavaScript so the residue no longer breathes or develops like a living specimen.

Implementation uses two meshes: one for the dying body (Study 04 logic with a late-life fade-out) and one for the frozen trace (static late-life warp, no `uTime` motion). An Animate / Pause control and the Space key advance age automatically along the Birth–Death line; the white marker moves with it. Studies 04 and 05 also had a shading pass to remove a dark horizontal band caused by double-sided transparency and over-bent displaced normals.

![[born-another-study-05-trace.jpg]]

## Study 06 — Lifecycle

Study 06 does not add a new shader. It connects Studies 01–05 through one clock-driven life in React. Age advances on its own from birth to death (~16 seconds) when Animate or Space is pressed. `uTime` still drives breathing and noise motion; `uAge` only moves while the life is playing and stops at death.

As age crosses each band, the existing materials take over in order: individuality at birth, development through maturity, decay through instability and late life, then the living body exits and only the Study 05 trace remains. Near age 0.95 the identity is preserved once so the residue belongs to that life. Death is irreversible for that specimen—scrubbing age backward does not revive it. After death the control becomes New Life, which resets age to 0, clears the preserved state, and starts again.

The lower-left list now includes Study 06. The HUD shows the current stage name under age and seed. Lifecycle parameters keep the same floating overlay with a single Age control for pausing and inspecting a moment. The Birth–Death marker still follows age.

Early life / development stage (age ~0.11): the form is still intact, breathing with Study 03 motion while the journey marker sits near Birth.

![[born-another-study-06-lifecycle-development.jpg]]

Late life / decay stage (age ~0.78): the membrane thins and opens along the seed-locked decay field while Animate continues toward Death.

![[born-another-study-06-lifecycle.jpg]]

![[born-another-study-06-lifecycle-decay.jpg]]

## Study 07 — Material

Study 07 keeps the same seed, breath, and Birth → Death clock from Study 06, then changes only how the body reads as matter. Three family presets retune the fragment path—clarity, Fresnel, iridescence, internal contrast, transmission—without swapping geometry or inventing a new life story. Membrane stays milky and soft-edged; Crystalline opens toward fragile glass or mineral; Hybrid mixes both through the same seed-locked noise mask so milky and clear regions share one silhouette.

The lower-left list now includes Study 07. Material parameters use the same floating overlay: family tabs (Membrane, Crystalline, Hybrid), plus age, clarity, Fresnel, iridescence, and internal contrast. Entering the study continues the lifecycle pass; the HUD still shows the stage name, and Animate / Space / New Life work as in Study 06. Through living stages the material shader holds the chosen family; from instability onward the existing decay and trace materials take over so the full journey still appears on screen, with the family’s edge and opacity carried into late life.

Hybrid at instability (age ~0.63): milky and crystalline patches share one irregular form while the Birth–Death marker sits past mid-life.

![[born-another-study-07-material.jpg]]

## Study 08 — Behavior

Study 08 keeps the same seed, age clock, and shared decay field from Studies 04–07, then lets material type change **how** the body fails—not when Animate runs. One aging pipeline stays in place; family bias retunes thinning, hole softness, fracture sharpness, and late-life warp. Membrane dissolves gradually with soft openings; Crystalline breaks into sharper, more isolated remnants with brittle instability; Hybrid lets milky regions thin and open while crystalline patches crack and linger, so interior structure can read as soft areas fail.

The lower-left list now includes Study 08. Behavior parameters use the same floating overlay: family tabs, plus age, thinning, fracture, and late warp. Entering the study continues the Birth → Death pass; stage names and Animate / Space / New Life match Studies 06–07. Compare families at the same seed and age so the difference is mortality character, not a different individual.

Hybrid at instability (age ~0.71): soft thinning with fracture pushed high—jagged crystalline edges and dissolving membrane regions on one silhouette.

![[born-another-study-08-behavior.jpg]]

## Study 09 — Layered

Study 09 no longer uses two nested meshes. The nested outer/inner pass read either as a ball in a glass bubble or as a pale haze; layered depth did not hold. The rewrite keeps **one mesh** and treats “layered” as material depth on a single life: Study 03–style breathing form, a fake interior glow (cyan → pink → yellow through milky flesh), and seed-locked dark foil fracture on the same silhouette. Soft edge grain stands in for a later particle rim.

The lower-left list includes Study 09. Layered parameters use the same floating overlay: age, interior glow, foil fracture, iridescence, and edge grain. Camera, pale background, and the Birth–Death marker stay unchanged.

Mid-life: one irregular organism with luminous interior color and crumpled dark regions—readable against the field without a second body.

![[born-another-study-09-layered.jpg]]

### Study 09.1 — Lifecycle decay

Study 09.1 connects the single-mesh layered body to the same Birth → Death clock as Study 06. Animate or Space advances age; the HUD shows the stage name; death is irreversible until New Life. The layered look stays through living stages, but disappearance is no longer a hard cut: after maturity, soft flesh thins and opens along the shared seed-locked decay field, foil patches fracture and linger, late-life warp increases, then the body exits and the Study 05 trace remains.

At instability (age 0.62): interior glow and foil fracture still read on one silhouette while holes and thinning have begun—gradual mortality rather than an instant vanish.

![[born-another-study-09-1-layered-lifecycle.jpg]]


# Born Another — Scatter

Top-level modes sit under the title: **Shader** (Studies 01–09), **Scatter**, **Path**, and **Particle**. Scatter was the first non-shader mode; Path and Particle follow the same viewport, camera, and pale field.

## Step 1 — Surface instances

Scatter reuses the development base body, randomly samples points on the unit sphere, and places a small sphere at each sample with `InstancedMesh`. Controls are only **Density** and **Regenerate**. Sampling is modular (`position`, `normal`, `uv`) so orientation, noise distribution, and other assets can land later without rewriting the mode shell.

### Attachment to the deforming surface

The base mesh deforms in the Study 03 vertex shader (`formField` + age/time envelope). The first Scatter pass stored fixed rest positions, so instances floated while the body breathed. The fix shares that displacement field: rest samples stay on the sphere; each frame the scatter shader runs the same `developmentDisplaceAmount` as the base mesh, using the same uniforms (`uTime`, `uAge`, seed, noise scale, speed, pulse, displacement). Density and Regenerate stay unchanged.

**Note:** GPU deformation on the base cannot be read back cheaply. Reusing the shared GLSL field on the instances is what keeps them glued to the surface without a second approximation.

Scatter at mid-life (age 0.50, density ~0.45): small white spheres sit on the breathing membrane and move with it.

![[born-another-scatter-surface-instances.jpg]]

## Step 2 — Membrane growths

Step 1 proved attachment. Step 2 replaces the placeholder spheres with assets that read as localized surface differentiation of the same organism—not decorations stuck on top.

### From buds and flowers to membranes

Early asset passes tried droplet buds (stalk + bulb) and abstract multi-petal flowers. Both still read as separate objects: viral spikes, botanical silhouettes, or cards sitting on the sphere. The keep direction is a single thin irregular membrane/fold—somewhere between tissue, mineral growth, and synthetic artifact—with no stem, bulb, leaf, or recognizable flower.

The procedural `MembraneAsset` builds a feather-like vane in local space (origin at attachment, `+Y` along the surface normal): a flush root apron, longer reach along the surface, soft open tip, mid-fold crease, and slight curl. Default density is sparse (~0.08). **Density** and **Regenerate** stay; a **Size** slider scales all instances uniformly without reshuffling sample positions.

### Natural transition into the host

Rigid tangent offsets made growths look placed. Two fixes:

1. **Geometry** — a wide, slightly inset root apron that stays near the surface longer before lifting.
2. **Scatter shader** — each vertex footprint wraps onto the unit sphere; lift blends by `aAttach` (1 at root → 0 at free edge). Displacement still uses the shared Study 03 field sampled on that footprint, so aprons follow host curvature and breath.

Root alpha softens into the base membrane so the join dissolves rather than drawing a hard seam.

### Resolution and shading

Low segment counts made the vane look faceted. Tessellation rose (now ~72×36), with multi-octave micro-ripples and vane grain on the free membrane, and normals finite-differenced from the same procedural field so detail shades smoothly. The base BORN ANOTHER mesh stays intentionally faceted; only scatter membranes were refined.

The scatter fragment path is still lean (palette + Fresnel + root fade). Further “Cynora-like” resolution would add per-pixel normal perturbation, fake thickness/transmission, and light iridescence in the scatter shaders—not another subdivision pass alone.

Surface and individuality defaults were retuned for the pale field: lower pink `#e7b6c2`, upper cyan `#a4e2e6`, rim `#a8feff`, accent `#ff0000`.

Scatter sampling, normal alignment, deformation follow, and the random distribution shell are unchanged. Noise-based clustering and lifecycle animation for growths are still later work.

Scatter near late life (age 0.93, density 1.00, size 2.20): dense feather-like membranes cover the host; Density, Size, and Regenerate sit in the floating overlay.

![[born-another-scatter-membrane-growths.jpg]]

## Step 3 — Growth clusters and shared life

Step 2’s single membranes still read as many flat translucent pieces. Step 3 replaces each sample with a **GrowthCluster** and connects Scatter to the same Birth → Death clock as Study 06.

### GrowthCluster morphology

Each scatter point is one cluster with a shared root on the surface, built from **2–3 broad membrane lobes**. Lobes rise along the surface normal and unfold in slightly different directions. After a spiky first pass, the form was simplified: large continuous sheets, rounded asymmetric silhouettes, gentle curl only—no thin spikes, sharp tips, or heavy edge noise. Tessellation stays dense enough for smooth shading. Seven deterministic cluster variants (lobe count, height, width, curl, lean) plus a spin around the normal keep instances in one morphological family without looking identical.

**Size** scales the whole cluster. A stable per-instance jitter (~0.55×–1.5×) adds random scale; Regenerate reshuffles positions and sizes together. Density was opened so the slider can pack the surface more fully (default mid-sparse, max on the order of a few hundred clusters).

### Study 06 lifecycle in Scatter

Scatter no longer freezes on a mid-life development body. The viewport uses the Study 06 lifecycle path: individuality → development → decay openings → body exit → trace residue. **Animate / Pause**, **Space**, the Birth–Death marker, stage name, and **New Life** after death match the shader lifecycle studies. An **Age** slider in Scatter Parameters scrubs the shared clock and pauses playback.

Growth clusters dissolve on the same seed-locked decay field as the host, fade with late-life exit, and unmount near death so they do not float over the trace.

### Scatter shading vs base color

The base body still owns cyan/pink/red: vertical `uColorA`/`uColorB` from object-space Y, red accent blotches from object-space `fbm` (`uAccentColor`), rim from Fresnel. Scatter instances use a **separate** attachment material that reuses the surface palette (lower / upper / rim) but mixes by facing and transmission—no identity noise blotches. Soft fold shading and Study 06-style remaining/exit live in that scatter fragment path only.

### Camera

Orbit controls keep mouse orbit and add a slow `autoRotate` so the organism turns on its own without blocking drag.

Sampling, footprint wrapping, Density / Size / Regenerate, and the faceted base mesh stay in place. Noise-based clustering of samples is still later work.

Scatter in early development (age 0.23, density 0.42, size 2.08): growth clusters sit on the living host while Age, Density, and Size share the floating overlay.

![[born-another-scatter-growth-clusters.jpg]]

## Step 4 — Growth types: Membrane, Plume, Pod

Scatter Parameters gains a **Growth Type** control: **Membrane | Plume | Pod**. Switching type replaces the instanced asset only—sample positions stay put—so Density, Size, and Regenerate keep working across all three. Attachment still uses the shared Study 03 displace field and footprint wrap; the translucent scatter material (surface lower / upper / rim) is unchanged. Material readability was tightened earlier: higher body opacity, less transmission, depth write on the host, and denser scatter alpha so growths separate from the milky core.

### Membrane

Membrane is the Step 3 GrowthCluster kept as the default growth type: each sample is one cluster of **2–3 broad membrane lobes** with a shared root, soft unfolding, and mild size/facing jitter. It reads as crumpled secondary tissue close to the host—not stalks, flowers, or feather vanes.

Scatter in early development (age 0.14, density 1.00, size 2.20), Growth Type **Membrane**: dense overlapping translucent lobes pack the silhouette while Membrane / Plume / Pod sit above the Age–Density–Size row.

![[born-another-scatter-type-membrane.jpg]]

### Plume

Plume is a separate elongated asset—one complete form per sample. A central spine starts along the surface normal and sweeps into the spin-tangent flow; two asymmetric side vanes broaden mid-length and taper to a soft tip. Edge ruffle and light vein detail keep it feather-like without becoming a recognizable bird feather or a flat membrane sheet. Instance yaw jitter stays mild so the field keeps a coherent rotational comb.

Scatter in early development (age 0.15, density 1.00, size 1.22), Growth Type **Plume**: directional translucent fins extend from the host and trail with the auto-rotate flow.

![[born-another-scatter-type-plume.jpg]]

### Pod

Pod is a localized surface swelling, not an object on a stem. Each sample is one low asymmetric dome: broad rim on the host, peak height kept below the footprint width, soft elliptical deformation, no neck or separate bulb. Pods are larger than membrane/plume pieces, so at the same Density slider value their count is scaled down (~20%) to keep the silhouette readable. Size jitter stays tight so extremes do not break the blister family.

Scatter in early development (age 0.09, density 1.00, size 1.87), Growth Type **Pod**: soft translucent domes inflate from the membrane surface and merge into the body’s outline.

![[born-another-scatter-type-pod.jpg]]


# Born Another — Spline

Top-level **Path** sits beside Shader, Scatter, and Particle. It reuses the same viewport, camera, pale field, Birth–Death clock, and living body as Scatter—Study 06 lifecycle visuals with Age, Animate / Space, and New Life—without scatter growths.

## Step 1 — Surface path drawing

The first Path pass lets the user draw strokes on the deforming organism. Path data is modular: each stroke stores ordered **rest-space** samples on the unit sphere so later stages can drive growth or deformation from the same points.

### Draw vs orbit

Drawing is not always on. Path Parameters include a **Draw** toggle (**Draw · Off** / **Draw · On**, underlined when active) plus **Clear Path** and **Age**. With Draw off, the pointer only orbits and zooms. With Draw on, the canvas uses a crosshair, orbit is disabled for the session, and click-drag samples the surface. Leaving Path or turning Draw off cancels an unfinished stroke and restores orbit.

### Raycast → rest samples → deformed spline

Pointer hits use a **unit-sphere raycast** (same rest frame as Scatter attachment), not screen-space ink. Samples are spaced in rest space, thinned on stroke end, then smoothed with a Catmull-Rom curve. Each frame the rest samples run through the shared AGE/time displace field (macro morphology + Study 03 micro / breath), matching the body shader, and the ribbon is lifted slightly along the deformed normal so it stays readable above the membrane.

### Visibility

Thin WebGL lines were hard to see. Strokes now render as short **tube ribbons** (white, translucent, depthWrite off) so the path reads clearly against the milky body while the organism breathes and ages.

Path in early development (age 0.05), Draw · On: a thick white surface spline follows the breathing membrane while Age, Draw, and Clear Path sit in the floating overlay.

![[born-another-spline-path-draw.jpg]]

## Step 2 — Path as growth influence

Step 1 only drew on the surface. Step 2 lets closed strokes also reshape the living body: vertices near the path swell outward along the deformed normal so the organism reads as growing along the trail, not as a tube stuck on top.

### Growth field

Path Parameters add **Growth Strength** and **Growth Radius**. Packed rest-space samples from the strokes feed a soft influence field (chord distance on the unit sphere). Strength sets how far the shell lifts; radius sets how wide the swell falls off. AGE macro morphology and Study 03 micro / breath stay underneath—the path does not replace the life-cycle form. The same field is mirrored in GLSL on the body and in JS `deformRestPoint` so Path ribbons stay glued while the shell swells.

No branching or secondary scatter objects. Draw / Clear Path / orbit behavior from Step 1 is unchanged.

### Body vanishing on Animate

With path growth wired in, Path (and any study using the development / decay / layered vertex path) went blank as soon as the life clock left birth: the white ribbon still drew, but the main form disappeared. The growth shader used a variable named `active`, which is reserved in GLSL, so the vertex program failed to compile. Renaming it restored the body through development and decay while Animate runs. Path uniforms also sit at the top of those vertex shaders (before helper functions), and unused path-point slots are not normalized, so empty slots cannot turn the mesh into NaNs.

Path in early development (age 0.10), Growth Strength 0.28, Growth Radius 0.32: a white surface stroke sits on the living body while the membrane swells along the trail; Age, growth sliders, Draw, and Clear Path sit in the floating overlay.

![[born-another-spline-path-growth.jpg]]


# Born Another — Particle

Top-level **Particle** sits beside Shader, Scatter, and Path. It reuses the same viewport, camera, pale field, Birth–Death clock, and living body as Scatter and Path—Study 06 lifecycle visuals with Age, Animate / Space, and New Life—without scatter growths or path strokes.

## Step 1 — Near-surface particle layer

The first Particle pass covers the living membrane with a dense grit of small glowing points. Samples are Fibonacci points on the unit sphere (same rest frame as Scatter attachment). Each sample is a tiny instanced sphere; the GPU applies the shared AGE macro morphology plus Study 03 micro / breath so the layer tracks the deforming body instead of floating as a separate cloud.

### Birth alignment

At birth (age ≤ 0.02) the body still uses the individuality vertex path—an undeformed unit sphere—while an early particle shader already applied macro body scale. That mismatch read as a larger spherical halo around the soft silhouette. The particle vertex path now mirrors the lifecycle surface: unit sphere at birth, then the same development / decay displace as the host, with back-facing grit culled so the layer reads on the front membrane.

### Float, size, and glow

Grit is lifted a short distance along the deformed normal so it clears the membrane and reads as a floating skin that still follows form change. Size was tuned down from an oversized first pass to a finer fleck; the fragment path uses additive blending with a soft camera-facing hotspot (bright core, luminous falloff) so particles glow rather than reading as hard white beads.

### Controls and life clock

Particle Parameters use the same floating overlay: **Age** scrubs the shared clock and pauses playback; **Particle Count** sets how many rest samples are drawn (default mid-dense, max **16000**). **Animate / Pause**, **Space**, the Birth–Death marker, stage name, and **New Life** after death match Scatter and Path. Particles unmount near death so they do not linger over the trace residue.

Particle in early development (age 0.19, count 16000): a dense glowing grit floats just above the irregular membrane while Age and Particle Count sit in the floating overlay.

![[born-another-particle-surface-layer.jpg]]

## Step 2 — Near-surface volumetric field

Step 1 was a thin coating. Step 2 keeps the same surface-aware attachment and expands it into a soft volume around the organism: each particle still rides the deformed membrane, but carries an individual offset along its local surface normal.

### Height distribution

Rest samples stay on the unit sphere. A deterministic per-particle height in `[0, 1]` is biased so the field stays dense at the body and thins outward—most grit remains very close, some floats at a moderate distance, and only a small fringe reaches the outer shell. Height is scaled by **Field Thickness**; a small base clearance keeps the densest layer from burying into the membrane. Outer particles fade slightly so the silhouette still reads as the irregular host rather than a round cloud.

### Controls

Particle Parameters add **Field Thickness** beside Age and Particle Count. Age, Animate / Space, and New Life are unchanged. Trails, AGE-driven particle behavior, Path interaction, and particle escape are not part of this step.

Particle in early development (age 0.23, count 16000, Field Thickness 0.45): a soft volumetric grit stays dense at the membrane and thins outward while still following the irregular silhouette; Age, Particle Count, and Field Thickness sit in the floating overlay.

![[born-another-particle-volumetric-field.jpg]]

## Step 3 — Spatially varying vector field

Step 2 filled a soft volume around the body. Step 3 replaces uniform or weakly differentiated motion with a **position-dependent 3D vector field** so the grit reveals invisible streams, bends, and local circulation while staying associated with the organism.

### Flow structure

The field is sampled in rest space (same unit-sphere frame as attachment), so nearby particles move coherently. A low-frequency noise layer sets a few broad flow regions with different directions; a curl-style component adds subtle local swirling. Motion is smooth and organic—no per-frame jitter. Flow is projected mostly onto the surface tangent so particles stream along the membrane rather than escaping; a light vortex and height breath keep the volume alive without trails or Path coupling.

### Field Complexity

Particle Parameters add **Field Complexity** beside Age, Particle Count, and Field Thickness. Low values keep a few wide streams; higher values tighten spatial frequency, strengthen swirl, and introduce more bends. Volumetric height distribution from Step 2 is unchanged. Trails, AGE-driven particle life, Path interaction, and full escape remain later work.

Particle in early development (age 0.06, count 16000, Field Thickness 0.45, Field Complexity 1.00): the volumetric grit streams along a structured near-surface field while Age and the field sliders sit in the floating overlay.

![[born-another-particle-vector-field.jpg]]

## Step 4 — Living currents, trails, and a fine-grained field

Step 3 gave the grit direction, but motion still read as a uniform drift with independent particles. Step 4 rebuilds particle motion as currents that run across the deformed body, then refines how the field looks so collective density, not individual dots, defines the structure. Organism geometry, AGE deformation, the body shader, and the palette are unchanged.

### GPU currents on the deformed surface

Each particle's rest point now lives in a GPU simulation texture (`GPUComputationRenderer`) and is advected every frame, rather than being offset by a fixed sinusoidal stream. The velocity is built from the body's own live relief (macro morphology plus micro displacement). Most of the flow comes from a **stream function**—relief, a slowly drifting regional field, and finer eddies—rotated into its tangent (n × ∇ψ). That field is divergence-free, so currents circulate, wrap bulges, and shear past each other without draining into sinks. A weak downhill term lets particles gather in dents and part over bulges, giving local convergence and divergence. Particles re-seed after a lifespan with a soft fade, and the vertex shader places every rest point on the deformed surface exactly like the body, so the field follows changing normals and curvature as AGE moves. Neighbouring particles move in nearly the same direction (mean cosine ≈ 0.83) while distant ones are uncorrelated, so the motion reads as spatially varying streams rather than rotation.

### Motion trails

A short history of the simulation state is recorded into a ring buffer, and each particle can draw a thin, camera-facing ribbon through its actual recent positions, placed on the current surface and fading toward the tail. **Trail Length** controls the span; it now defaults to **0** after the streaks proved too literal.

### Appearance variation

Stable per-particle random values drive appearance only: **Size Variation** (85% fine grains, 15% slightly larger), **Brightness Variation** (mostly faint, a few brighter), **Color Influence** (faint tints from the organism's own rim cyan, accent orange, and lower pink, white staying dominant), and **Pulse Strength** (slow breathing, each particle on its own 7–21 s period and phase). Grain size dropped to a finer base radius with reduced glow, and on-screen size is capped so particles stay pinpoint-sized when the camera approaches in Explore.

### Density and count

A second simulation output computes a density value per particle from the same stream function, banded into lanes and grouped by a broad patch field; each particle shows only where density exceeds its own fixed threshold, and re-seeding favours denser points. Dense lanes therefore flow with the currents while gaps stay quiet. The default count rose to 20000 and **Particle Count** now reaches **120000**, using a lighter grain mesh to keep large counts real-time.

Particle in early development (age 0.05, count 116000, Field Thickness 0.23, Field Complexity 1.00, Trail Length 0.07, Size Variation 0.49, Brightness Variation 0.96, Color Influence 1.00, Pulse Strength 1.00): a dense, fine-grained field streams over the irregular membrane, with tinted grains catching the orange and cyan of the body; all particle controls sit in the floating overlay.

![[born-another-particle-living-currents.jpg]]


# BornAnother_L-system

Top-level **L-System** sits beside Shader, Scatter, Path, Particle, and Explore. Unlike those modes, the first L-System passes are **independent of the organism**: no Specimen body, Scatter, Path, or Particle layers. The goal is a modular 3D branching generator that can later attach to the living surface without rewriting the core expand / turtle pipeline.

## Step 1 — Standalone tab and basic branching

L-System was added as a new mode with the same HUD tab pattern and floating parameter overlay. A modular package under `src/lsystem/` owns params, string expansion, turtle interpretation, and the R3F field. The first grammar pass and line rendering proved the tab shell; controls were **Recursion Depth**, **Branch Angle**, and **Segment Length**.

Early frames still read mostly as a trunk with weak side twigs when tip symbols did not redraw as full child forks. That grammar issue is fixed in Step 2.

L-System Step 1 (depth 2): a simple recursive fork on the pale field—standalone branching before organism integration.

![[born-another-lsystem-basic.jpg]]

## Step 2 — Hierarchical structure, tapered branches, framing

Visualization moved from thin lines to **dark gray tapered cylinders** (thicker at the root, thinner at the tips). The production was rewritten to a standard recursive grammar with turtle push/pop:

- axiom: `F`
- rule: `F → F[+F][-F]` (later extended for 3D in Step 3)

Every `F` rewrites into a segment plus child `F` tips, so depths **1–5** each add a clear hierarchy rather than decorating a single spine. The structure is auto-framed in the viewport so depth / angle / length remain readable at larger display size. Existing depth, angle, and length controls stay wired.

L-System Step 2 (depth 4): a hierarchical dark tree with tapering limbs filling the frame; Recursion Depth, Branch Angle, and Segment Length drive the form.

![[born-another-lsystem-hierarchy.jpg]]

## Step 3 — 3D axial rotation and seeded randomness

Branches no longer stay in one plane. On each `[` push, the turtle rolls around the current growth axis by **Branch Rotation** × sibling index so successive forks leave the parent plane. A **Randomness** slider jitters branch angles and segment lengths using the shared HUD **Seed** (deterministic mulberry32), so the same seed repeats and a new seed reshuffles the tree. Recursive hierarchy and the earlier controls remain; organism attachment is still later work.

L-System Parameters now include Recursion Depth, Branch Angle, Segment Length, **Branch Rotation**, and **Randomness**.

L-System Step 3 (depth 4, Branch Rotation 90, Randomness 0.25): a spatially distributed 3D hierarchy with tapered dark branches; axial twist and seeded jitter open the crown off-plane.

![[born-another-lsystem-3d-branching.jpg]]

## Step 4 — Surface-attached vascular web on the living organism

The L-System leaves free space and grows **on the organism's membrane**. The shared Specimen body returns in this tab (Study 06 lifecycle visuals), and the branching becomes a fine white vascular web that radiates from a few growth hubs, forks progressively, and tapers to hairlines—closer to veins under a translucent skin than to a tree.

### Growth on the surface

Branches are traced on the rest-space unit sphere: each hub sends out roughly twenty radial filaments, and each filament spawns side branches that leave nearly parallel to their parent before curving away. Four hubs are spread around the body (a seeded, rotated tetrahedron) so a web is visible from any viewing angle. Topology depends only on SEED and the shape sliders, so the same seed always repeats the same network.

### Attached through every deformation

Earlier passes deformed branch points on the CPU and drifted off the surface while the form breathed and morphed. Veins are now deformed **on the GPU with the body's own shader code**: the same macro morphology (AGE + SEED), breathing micro-displacement (time), and late decay warp. Each vein point is also snapped to the exact triangle the body rasterizes, so it cannot sink below the visible membrane. When the organism stretches, breathes, or warps, the web moves with it frame by frame.

### Hierarchy and thickness

Ribbons carry per-point width: primaries are thickest at the hub, each child starts thinner than its parent at the branch point, and every branch tapers toward its tip. **Base Thickness**, **Taper Strength**, and **Child Thickness Ratio** control this, alongside the existing Recursion Depth, Branch Angle, Segment Length, Branch Rotation, and Randomness.

### AGE lifecycle

An **Age** slider in L-System Parameters drives the shared global AGE.

- **0–0.5:** a growth front spreads outward from each hub. Primaries lead and finer levels follow.
- **0.5–0.7:** the full network.
- **0.7–1:** fine branches thin, retreat, and break into fragments first, leaving faint residual traces of the primaries.

Scrubbing backward gives identical results.

L-System Step 4, early growth (age 0.18): short primaries radiate from a hub with only a few side branches, already following the lumpy membrane.

![[born-another-lsystem-surface-growth.jpg]]

L-System Step 4, mature web (age 0.55): a dense radial vascular network attached to the deformed organism; the L-System Parameters overlay shows Age and the thickness controls.

![[born-another-lsystem-surface-web.jpg]]

L-System Step 4, bold variant (age 0.15, Recursion Depth 4, Branch Angle 40, Segment Length 1.10, Branch Rotation 55, Randomness 0.29, Base Thickness 0.03, Taper Strength 1.00, Child Thickness Ratio 0.36): pushing thickness and taper turns two of the hubs into heavy, tapering root-like webs that still wrap the lumpy membrane.

![[born-another-lsystem-surface-thick.jpg]]

## Step 5 — Radial vein units with contact, and a life animation

The web is rebuilt as separate **radial vein units**. The earlier fan-like hubs read like sea anemones, so I first fixed the hierarchy and then grew it radially again, this time with branches that respect each other's space.

### Hierarchy first

Each branch is a single continuous vein. Secondaries sprout at distributed positions along a primary, never from the hub itself. They leave close to the parent's direction, then gradually curve away to their own side. Tertiaries grow the same way from secondaries. Width tapers continuously: each child starts thinner than its parent at the branch point and ends in a smooth point.

### Radial units

Ten hubs are spread evenly over the body (a seeded Fibonacci distribution). From each hub, five to seven primaries radiate in different directions, evenly spaced around the hub with a little seeded variation. Every primary carries its own secondaries and tertiaries.

### Branches stop when they meet

All branches of all units grow together in time, in small steps over the rest sphere. Finer levels start later, matching the visible growth front. Before each step, a branch checks for other branches nearby. If it would come within a small gap of one, it stops for good and its tip still tapers to a point. The only branch it ignores is the one it sprouted from. Whichever branch reaches a spot first keeps it, so:

- neighbouring branches fill the space between primaries without crossing;
- units grow until they meet the veins of the next unit, leaving the surface divided into territories.

The network still follows every AGE deformation of the organism through the body's own shader code, and the same SEED always gives the same network.

### Space bar: birth to death

In the L-System tab, the **space bar** (or the new **Animate** button) plays the whole life. The first press starts from birth (AGE 0), and AGE then runs to death in about sixteen seconds:

- hubs sprout and the radial veins grow out;
- the units reach maturity and meet each other;
- the veins thin and fragment as the body decays.

Pressing again pauses, and the next press resumes. After death, the space bar starts a new life. Moving the Age slider takes manual control back.

L-System Step 5 (age 0.50, SEED 437201, Recursion Depth 5, Branch Angle 30, Segment Length 0.82, Branch Rotation 78, Randomness 0.85, Base Thickness 0.02, Taper Strength 0.18, Child Thickness Ratio 0.85): radial units on the mature organism. Each hub sends primaries in several directions, finer branches fill the gaps between them without overlapping, and growth stops where neighbouring units meet.

![[born-another-lsystem-radial-units.jpg]]


# Born Another — Material

Top-level **Material** sits after L-System. It is a dedicated material study for the living organism, separate from Shader **Study 07 — Material**: the organism geometry, AGE deformation, viewport, camera controls, Birth–Death clock, Animate / Space, and New Life are all shared with the other living tabs, and only the body's surface material changes. Other tabs keep their existing materials untouched.

## Step 1 — Tab structure and basic material controls

The first pass sets up the structure only; complex effects such as real transmission, refraction, or thickness are later work.

### A shareable material module

The material lives in its own module under `src/material/`, independent of any tab:

- `materialParams.js`: default values and slider definitions;
- `organismMaterial.js`: creates the material uniforms and syncs them from parameter values;
- `organismMaterialShader.js`: the preview fragment shader.

The shared Specimen body accepts an optional organism material. When it is set, the body keeps the vertex shader of its current life stage, so every AGE deformation is identical, and only the fragment shader is swapped for the material preview. At death the existing trace residue takes over as before. Because the module is decoupled from the Material tab, any other tab can adopt the same material later by passing the same parameters.

### Preview shading

The preview keeps the organism palette (body gradient from the upper to the lower color, rim color at the edge) and adds four simple, readable responses:

- **Core Opacity:** how solid the body reads where it faces the camera.
- **Shell Transmission:** how see-through the edge shell is; high values let the silhouette thin to a glassy outline.
- **Roughness:** the softness of the highlight and the width of the rim glow; low values give a small sharp highlight, high values a broad matte sheen.
- **IOR:** sets the Fresnel reflectance at the edge, so higher values give a stronger rim.

### Controls

Material Parameters use the same floating overlay as the other tabs: **Age** (shared global AGE, pauses playback when moved), **Core Opacity**, **Shell Transmission**, **Roughness**, and **IOR**.

Material Step 1 (age 0.50, Core Opacity 0.72, Shell Transmission 0.55, Roughness 0.42, IOR 1.38): the mature organism rendered with the material preview. A cyan Fresnel rim and a soft highlight sit over the pale-to-pink body gradient, and the Material Parameters overlay shows the four material controls beside Age.

![[born-another-material-tab-basic.jpg]]

Material Step 1, matte variant (age 0.22, Core Opacity 1.00, Shell Transmission 1.00, Roughness 0.95, IOR 1.77): the organism in development with a fully solid core and a high roughness. The highlight spreads into a broad soft sheen over the cyan top, and the body reads as a dense, velvety form fading to pink below.

![[born-another-material-matte-development.jpg]]

## Reflective glass

The same organism, AGE deformation, and seed now read as dense reflective glass. The surface mirrors a dark cyan-and-pink studio and also looks through it, so the body keeps physical mass while a few regions open into clearer glass. Those clearer pockets stay local. The rest of the form stays dark and reflective, and the whole organism does not wash out into a pale or matte surface.

Reflections follow the folds as flowing bands. Each band has a wide colored shoulder and a narrower, brighter core, and that core strengthens and softens along the surface. Some stretches read as broad pink or cyan flows; others tighten into thinner streaks. The dim gaps between them stay dark, so the bright flows keep their contrast.

The four material controls are unchanged. **Core Opacity** weights how much of the dense mask stays reflective. **Shell Transmission** opens the glass toward refraction. **Roughness** blurs the reflected studio. **IOR** sets the Fresnel strength at the edge. On the Material tab the camera sits farther back than on the other tabs, so the mature organism fits inside the frame and clears the navigation and the Birth–Death line. Leaving the tab restores the usual view. Shader Study 07 and the other tabs keep their own materials.

Material, reflective glass (age 0.50, SEED 884731, Core Opacity 0.70, Shell Transmission 0.80, Roughness 0.18, IOR 1.50): the mature organism. Dark reflective mass carries cyan and pink flows of differing width and softness, with a few clearer openings inside the form.

![[born-another-material-reflective-glass.jpg]]


# Born Another — WORLD V2

WORLD V2 reframes BORN ANOTHER as a finite procedural world that can be encountered from outside and entered. It is isolated from the earlier Shader Study architecture: the Study tabs remain intact, while WORLD V2 owns its geometry, camera transition, environment, postprocessing, and lifecycle integration.

## Exterior / interior vertical slice

One seeded procedural surface defines both sides of the organism. The exterior uses the outward-facing body and membrane; the interior renders the back side of that same surface, with inward-facing crystalline structures. **Enter** moves the camera smoothly through the membrane into the inner world, where dragging looks around; **Exit** returns to the exterior. The exterior organism can also be rotated by dragging and continues its slow display rotation after death.

## Deterministic Life Engine

The independent Life Engine advances at a fixed 30 Hz timestep through a finite 36-second life. AGE moves irreversibly from 0 to 1 while persistent growth, mineralization, decay, memory, intervention history, and spatial growth state accumulate. At AGE 1 the life is terminal: stepping and new interventions stop, breathing ends, and the final structure remains visible. A Seed plus intervention history and simulation step reproduces the same state exactly.

Development controls provide **Play / Pause**, **Restart**, Seed entry, and a read-only AGE display. Restart replays the same life and history from birth; a new Seed starts a clean life.

## Minimal Spatial Growth

The surface is divided into a stable seeded lattice of 48 regions, each connected to its five nearest neighbours. Mineral availability accumulates locally and propagates between neighbours. Crossing a threshold creates a persistent nucleation event, with a maximum of ten active sites. Seven slots are reserved for autonomous nucleation and three remain available for intervention-driven growth, so a later touch can still affect structure.

Each event contains a surface region, birth step, local normal, seeded growth direction, orientation, and scale. Exterior and interior crystals are paired from that same event and consume the same growth history. This moved WORLD V2 beyond revealing only crystals generated at birth: intervention can change which regions eventually nucleate.

## Surface intervention and comparison

A short click on the exterior is raycast onto the organism and mapped to the nearest growth-field region. A temporary luminous ring confirms the touch. The stimulus is recorded permanently at the current simulation step, then gradually raises mineral availability in that region and its neighbours; it never spawns a crystal immediately. Multiple clicks are recorded independently. Pointer movement is treated as rotation rather than intervention, so users can drag and click without the two actions conflicting.

A development-only **Compare** view replays an untouched baseline at the same Seed and AGE. It lists baseline and stimulated region IDs and reports when future crystal locations diverge. **Reset clean trial** clears interventions while retaining the same Seed for another controlled test.

## Background study

The rendering can be compared against four background studies without resetting AGE, Seed, camera, or simulation state:

- **A — Light:** flat desaturated cool gray;
- **B — Dark:** black background; default World look (materials, lights, bloom, finish pass);
- **C — Atmospheric:** a quiet blue-gray gradient with no horizon;
- **D — Shader:** same underlying scene as **B — Dark**, plus a D-only screen-space grade (see below).

WORLD V2 with the Atmospheric background during spatial mineral growth (Seed 7319, AGE 0.418). Existing lighting, materials, camera, postprocessing, lifecycle, and controls remain unchanged while the background is compared.

![[born-another-world-v2-atmospheric.png]]

## D — Shader (B — Dark + milky grade)

Earlier, D only swapped the clear/background to a light gray (`#C5C9D1`) while keeping dark materials, which did not match the Figma target. The intended pipeline is now:

**B — Dark render → shared bloom / finish → D-only compositing grade → milky output**

Implementation (`WorldV2.jsx`):

- `createWorldBackground('shader')` uses the same black as Dark so A / B / C / D do not fork materials, lights, fog, PMREM, bloom, or the existing finish pass.
- After `FINISH_SHADER`, a `ShaderPass` (`SHADER_STUDY_GRADE`) soft-inverts the Dark frame, lifts toward paper gray, and keeps muted pastel chroma. It is enabled only when `backgroundStudy === 'shader'`; for A / B / C the pass is disabled.
- UI chrome for D follows the Light study (dark type) so labels stay readable on the high-key image.

Switching B ↔ D changes only the final grade, not organism or Life Engine state. No second Canvas. Screen-space treatment is enough for a first match to the Figma high-key / milky reference; material shaders were left alone.

WORLD V2 with **D — Shader** active (Seed 7319, AGE 0.797, interior). Same underlying Dark scene and Life Engine state; the milky high-key look comes from the D-only grade. Interface uses dark type for contrast on the pale frame.

![[born-another-world-v2-shader-milky.jpg]]

## Next morphology study

The current Life Engine nucleation is spatial and persistent, but each new dynamic site still uses simple faceted placeholder geometry. The next proposed step is a constrained crystallographic grammar: one dominant prism with a polygonal cross-section and tapered termination, followed by a small number of angularly constrained secondary crystals. The topology would be derived deterministically from each existing nucleation event and local mineral budget, with staged branch emergence rather than uniform whole-cluster scaling. This morphology work is proposed but not yet implemented.


# Born Another — Windows Particle / Explore (desktop Chrome)

On Windows 11 + Chrome (e.g. NVIDIA RTX 5070), **Particle** and **Explore** could freeze the whole browser while World and other Studies stayed usable. macOS and mobile kept the full field. Console `[BA-DIAG]` logs often never flushed because the tab locked first.

## Causes

1. **Freeze:** mounting `GPUComputationRenderer` (live particle currents) on tab switch — the Mac path. Explore shares `ParticleField` with Particle.
2. **After a safe (GPGPU-off) path:** an 8k soft-cap made density ignore the slider; a lite vertex shader (and fragile float state textures) meant grains did not follow organism AGE deformation.

Surface attachment does not need GPGPU: the vertex shader places rests with the same `macroMorphology` + `developmentDisplace` as the body each frame.

## Fix (Windows only; Mac / mobile unchanged)

- Keep **GPGPU off** on heavy / Windows hosts.
- Use the **full surface vertex shader**; with GPGPU off, rest XYZ live in the geometry attribute (`USE_PARTICLE_ATTR_REST`).
- Particle tab uses the **full count slider**; Explore soft-caps (~60k) because Scatter + particles share a frame.
- Temporary `?baDiag=mount|cpu|geom|simple|gpu` modes and an on-screen build badge supported bisect when Console was unusable.

Detail for future recurrence: [docs/planning/Born-Another-Technic-Log.md](../planning/Born-Another-Technic-Log.md).


# Born Another — Playground

Playground progress (framework + **Experiment 01 — Language as Environment**, through Step 03B thermal memory + World B — Dark visual alignment) lives in a dedicated log:

→ [Born-Another_Playground.md](./Born-Another_Playground.md)

Organization plan: [Website-Organization.md](../planning/Website-Organization.md).
