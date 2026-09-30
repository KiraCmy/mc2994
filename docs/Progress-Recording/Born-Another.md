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

Study 09 splits the specimen into two nested meshes that still share one seed and age: a soft translucent outer membrane and a denser inner core. The first pass read as a small opaque ball inside a glass bubble. The refine closes that gap—inner scale near 0.76, stronger low-frequency displacement on the core, lower core opacity, and a noise-driven cyan → soft blue → violet → pink → warm yellow field—so the colors sit *inside* the entity rather than on a separate sphere. Outer motion stays slow and soft; the inner body moves with a related but offset field. No particles, textures, or hard refraction.

The lower-left list now includes Study 09. Layered parameters use the same floating overlay: Both / Outer / Inner visibility, plus age, outer opacity, inner scale, and inner contrast. Camera, pale background, and the Birth–Death marker stay unchanged.

Both layers at mid-life (age 0.45, inner scale 0.76): one soft translucent organism with irregular colorful interior visible through the membrane.

![[born-another-study-09-layered.jpg]]
