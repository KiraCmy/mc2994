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
