# Voxel Tab for Noise Lab (Project 02) — Step-by-Step

This tutorial extends the existing `Project02` Noise Lab app with a new **Voxel** tab. It does **not** replace the 2D map, 3D heightfield, or simulation pages.

You will add, in order:

1. Voxel tab + basic voxel grid
2. 3D density field
3. Multiple density shapes
4. Sequential CSG operations
5. Marching Cubes meshing
6. Performance testing and chunking
7. Alternative meshing methods
8. Voxel optimization

Work from:

```powershell
cd E:\2026Fall_Cornell\DESIGN4197_PWB\mc2994\Project02
```

**Theory companion:** [`Voxel_Basic.md`](./Voxel_Basic.md) (density sign, CSG table, cave methods, meshing comparison). This SBS file is the *implementation* path through your repo.

---

## How this maps onto your current app

| Existing piece | Role today | Reuse for Voxel |
|---|---|---|
| `src/App.jsx` | Hash routes `#/2d`, `#/3d`, `#/sim`; owns `params` + `noiseMap` | Add `#/voxel` route, tab, and voxel-specific params |
| `src/pages/Grid3DPage.jsx` | Page shell: `ViewDisplayBar` + scene + `ControlPanel` | Copy this pattern for `VoxelPage.jsx` |
| `src/components/GridScene3D.jsx` | R3F `Canvas`, lights, `OrbitControls`, grid/axis aids | Copy canvas/lighting/controls into `VoxelScene.jsx`; replace `HeightField` with voxel renderers |
| `src/noise/generateNoiseMap.js` | 2D curl + shared `height[]` for 2D/3D | Keep for heightfield terrain; **add** 3D sampling helpers (do not break 2D curl) |
| `src/noise/noiseTypes.js` + `simplex2d.js` | 2D `sampleNoise(type, x, y, …)` | Extend with 3D fBm / simplex3 (new file preferred) |
| `src/components/ControlPanel.jsx` | Shared noise sliders; `mode` gates geometry | Add `mode="voxel"` section **or** a dedicated `VoxelControlPanel` |
| `src/components/ViewDisplayBar.jsx` | SOLID / WIREFRAME / BIOME toggles | Reuse for BLOCKY / DENSITY / MESH display modes |

**Important architectural choice (stick to it):**

- The current 3D tab is a **heightfield** (`d ≈ h(x,z) - y` visualized as a deformed plane).
- The Voxel tab is a **volume** (`d(x,y,z)` on a 3D grid → cubes or isosurface).
- Share **noise parameters** (`scale`, `octaves`, `noiseType`, `time`, …) where it helps, but keep **voxel grid / shape / CSG / meshing** state separate so `#/3d` stays unchanged.

**Sign convention for this tutorial (density):**

```text
d(p) > 0  →  solid
d(p) < 0  →  air
d(p) = 0  →  surface
```

If you later use SDF references from `Voxel_Basic.md`, remember `density ≈ -sdf` and flip `min`/`max` for CSG.

---

## Legend used in every stage

| Tag | Meaning |
|---|---|
| **Required** | Implement and keep; stage is incomplete without it |
| **Optional** | Exploration, docs, extra polish — skip without blocking the next stage |

Each stage ends with a **stop checkpoint**. Do not start the next stage until that checkpoint passes.

---

## Stage 0 — Confirm the existing app (no Voxel yet)

### Goal

Prove `#/2d`, `#/3d`, and `#/sim` still work before you touch routing.

### Core concept

Voxel work is additive. Regressions in the heightfield pipeline are unrelated to density fields.

### Files / components

None (read-only).

### Implementation steps

**Required**

1. Run `npm install` and `npm run dev`.
2. Open `#/2d`, `#/3d`, `#/sim`; change SCALE / RESOLUTION / DISPLACE.
3. Run `npm run build`.

**Optional**

- Skim `Grid3DPage.jsx` + `GridScene3D.jsx` so the page/scene split is familiar.

### How to test

Build succeeds; OrbitControls still orbit the heightfield on `#/3d`.

### Expected result

Baseline green light. No new files.

---

## Stage 1 — Voxel tab + basic voxel grid

### Goal

Add a fourth tab that shows a small solid/air cube grid (blocky), independent of the heightfield mesh.

### Core concept

A **voxel grid** is an `N×N×N` (or `Nx×Ny×Nz`) array. World position of cell `(i,j,k)`:

```text
p = origin + (i + 0.5, j + 0.5, k + 0.5) * voxelSize
```

For Stage 1 only, fill with a simple analytic solid (sphere or box). No noise yet — proves routing + R3F rendering.

### Files / components that need changes

| Action | Path |
|---|---|
| **Edit** | `src/App.jsx` — `getRoute()`, `ROUTE_LABEL`, page tabs, render branch |
| **Create** | `src/pages/VoxelPage.jsx` — mirror `Grid3DPage` layout |
| **Create** | `src/components/VoxelScene.jsx` — R3F canvas copied from `GridScene3D` patterns |
| **Create** | `src/voxel/VoxelGrid.js` — allocate grid, index helpers, sample fill |
| **Create** | `src/components/VoxelBlocks.jsx` (or inline in scene) — render solid cells |
| **Edit** | `src/App.css` — only if tab overflow needs a short label (like `VOX`) |
| **Optional later** | `ControlPanel.jsx` — skip voxel-specific sliders until Stage 2 |

Suggested folder layout:

```text
Project02/src/
├── pages/VoxelPage.jsx
├── components/VoxelScene.jsx
├── components/VoxelBlocks.jsx
└── voxel/
    ├── VoxelGrid.js          # createGrid, index3, fillFromDensity
    └── (later stages add more modules here)
```

### Implementation steps

**Required**

1. **Route** — In `getRoute()`, treat `voxel` like `3d` / `sim`. Extend `ROUTE_LABEL` with `voxel: 'VOXEL'`.
2. **Tab** — In the header `page-tabs`, add a link to `#/voxel` (full label `VOXEL`, short `VOX`).
3. **Page** — Create `VoxelPage` with the same shell as `Grid3DPage`: `ViewDisplayBar` (AXIS / GRID / RESET CAMERA), `viz-stage`, side panel placeholder.
4. **Scene** — Create `VoxelScene` with `Canvas`, ambient + directional lights, `OrbitControls`, optional `gridHelper` / axes (copy from `GridScene3D` / `ViewportAids`). Do **not** import `HeightField`.
5. **Grid module** — `createVoxelGrid({ size, voxelSize, origin })` returning `{ size, voxelSize, origin, values: Float32Array }` with `index(i,j,k) = i + j*size + k*size*size` (document your axis order and stick to it).
6. **Fill** — Hardcode a sphere: `d = r - length(p - center)`; store float `d` (not only 0/1) so later stages can mesh the same buffer.
7. **Render** — For each cell with `d > 0`, draw a cube (`mesh` + `boxGeometry`, or `InstancedMesh` if you already know it). Start with `size ≤ 16` so a nested loop is fine.
8. **Wire page → scene** — Pass `gridSize` / `voxelSize` as local React state on `VoxelPage` first (do not pollute global `DEFAULTS` until Stage 2).

**Optional**

- Use `InstancedMesh` immediately instead of one mesh per voxel.
- Wire `CaptureBridge` / PNG export like `Grid3DPage`.
- Add a home-page blurb mentioning Voxel.

### How to test

1. `#/voxel` loads; other tabs still work.
2. You see a blocky sphere (or box) you can orbit.
3. Toggle GRID / AXIS if implemented.
4. Change `size` from 8 → 16 in code; denser sphere, still interactive.

### Expected result

Fourth tab shows a static analytic volume as cubes. No shared noise yet. Heightfield `#/3d` unchanged.

**Stop checkpoint:** Blocky sphere visible; hash routing works.

---

## Stage 2 — 3D density field

### Goal

Drive the voxel grid from a **3D density function** that can reuse your noise *ideas* (scale, octaves, time), not only a hard-coded sphere.

### Core concept

Heightfield (current `#/3d`):

```text
d = h(x, z) - y
```

True volume:

```text
d = fbm3d(p)           // overhangs, blobs
// or mix:
d = h(x, z) - y + fbm3d(p) * amp
```

Your `sampleNoise` in `noiseTypes.js` is **2D only**. Add 3D sampling without breaking curl generation.

### Files / components that need changes

| Action | Path |
|---|---|
| **Create** | `src/noise/simplex3d.js` (or `fbm3d.js`) — 3D simplex / fBm |
| **Create** | `src/voxel/density.js` — `evaluateDensity(p, settings) → number` |
| **Edit** | `src/voxel/VoxelGrid.js` — `fillFromDensity(grid, evaluateFn)` |
| **Edit** | `src/pages/VoxelPage.jsx` — local or lifted voxel params |
| **Edit** | `src/App.jsx` — **Required only if** you lift voxel params into shared `params` / `DEFAULTS` |
| **Edit** | Controls — either `ControlPanel` `mode="voxel"` or `VoxelControlPanel.jsx` |
| **Edit** | `src/components/VoxelBlocks.jsx` — rebuild instances when density buffer changes |

Recommended voxel params (keep separate from `displace` / `waterLevel`):

```js
{
  voxelSize: 16,      // cells per axis
  voxelScale: 1.2,    // noise frequency in world space
  voxelThreshold: 0,  // iso level; solid if d > threshold
  // reuse where useful:
  // scale, octaves, time, noiseType (if you add 3D variants)
}
```

### Implementation steps

**Required**

1. **3D noise** — Implement `fbm3(x, y, z, octaves, lac, gain)` returning roughly `[-1, 1]`. Prefer a **new file** under `src/noise/` so `generateCurlNoiseMap` stays untouched.
2. **Density API** — In `density.js`, start with one mode, e.g. `ground`:

   ```js
   // h from existing 2D height idea OR fbm2(x,z)
   return h(p.x, p.z) - p.y
   ```

   Then add mode `volume`: `return fbm3(...) - thresholdBias`.
3. **Fill** — Loop all cells, write floats into `grid.values`. Threshold only at **render** time (`values[i] > voxelThreshold`).
4. **Controls** — Sliders: voxel resolution (clamp ≤ 24 for now), noise scale, threshold. Reuse SCALE / OCTAVES / EVOLVE from shared params **or** duplicate as voxel-prefixed keys — pick one and document it in a code comment.
5. **Rebuild** — When settings change, refill grid and update instances (same pattern as `HeightField`’s `useEffect` on `noiseMap`).

**Optional**

- 2D density slice debug canvas (grayscale of one `y` layer) — fastest way to tune frequency.
- Wire `shapeOp` / `shapeAmount` into 3D potential (parity with curl pipeline).
- Persist voxel params through `NoiseConfigPanel` / Firestore (only after Firebase save shape is clear).

### How to test

1. Mode `ground`: looks like terraced Minecraft hills; no floating blobs.
2. Mode `volume`: sponge / blob mass; changing SCALE changes feature size.
3. Raising threshold eats solid away; lowering grows it.
4. `#/3d` heightfield still matches `#/2d` (curl path untouched).

### Expected result

Same Voxel tab, but the solid region comes from a tunable density field. Still blocky cubes.

**Stop checkpoint:** Ground and volume modes both controllable; floats stored on the grid.

---

## Stage 3 — Multiple density shapes

### Goal

Swap density recipes from a shape cookbook without rewriting the grid filler.

### Core concept

`evaluateDensity` becomes a **dispatcher** over shape IDs. Shapes are formulas, not meshes. See cookbook in `Voxel_Basic.md` (ground, ridged, terraced, floating islands, planet, strata).

### Files / components that need changes

| Action | Path |
|---|---|
| **Edit** | `src/voxel/density.js` — shape table + per-shape params |
| **Create** | `src/voxel/shapes.js` — one function per shape (keeps `density.js` thin) |
| **Edit** | Voxel controls UI — shape selector (mirror `NOISE_TYPES` / `SHAPE_OPS` chip style in `ControlPanel`) |
| **Edit** | `VoxelPage` / `App` — `voxelShape` + shape-specific knobs (`bandY`, `planetRadius`, …) |

### Implementation steps

**Required**

1. Extract primitives:

   - `shapeGround(p, ctx)`
   - `shapeFbm3(p, ctx)`
   - `shapeRidged(p, ctx)` — `1 - abs(fbm3)`
   - `shapeFloatingIsland(p, ctx)` — fBm minus vertical falloff
   - `shapePlanet(p, ctx)` — `radius + h(dir) - length(p)`

2. Register them:

   ```js
   export const VOXEL_SHAPES = [
     { id: 'ground', label: 'GROUND', fn: shapeGround },
     // ...
   ]
   ```

3. UI: exclusive chips or `<select>` for shape; show only relevant sliders (planet radius, island band width).
4. Keep one shared fill path: `fillFromDensity(grid, (p) => shapeFn(p, ctx))`.

**Optional**

- Strata / terraced variants.
- Preview equation string in `EquationPanel`-style copy (documentation UX only).
- Color cubes by density magnitude or height band (visual only).

### How to test

For each required shape, switch the chip and confirm the silhouette matches the intent (hills vs sponge vs sky islands vs sphere world). Toggle SCALE/OCTAVES and confirm all shapes respond.

### Expected result

One grid pipeline, many looks. Still blocky; no CSG stack yet.

**Stop checkpoint:** At least **ground + fbm3 + ridged + floating island + planet** work from the UI.

---

## Stage 4 — Sequential CSG operations

### Goal

Build complex solids by combining density/SDF fields with an ordered list of boolean ops (like a tiny CSG stack).

### Core concept

Under **SDF** (`<0` inside): union `min`, intersection `max`, subtract `max(a,-b)`, smooth union `smin`.

Under **density** (`>0` solid): union `max`, intersection `min`, subtract `min(a,-b)`.

Pick **one** convention in code. Recommended for Noise Lab: evaluate shapes as **SDF internally** for CSG (matches `Voxel_Basic.md` / Inigo Quilez), then convert once for storage:

```text
densityStored = -sdf
```

**Sequential** means: start with base field `d0`, then for each op `i`: `d = combine(d, brush_i, op_i)`.

### Files / components that need changes

| Action | Path |
|---|---|
| **Create** | `src/voxel/csg.js` — `opUnion`, `opIntersect`, `opSubtract`, `smin`, `shell` |
| **Create** | `src/voxel/primitives.js` — `sdSphere`, `sdBox`, `sdCylinder` |
| **Create** | `src/voxel/csgStack.js` — apply ordered ops to a point `p` |
| **Edit** | `density.js` — final `d(p) = evaluateStack(baseShape, ops, p)` |
| **Edit** | UI — list of ops (add / remove / reorder); brush type + center/radius |
| **Optional** | Dig brush via pointer — Stage 8 territory; skip for now |

### Implementation steps

**Required**

1. Implement SDF primitives and hard ops; unit-test mentally with two spheres (union vs subtract).
2. Data model for the stack (example):

   ```js
   [
     { op: 'base', shape: 'ground' },
     { op: 'subtract', brush: 'sphere', center: [0, 0.2, 0], radius: 0.35 },
     { op: 'union', brush: 'box', center: [0.4, 0, 0], half: [0.15, 0.2, 0.15] },
   ]
   ```

3. Evaluate stack **inside** `evaluateDensity` so fill + later meshing share one function.
4. UI minimum: preset buttons — “Sphere bite”, “Two blob union”, “Shell box” — before a full generic editor.
5. Visualize with existing blocky renderer first (carved sphere bite should show a cavity).

**Optional**

- Full stack editor (reorder drag-and-drop).
- Smooth union `smin` with `k` slider.
- Cave recipes (threshold / intersection tunnels) as named subtract brushes — see `Voxel_Basic.md`.
- Document op list in markdown notes (exploration).

### How to test

1. Base box, subtract sphere → bite taken out (look inside by orbiting).
2. Two spheres union → merged peanut / blob.
3. Intersection with a clip box → shape truncated.
4. Reordering subtract vs union changes the result (proves sequential eval).

### Expected result

Editable boolean volume, still rendered as cubes. Density buffer remains floats.

**Stop checkpoint:** At least union + subtract work from presets; cavity is visible in blocky view.

---

## Stage 5 — Marching Cubes meshing

### Goal

Extract a smooth triangle mesh from the same float field (isosurface at threshold).

### Core concept

For each cube of 8 corner samples:

1. Build a bit mask from `d > iso`.
2. Look up edge crossings + triangles in the MC table.
3. Place vertices by **linear interpolation** along edges.
4. Emit `THREE.BufferGeometry` (positions + normals).

Blocky cubes and MC mesh are two **views** of one field — keep both behind `ViewDisplayBar` modes: `blocks` | `mesh`.

### Files / components that need changes

| Action | Path |
|---|---|
| **Create** | `src/voxel/marchingCubes.js` — tables + `meshFromScalarField(grid, iso)` |
| **Create** | `src/components/VoxelIsosurface.jsx` — R3F mesh from BufferGeometry |
| **Edit** | `VoxelScene.jsx` — switch renderer by display mode |
| **Edit** | `VoxelPage.jsx` — `ViewDisplayBar` modes `BLOCKS` / `MESH` (/ optional `WIRE`) |
| **Optional** | Vendor MC tables from a known reference; cite source in a file header comment |

### Implementation steps

**Required**

1. Implement MC on a **small** grid (16³) first; return `{ positions: Float32Array, indices?: Uint32Array }` or non-indexed triangle soup.
2. `computeVertexNormals()` or average face normals.
3. Mount with `meshStandardMaterial` (reuse lighting from `VoxelScene`).
4. When params change: dispose old geometry, build new (same dispose discipline as `GridScene3D`).
5. Keep block mode working for A/B comparison.

**Optional**

- Vertex colors from biome-like height bands (port idea from `GridScene3D` biomes — visual only).
- Export OBJ/GLTF via extending `export/exportTerrain.js` patterns.
- Ambiguity resolution / manifold cleanup (advanced; not required).

### How to test

1. Same sphere field: blocks look cubic; mesh looks rounded.
2. Subtract CSG bite: mesh shows a smooth cavity.
3. Halve `voxelSize` spacing or double resolution: smoother, heavier.
4. No NaN positions; OrbitControls still stable.

### Expected result

Smooth isosurface for organic / CSG shapes. Blocks remain available.

**Stop checkpoint:** MESH mode shows a coherent closed-looking surface for sphere and ground.

---

## Stage 6 — Performance testing and chunking

### Goal

Measure cost, then split the volume into **chunks** so you can raise resolution without one giant rebuild.

### Core concept

- Fill + mesh cost scale roughly with cell count (`N³`) and surface area.
- A **chunk** (e.g. 16³) owns a sub-grid; world-space `d(p)` keeps seams consistent if chunks share a **1-cell halo** of samples.
- Profile before optimizing: time `fillFromDensity` and `meshFromScalarField` separately.

### Files / components that need changes

| Action | Path |
|---|---|
| **Create** | `src/voxel/chunk.js` — chunk coords, world AABB, local grid |
| **Create** | `src/voxel/chunkManager.js` — set of chunks around origin / camera |
| **Edit** | Meshing + fill — operate per chunk |
| **Edit** | `VoxelScene.jsx` — render one mesh (or instanced blocks) per chunk |
| **Create** | `src/voxel/perf.js` (or inline) — `performance.now()` timings shown in UI |
| **Edit** | Controls — chunk size, view distance (chunks), max resolution |

### Implementation steps

**Required**

1. **Baseline** — On a single grid, log ms for fill vs mesh at N = 16, 24, 32. Show numbers in the page meta (`ViewDisplayBar` `end` slot, like `96×96 · BIOME` on 3D).
2. **Chunk struct** — `{ cx, cy, cz, size, values, geometry }`.
3. **Generate** a fixed 2×2×2 (or 3×3×1) chunk block around the origin using the **same** `evaluateDensity(p)` in world space.
4. **Halo** — When meshing chunk A, sample edges using neighbor values (or evaluate `d` on the boundary) so MC faces meet.
5. **Dirty flags** — Changing global noise params dirties all chunks; moving a CSG brush dirties only overlapping chunks (minimum: dirty all is OK for Required).

**Optional**

- Generate only chunks near camera; unload far ones.
- Worker / `requestIdleCallback` for fill (exploration).
- Spreadsheet or note of timings in `docs/` (documentation).

### How to test

1. Timings visible and increase with N.
2. Multi-chunk planet or ground has **no crack** along chunk borders in MESH mode.
3. Raising view distance adds chunks; FPS drop is understandable and measured.

### Expected result

Documented timings + a small chunked volume that looks seamless.

**Stop checkpoint:** At least 2×2 chunks mesh without a visible seam; fill/mesh ms displayed.

---

## Stage 7 — Alternative meshing methods

### Goal

Compare other extractors on the **same** scalar (or binary) field so you understand tradeoffs — not to ship every method.

### Core concept

From `Voxel_Basic.md`:

| Method | Input | Look | Notes |
|---|---|---|---|
| Culled faces | binary | blocky | what Stage 1 roughly did |
| Greedy meshing | binary | blocky, fewer quads | merge coplanar faces |
| Marching Cubes | density | smooth | Stage 5 |
| Surface Nets | density | smooth, fewer faces | dual-ish |
| Dual Contouring | Hermite | sharp + smooth | hardest |

### Files / components that need changes

| Action | Path |
|---|---|
| **Create** | `src/voxel/meshing/culledFaces.js` |
| **Create** | `src/voxel/meshing/greedy.js` (**Optional** if timeboxed) |
| **Keep** | `marchingCubes.js` |
| **Optional** | `surfaceNets.js`, `dualContouring.js` |
| **Edit** | `ViewDisplayBar` / mesher dropdown — `BLOCKS` / `GREEDY` / `MC` / … |
| **Edit** | Perf readout — face count + ms per method |

### Implementation steps

**Required**

1. Formalize **culled faces** as a mesher (quads only where solid meets air) — even if Stage 1 used instances, this teaches face emission.
2. Keep **Marching Cubes** as the smooth default.
3. UI to switch method without changing density settings.
4. Show **triangle/quad count** next to timings.

**Optional**

- Greedy meshing (fewer draw calls, watch T-junctions).
- Surface Nets.
- Dual Contouring on a box∪sphere to see sharp edges (stretch goal; Hermite data required).
- Write a short comparison note under `docs/tutorials/Voxel/` (documentation).

### How to test

Same CSG scene:

1. Culled / greedy → blocky, sharp voxel edges.
2. MC → bevelled edges, smoother blob.
3. Face count: greedy ≤ culled ≪ MC (typical).
4. Switching methods does not refill density unless resolution changed.

### Expected result

At least **two** meshers (culled + MC) comparable side by side with metrics.

**Stop checkpoint:** Toggle methods on one field; counts/timings make the tradeoff obvious.

---

## Stage 8 — Voxel optimization

### Goal

Make the Voxel tab usable at higher resolution: less CPU per edit, less GPU per frame, safer memory use.

### Core concept

Optimize only what Stage 6 measured. Typical wins for this codebase:

1. **Instancing / merged geometry** for block view.
2. **Geometry reuse / pooling**; always `dispose()` on rebuild (follow `GridScene3D`).
3. **Dirty chunk** updates instead of full-world refill.
4. **Debounce** slider-driven rebuilds (`requestAnimationFrame` or 50–100 ms timeout) — similar spirit to not rebinding the sim loop every tick in `App.jsx`.
5. **LOD / dual resolution** — coarse distance chunks (**Optional**).
6. **Skip empty chunks** — if all values `< iso`, emit no mesh.

### Files / components that need changes

| Action | Path |
|---|---|
| **Edit** | `chunkManager.js` — dirty rects, empty-chunk skip |
| **Edit** | `VoxelBlocks.jsx` — prefer single `InstancedMesh` per chunk |
| **Edit** | Page controls — debounce rebuild |
| **Edit** | `marchingCubes.js` / meshers — avoid allocating giant temp arrays every call if possible |
| **Optional** | Web Worker for fill+mesh |
| **Optional** | WASM mesher (out of scope unless you already want it) |

### Implementation steps

**Required**

1. From Stage 6 numbers, pick the worse of fill vs mesh; optimize that first.
2. Instanced block rendering if still using one mesh per voxel.
3. Debounced regen on slider drag; immediate regen on shape/op preset click.
4. Skip meshing empty chunks; show chunk count / drawn chunk count in UI.
5. Confirm `#/2d` / `#/3d` / `#/sim` performance unchanged (no accidental shared work on every frame).

**Optional**

- Worker thread.
- LOD.
- Persistent cache of chunk meshes keyed by param hash.
- Firebase save of voxel stack (product feature, not meshing).

### How to test

1. N = 32 (or your prior pain point) stays interactive while dragging SCALE.
2. Editing one CSG brush rebuilds only affected chunks (if implemented); otherwise debounced full rebuild still feels OK.
3. Memory: toggle MESH/BLOCKS repeatedly — no unbounded leak (Chrome task manager roughly stable).
4. Regression: heightfield and sim pages behave as in Stage 0.

### Expected result

Voxel tab is the “lab” for volumes: shapes → CSG → meshers → chunks, at a resolution you can demo live.

**Stop checkpoint:** Measured improvement vs Stage 6 baseline; app-wide routes still healthy.

---

## Suggested implementation order (checklist)

Use this as a progress board. Only check a box after that stage’s **stop checkpoint**.

- [ ] Stage 0 — Baseline build / tabs OK
- [ ] Stage 1 — `#/voxel` + blocky analytic grid
- [ ] Stage 2 — 3D density fill + controls
- [ ] Stage 3 — Multiple shapes via dispatcher
- [ ] Stage 4 — Sequential CSG (union + subtract minimum)
- [ ] Stage 5 — Marching Cubes + BLOCKS/MESH toggle
- [ ] Stage 6 — Timings + seamless chunks
- [ ] Stage 7 — Culled faces vs MC comparison
- [ ] Stage 8 — Instancing, debounce, dirty/empty-chunk skips

---

## What not to do (keeps the lab stable)

1. **Do not** replace `HeightField` in `GridScene3D` with voxels — keep `#/3d` as the heightfield instrument.
2. **Do not** feed `_noiseMap` typed arrays into Firestore configs (same rule as the Firebase tutorial); save voxel *settings* and CSG stack JSON only.
3. **Do not** start Dual Contouring or workers before Stage 5–6 checkpoints — they obscure whether density/CSG are correct.
4. **Do not** mix SDF and density combine formulas in one function without an explicit conversion.

---

## Quick reference — proposed modules

```text
src/
├── App.jsx                          # route + tab only (voxel params optional)
├── pages/VoxelPage.jsx              # page shell (like Grid3DPage)
├── components/
│   ├── VoxelScene.jsx               # R3F canvas (like GridScene3D)
│   ├── VoxelBlocks.jsx              # block / instanced view
│   └── VoxelIsosurface.jsx          # MC (or other) mesh view
├── noise/
│   ├── generateNoiseMap.js          # leave curl/heightfield alone
│   └── simplex3d.js                 # NEW 3D noise
└── voxel/
    ├── VoxelGrid.js
    ├── density.js
    ├── shapes.js
    ├── primitives.js
    ├── csg.js
    ├── csgStack.js
    ├── chunk.js
    ├── chunkManager.js
    ├── perf.js
    ├── marchingCubes.js
    └── meshing/
        ├── culledFaces.js
        └── greedy.js                # optional
```

---

## After the tutorial

When Stages 1–5 work, you understand the Class loop: **define a field → carve with CSG → extract a mesh**. Stages 6–8 make it demoable. For formulas and cave variants, keep using [`Voxel_Basic.md`](./Voxel_Basic.md).
