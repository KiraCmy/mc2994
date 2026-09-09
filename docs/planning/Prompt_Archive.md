## REACT Test
![[Pasted image 20260909000702.png|206]]
Build an interactive generative geometry webpage using React and Three.js.

The main visual should be inspired by the reference image: a series of semi-transparent rectangular planes layered in 3D space, creating a volumetric geometric form through repetition, offset, scale, and transparency.

The geometry should be generated procedurally rather than modeled as a fixed object.

Users should be able to manipulate the geometry in real time through a minimal control panel at the bottom of the page.

Include these controls:

- **Layer Count** — a slider controlling how many rectangular planes are generated, for example from 3 to 40 layers.
- **Layer Spacing** — controls the distance between each plane.
- **Scale Progression** — controls how the size of the rectangles changes across the sequence.
- **Color Gradient** — allow the user to select a start color and an end color. Interpolate the colors smoothly across all layers.
- **Opacity** — controls the transparency of the planes.

The geometry should update immediately when the user changes any parameter.

Use React for the interface and Three.js, preferably through React Three Fiber, for the 3D visualization.

The 3D object should be centered on screen against a dark background. Use an orthographic or subtle perspective camera so the composition feels architectural and graphic rather than like a typical 3D game.

Allow the user to slowly rotate the object by dragging the mouse, but keep the default camera angle carefully composed.

Visually, aim for a minimal, experimental computational-design aesthetic. Avoid conventional dashboard styling. The controls should feel like a small design tool: thin sliders, restrained typography, subtle labels, and plenty of negative space.

The initial state should resemble the reference image: approximately 12–16 overlapping translucent rectangular planes, transitioning from a muted blue-gray on one side to a soft pink/red on the other.

Organize the code into reusable components, separating the geometry generation logic from the UI controls.