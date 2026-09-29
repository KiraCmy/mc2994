# Finite Digital Life — Shader Study

## Base environment

The test scene is a plain sphere on a cool gray field. A soft falloff in the background gives a little depth. There is no cast shadow and no side panel.

The labels float on the background in white. The title is larger than the age, seed, study name, and the line from birth to death. Type size follows the browser width.

![[finite-digital-life-base-setup.png]]

## Study 01 — Surface

The same sphere now has a milky surface. A vertical gradient mixes a muted pink with a muted cyan. A restrained Fresnel rim lightens the edge and shifts slightly between pink and cyan. The body stays translucent enough to feel like a membrane, and the silhouette still reads on the gray field.

![[finite-digital-life-study-01-surface.png]]

A thin parameter strip sits under the sphere: lower, upper, and rim colors, then Fresnel, strength, and opacity. This frame is Fresnel 1.00, strength 1.00, opacity 0.00, so the cyan reads stronger and the body stays more open.

![[finite-digital-life-study-01-surface-controls.jpg]]

## Study 01 — Parameter overlay

The bottom strip is gone. Parameters now sit on the right as a floating overlay. Closed, only `+ PARAMETERS` shows. Open, the same controls return—Fresnel, strength, opacity, plus lower, upper, and rim as small color circles—with `− PARAMETERS` to collapse. There is no panel, card, shadow, or divider line; spacing alone keeps the rows readable. Type scales with the stage so the layout holds across window sizes.

![[finite-digital-life-study-01-parameters.jpg]]

## Study 02 — Individuality

Study 01 stays clean: gradient and Fresnel only, no noise. Study 02 keeps the same sphere and surface base, then adds object-space procedural noise so soft cloudy regions sit on the form. A seed offsets the sample so each identity is stable and repeatable; noise scale, pattern contrast, accent color, and accent strength tune how strongly the markings read. The pattern rides with the surface when the sphere is rotated. Geometry does not change.

Both studies sit in the lower left. The active label is bright; the other is dim. Age and seed stay in the upper right. Opening parameters on Study 02 shows individuality controls in the same floating overlay as Study 01.

![[finite-digital-life-study-02-individuality.jpg]]

## Study 03 — Development

Study 03 keeps the Study 02 identity on the same sphere, then adds time and age. Soft noise motion runs through the markings. Vertices shift slightly along their normals, stronger in mid-life and quieter near birth and late age. Age also stretches the pattern scale and tips the color balance, so scrubbing age reads as development rather than a flat loop.

The lower-left list now includes Study 03. Development parameters use the same floating overlay: age, speed, pulse, and displacement. Identity Noise was added as a separate control so Study 02’s markings can be pushed harder—extra detail and stronger accent—while motion and breath stay visible.

![[finite-digital-life-study-03-development.jpg]]
