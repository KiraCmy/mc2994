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

Top-level modes sit under the title: **Shader** (Studies 01–09), **Scatter**, **Path**, and **Particle**. Path and Particle are empty placeholders. Scatter is the first non-shader mode; it keeps the same viewport, camera, and pale field.

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

No growth, branching, or path-driven body deformation yet—only capture, follow, and display of surface splines.

Path in early development (age 0.05), Draw · On: a thick white surface spline follows the breathing membrane while Age, Draw, and Clear Path sit in the floating overlay.

![[born-another-spline-path-draw.jpg]]
