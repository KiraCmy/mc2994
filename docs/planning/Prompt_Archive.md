# Prompt Archive

Working archive of development prompts. Grouped by project. Use a short title and a one-line subtitle for each entry so prompts stay easy to find later.

---

## Noise Lab

Project 02 — generative geometry / terrain studies (React + Three.js).

### Layered Rectangles — Generative Geometry Webpage

**Subtitle:** Procedural translucent planes with live layer, spacing, scale, and color controls.

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

---

## Born Another

Project 03 — procedural digital life (React, Three.js / R3F, Life Engine, World).

### Step 01 — Environmental System Code Audit

**Subtitle:** Read-only World audit of Moisture, Turbulence, and Life Engine environmental response before adding new behaviors.

I am continuing development of BORN ANOTHER, a procedural digital life project built with React, Three.js / React Three Fiber, and shaders.

Before implementing any new environmental behaviors, I want to understand how the existing World system currently handles **Moisture**, **Turbulence**, and their effects on the organism.

**This is a READ-ONLY CODE AUDIT. Do not modify any code.**

## 1. Scope

Focus exclusively on the existing **World** implementation.

Do not modify or refactor:
- World components or shaders
- Life Engine
- Environmental controls
- Other tabs or experimental studies
- UI, rendering, or postprocessing
- Any existing functionality

Do not create new files, install dependencies, run builds, or introduce diagnostic instrumentation.

Inspect the current implementation as it exists.

## 2. Trace Environmental Parameters

Locate the actual implementations of:

- Moisture
- Turbulence
- Temperature, only where relevant to their interactions
- Environmental state management
- Life Engine and AGE progression
- Membrane deformation
- Crystal growth, branching, and decay

For Moisture and Turbulence, trace the complete data flow:

UI control → State storage → Update logic → CPU / GPU processing → Organism response

Identify:

1. Where each parameter is defined and initialized.
2. Its valid range and default value.
3. How and when it is updated.
4. Which functions, components, shaders, or uniforms consume it.
5. Whether it affects CPU-side geometry, GPU-side vertex deformation, shader appearance, or persistent simulation state.
6. Whether the value is applied directly or transformed through another function.
7. Whether any environmental controls are disconnected, unused, or overridden.

Include exact file paths, function names, and line references where possible.

## 3. Moisture — Actual Biological and Structural Effects

Determine whether Moisture currently affects:

- Membrane shape or deformation amplitude
- Membrane expansion or contraction
- Crystal nucleation
- Crystal growth rate
- Crystal growth direction
- Crystal branching
- Crystal dissolution or decay
- Life progression or internal organism state

For every effect, explain the actual mathematical or procedural relationship.

Distinguish clearly between:

A. Visual-only effects  
B. Temporary geometric effects  
C. Persistent structural changes  
D. Persistent life-state changes

Do not assume that Moisture affects a process simply because the parameter is passed into a component.

Verify that it is actually used in the computation.

## 4. Turbulence — Actual Meaning and Effects

Determine what Turbulence represents in the current implementation.

Is it:

- A noise frequency modifier?
- A noise amplitude modifier?
- A spatial distortion field?
- A time-dependent deformation?
- A simulated environmental force?
- A shader-only visual effect?
- Something else?

Identify the exact noise functions, equations, or procedural mechanisms involved.

Explain whether Turbulence currently affects:

- Membrane deformation
- Surface displacement
- Crystal placement
- Crystal growth direction
- Crystal branching
- Crystal stability or decay
- Organism movement or dynamic behavior
- Persistent organism state

Also determine whether Turbulence represents a coherent environmental mechanism or is currently just an artistic deformation parameter.

## 5. Environmental Response and Life Engine

Investigate how environmental parameters interact with AGE and the existing Life Engine.

Specifically:

1. Does the organism respond differently to the same environment at different ages?
2. Can environmental changes alter future growth or decay?
3. Are environmental effects accumulated over time?
4. Does the organism retain any consequences after a parameter returns to its previous value?
5. Can two organisms with identical initial seeds but different environmental histories develop different structures?
6. Are crystal nucleation, growth, branching, and dissolution recalculated from current values or stored as evolving states?

Distinguish between:

- Reversible parameter-driven deformation
- Age-dependent procedural evaluation
- History-dependent structural evolution

Do not interpret deterministic AGE-based changes as environmental memory unless the code actually preserves environmental history or accumulated effects.

## 6. Determinism and Performance

Review whether the current environmental implementation is deterministic.

Check:

- Seeded randomness
- Time-dependent noise
- Frame-rate-dependent updates
- Fixed-step simulation
- State accumulation
- CPU/GPU consistency
- Shader time uniforms
- Whether replaying the same environmental input sequence produces the same result

Identify potential performance risks, particularly:

- Per-frame geometry regeneration
- Expensive CPU-side deformation
- Unnecessary GPU buffer uploads
- Repeated shader or material creation
- Environmental updates that trigger excessive React rerenders

Do not optimize anything yet.

## 7. Required Output

Provide a structured audit report with the following sections:

### A. Current Architecture
A concise explanation of how environmental parameters connect to World, the Life Engine, membrane, and crystal systems.

### B. Moisture Implementation
A table showing each actual effect, its code location, mechanism, and whether it is visual, temporary structural, or persistent.

### C. Turbulence Implementation
The same analysis for Turbulence, including its current procedural meaning.

### D. Environmental State and Memory
Explain whether environmental history influences future organism states.

### E. Determinism and Performance
Identify confirmed behavior and potential technical risks.

### F. Gaps and Disconnected Logic
Identify environmental controls that appear functional in the UI but do not affect the intended simulation mechanisms.

### G. Recommended First Experiment
Recommend ONE minimal experiment to validate the existing environmental response.

The experiment should:
- Reuse the existing World architecture
- Avoid major refactoring
- Be easy to observe and compare
- Preserve deterministic behavior
- Have minimal performance overhead

Do not implement the experiment yet.

## Important Constraints

- READ ONLY. No code modifications.
- Do not change any other tabs.
- Do not introduce a second organism.
- Do not implement AI or language interaction.
- Do not redesign the UI.
- Do not propose a new simulation architecture unless the existing implementation clearly requires it.
- Base every conclusion on actual inspected code.
- Explicitly label anything that cannot be verified from static code inspection.
- Distinguish intended behavior from confirmed implemented behavior.

The goal is to establish an accurate baseline before we decide what to develop next.
