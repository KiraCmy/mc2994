# Voxel Basics — Volume, Density, CSG, Caves & Mesh Generation

A short Class 01 guide: voxels, density / SDF shapes, CSG, cave carving, and turning volumes into meshes (Marching Cubes → Dual Contouring).

---

## What is a voxel?

A **voxel** is a value on a 3D grid — the volume version of a pixel.

| 2D | 3D |
|---|---|
| pixel | voxel |
| image / heightmap | volume / chunk |
| color at `(x, z)` | solid or empty at `(x, y, z)` |

Games like Minecraft store an array of blocks. Procedural voxel worlds often do something smarter: they evaluate a **density function** at each point and decide solid vs air from the sign of that number.

**Mental model:** you do not place cubes by hand. You write a function `d(p)` for every point `p = (x, y, z)`. The grid samples that function.

---

## The one rule: density

```text
d(p) > 0   →  solid (matter)
d(p) < 0   →  empty (air)
d(p) = 0   →  surface
```

That function is the **density field** (sometimes treated like a signed distance / implicit surface). Everything in this tutorial is just different recipes for `d(p)`.

Once you have density, you can:

1. **Fill a grid** — sample `d` at each voxel center; store solid/air (or the float itself).
2. **Carve / dig** — editing becomes changing density (subtract a sphere, stamp a brush).
3. **Mesh later** (optional) — Marching Cubes / greedy meshing turns the field into triangles for rendering.

You can build interesting worlds with step 1 alone.

---

## Words you will see a lot

- **`p`:** Point in space `(x, y, z)`.
- **`h(x, z)`:** Height function from horizontal coords (2D noise / heightmap).
- **`fbm` / `fbm3d`:** Fractional Brownian Motion — layered noise that looks natural.
- **Heightfield:** Terrain defined only by height; no overhangs or caves from the height alone.
- **Volume / volumetric:** True 3D solid; overhangs, caves, blobs, planets.
- **Falloff:** Soft mask that fades density with height (or distance).
- **Chunk:** A block of the grid you generate and stream (e.g. 32³).
- **SDF:** Signed Distance Function — distance to a surface; **negative = inside** (common CSG convention).
- **CSG:** Constructive Solid Geometry — build complex solids by combining simpler ones (union, subtract, …).
- **`smin`:** Smooth minimum — soft blend used for organic joins.
- **Shell:** Hollow a solid into a thin wall of given thickness.
- **Evaluative:** Field can be computed at any `p` alone (no neighbors / history). Great for chunks and GPUs.
- **Worm:** Path-based digger that carves a tunnel along a polyline / spline.
- **3D CA:** Cellular automata on the voxel grid — rules over up to 26 neighbors.
- **Isosurface:** The surface where the field equals a threshold (usually `0`).
- **Mesh generation:** Turn a voxel / density field into triangles or quads for rendering.
- **Marching cubes:** Classic isosurface extractor — classify cube corners, place edge hits, emit triangles.
- **Hermite data:** Per edge: intersection position **and** surface normal (needed for Dual Contouring).
- **Manifold:** Mesh where every edge is shared by exactly two faces (clean closed surface).
- **Watertight:** Closed mesh with no holes (useful for printing / physics).

---

## Heightfield vs volume

**Ground plane** (heightfield):

```text
d = h(x, z) - y
```

- Solid where `y` is below the height surface.
- Fast and familiar (like a 2D noise map extruded up).
- Limitation: one height per `(x, z)` — no caves or floating rock from this term alone.

**3D density** (volume):

```text
d = fbm3d(p)
```

- Overhangs, holes, sponge-like mass.
- Costlier (evaluate noise in 3D), but diggable and truly volumetric.

Most “interesting” voxel terrain mixes both ideas.

---

## How to build a voxel volume (minimal pipeline)

### 1. Pick a grid

- Origin, spacing (e.g. 1 unit per voxel), and size (chunk `N×N×N`).
- World position of voxel `(i, j, k)`:

```text
p = origin + (i + 0.5, j + 0.5, k + 0.5) * voxelSize
```

### 2. Write a density function

Start with ground:

```js
function density(p, h) {
  // h(x, z) from your 2D noise / fBm
  return h(p.x, p.z) - p.y
}
```

### 3. Sample the grid

```js
for (let z = 0; z < N; z++)
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const p = toWorld(x, y, z)
      const d = density(p, heightFn)
      grid[x][y][z] = d > 0 ? 1 : 0   // or store d itself
    }
```

### 4. Render somehow

- Instanced cubes / greedy mesh for blocky look.
- Or keep the float field and extract an isosurface later.

### 5. Make it diggable

Store density (float), not only 0/1. Digging = subtract a brush:

```js
// example: carve a sphere of radius R at brush center c
d = d - max(0, R - length(p - c))
```

Positive stays solid; carving pushes values toward / below zero.

---

## Shape cookbook (Class 01 — Volume / Density)

Use these as drop-in `d(p)` terms. Combine with `min` / `max` / add if you want unions and layers.

| Shape | Density term | Gives |
|---|---|---|
| **Ground plane** | `h(x,z) - y` | Heightfield terrain |
| **3D fBm** | `fbm3d(p)` | Blobby, sponge-like mass |
| **Ridged 3D** | `1 - \|fbm3d(p)\|` | Sheets and walls |
| **Terraced** | Ground with `y` → `floor(y/k)*k + smoothPart` | Mesas, stepped cliffs |
| **Floating islands** | `fbm3d(p) - falloff(y)` (falloff small in a height band) | Sky islands |
| **Planet** | `radius + h(normalize(p)) - length(p)` | Spherical world, diggable |
| **Strata** | `ground + sin(y * k + fbm2d(x,z))` | Layered sedimentary bands |

### Quick intuition for each

**Ground plane** — classic terrain. `h` from 2D fBm / Perlin / Simplex.

**3D fBm** — raw volumetric noise. Threshold or reshape if the sponge is too airy.

**Ridged 3D** — absolute value folds noise into ridges; good for thin walls and sheets.

**Terraced** — quantize height (or the `y` you subtract) into steps of size `k`, then blend a smooth remainder so ledges are not pure staircases.

**Floating islands** — keep 3D noise only where `falloff(y)` is low (inside a vertical band); outside the band, density goes negative → empty sky.

**Planet** — shell around the origin: base sphere `radius - length(p)`, plus height from direction `normalize(p)`. Same idea as a ground heightfield, wrapped onto a sphere.

**Strata** — wiggle the ground density with a sine of height (phase-shifted by 2D noise) so you get rock layers.

---

## Tiny recipes you can type

Assume you already have `fbm2`, `fbm3`, and `length`.

```js
// Ground
d = fbm2(p.x * f, p.z * f) * amp - p.y

// Ridged volume
const n = fbm3(p.x * f, p.y * f, p.z * f)
d = 1 - Math.abs(n)

// Floating island band around y0 with thickness w
const falloff = Math.abs(p.y - y0) / w   // 0 at center of band
d = fbm3(p.x * f, p.y * f, p.z * f) - falloff

// Planet
const r = length(p)
const dir = { x: p.x / r, y: p.y / r, z: p.z / r }
const h = fbm2(dir.x * f, dir.z * f) * amp
d = radius + h - r

// Strata on ground
const ground = fbm2(p.x * f, p.z * f) * amp - p.y
d = ground + Math.sin(p.y * k + fbm2(p.x * f, p.z * f))
```

Tune `f` (frequency), `amp` (height scale), `k` (terrace / strata scale), `radius`, and band `w` until it reads as landscape, not noise soup.

---

## Practical tips

1. **Prototype in 2D first** — slice one `x–y` plane; visualize `d` as grayscale. Faster than full 3D.
2. **Store floats while authoring** — threshold only for display; digging and smooth blends need the continuous field.
3. **Domain scale matters** — if everything is cheese or flat, change frequency before changing the whole formula.
4. **Pick one sign convention and stick to it** — density (`>0` solid) flips min/max vs SDF (`<0` inside). See CSG below.
5. **Chunks** — generate only around the camera; same `d(p)` keeps seams consistent if `p` is in world space.

---

## CSG — Constructive Solid Geometry

Noise gives you terrain. **CSG** lets you *edit* volumes like a 3D boolean modeler: merge rocks, clip to a region, carve tunnels, hollow walls — by combining SDF fields with `min` / `max`.

The six Class 01 demos (block with sphere bites, blobby merges, heads/animals with red cut interiors) are all the same idea: one base field + sphere/cylinder brushes combined with the ops below.

### Convention for this section (SDF)

Class slides use:

```text
sdf(p) < 0   →  inside (solid)
sdf(p) > 0   →  outside (air)
sdf(p) = 0   →  surface
```

That is the **opposite sign** of the density rule earlier in this file. Same geometry, flipped sign:

```text
density ≈ -sdf
```

**Why it matters:** under SDF, **union is `min`**. Under density (`>0` solid), **union is `max`**. If a combine looks inverted, you mixed conventions.

Primitive examples (SDF, negative inside):

```js
function sdSphere(p, center, r) {
  return length(sub(p, center)) - r
}

function sdBox(p, center, half) {
  const q = abs3(sub(p, center))
  const d = sub(q, half)
  return length(max3(d, 0)) + Math.min(Math.max(d.x, d.y, d.z), 0)
}
```

### Operation cookbook (negative = inside)

| Operation | SDF formula | Use |
|---|---|---|
| **Union** | `min(a, b)` | Add rock / merge shapes |
| **Intersection** | `max(a, b)` | Clip to a region |
| **Subtraction** | `max(a, -b)` | Carve a tunnel or room |
| **Smooth union** | `smin(a, b, k)` | Organic joins, no hard crease |
| **Shell** | `abs(a) - thickness` | Hollow object / walls |

Read `a` and `b` as SDF values at the same point `p`.

### What each op does

**Union — `min(a, b)`**  
Keep the closer-to-inside value. Solids merge. Use to glue blobs, add boulders onto terrain-as-SDF, stack primitives.

**Intersection — `max(a, b)`**  
Only where *both* are inside. Use as a clip volume (keep cave only inside a box; cut a sculpture to a bounding region).

**Subtraction — `max(a, -b)`**  
Start with `a`, remove `b`. Negating `b` flips solid↔air for the brush, then `max` keeps what remains of `a`. This is digging: tunnels, rooms, sphere bites (red interiors in the slide).

**Smooth union — `smin(a, b, k)`**  
Like union, but blends near the join. `k` is blend radius — larger `k` = softer organic merge, no crease.

```js
function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}
```

**Shell — `abs(a) - thickness`**  
`abs(a)` makes a thin zero-band on the old surface; subtract `thickness` to fatten it into a wall. Solid becomes hollow (rooms, husks, crust).

### Tiny CSG recipes

```js
// Block with spherical bites (subtraction)
const a = sdBox(p, boxC, half)
const b = sdSphere(p, biteC, biteR)
const d = Math.max(a, -b)          // carve b out of a

// Merge two rocks (hard union)
const d = Math.min(sdSphere(p, c1, r1), sdSphere(p, c2, r2))

// Same merge, organic (smooth union)
const d = smin(sdSphere(p, c1, r1), sdSphere(p, c2, r2), 0.4)

// Keep only what sits inside a clip box
const d = Math.max(shapeSdf, sdBox(p, clipC, clipHalf))

// Hollow a solid into a wall of thickness t
const d = Math.abs(shapeSdf) - t
```

Wire any of these into the same grid loop: evaluate `d` (SDF) per voxel; solid where `d < 0`.

### Density-world equivalents (if you stay on `>0` = solid)

| Goal | Density combine |
|---|---|
| Union | `max(a, b)` |
| Intersection | `min(a, b)` |
| Subtract `b` from `a` | `min(a, -b)` |
| Shell | `thickness - abs(a)` (approx; same idea, flipped) |

Prefer learning the **slide table** (SDF) first — it matches most shader / Inigo Quilez references — then flip signs only if your codebase stores density.

### CSG + noise together

Typical voxel world stack:

1. Terrain / planet field (from the shape cookbook).
2. Convert or author it as an SDF (or stay consistent with density ops).
3. **Union** props (rocks, pylons).
4. **Subtract** gameplay spaces (tunnels, rooms).
5. Optional **shell** for thin walls or crust.
6. Optional **smin** where joins should look grown, not boolean-hard.

That is the bridge from “pretty density shapes” to “editable, diggable level geometry.”

---

## Four ways to carve underground space

The island-with-catacombs look (surface crust + deep shafts, rooms, glowing points) is usually **solid terrain minus caves**. CSG subtraction is the *combine*; these four methods decide *where* the empty space goes.

| Method | Look | Evaluative? | Cost | Control |
|---|---|---|---|---|
| **Threshold** | chambers | yes | one noise per voxel | density via threshold |
| **Intersection** | tunnels | yes | two noises per voxel | thickness via epsilon |
| **Worms** | tunnels with intent | no | per-worm; cross-chunk lookup | high: length, radius, direction |
| **3D CA** | organic pockets | no | per step × 26 neighbours | low (rule-driven) |

**Evaluative = yes** means: given only world position `p`, you can answer solid/air. Chunks stream independently and stay seamless.

**Evaluative = no** means: you need extra state (worm paths, CA iterations, neighbor chunks). More directed art direction; harder to parallelize cleanly.

Apply any of these as a **carve mask**, then subtract from ground / planet (SDF: `max(terrain, -cave)` or density: flip accordingly).

### 1. Threshold — chambers

One 3D noise. Air where noise is soft enough (or hard enough — pick a side and stick to it):

```js
const n = fbm3(p.x * f, p.y * f, p.z * f)   // roughly [-1, 1]
const isCave = n < threshold                 // e.g. -0.25
// carve: remove solid where isCave
```

- **Look:** blob rooms / Swiss-cheese chambers that connect by chance.
- **Knob:** raise/lower `threshold` → more or less empty volume.
- **Pros:** cheapest evaluative cave; one sample.
- **Cons:** little “hallway” intent; can feel random and disconnected.

### 2. Intersection — tunnel-like tubes

Two independent noises. Keep air only near *both* iso-surfaces (a thin band):

```js
const n1 = fbm3(p.x * f, p.y * f, p.z * f)
const n2 = fbm3(p.x * f + 100, p.y * f, p.z * f)  // offset seed/domain
const e = epsilon                                  // tube thickness
const isTunnel = Math.abs(n1) < e && Math.abs(n2) < e
```

Why it looks like tunnels: each `|n| < e` is a thick *sheet* through space; **intersection of two sheets** ≈ curve-like tubes.

- **Look:** wiry networks rather than big rooms.
- **Knob:** `epsilon` → thicker / thinner passages.
- **Pros:** still evaluative; good “cave spaghetti” without pathfinding.
- **Cons:** two noise evals; less control over where a passage goes.

### 3. Worms — tunnels with intent

Not a field. Spawn agents (or baked polylines) that walk through the world and **carve a capsule / sphere brush** along the path:

```js
// conceptual
for (const worm of wormsAffectingChunk(chunk)) {
  for (const seg of worm.segments) {
    carveCapsule(grid, seg.a, seg.b, worm.radius)  // CSG subtract
  }
}
```

Typical worm step: pick direction (noise-steered or toward a target), advance, optionally branch, stop after `length`.

- **Look:** readable routes — mines, subway, dungeon corridors.
- **Knobs:** length, radius, direction, branch chance, vertical bias.
- **Cost:** per worm, and **cross-chunk lookup** (a worm that starts in chunk A may dig into B).
- **Pros:** highest authorial control; gameplay-friendly.
- **Cons:** not evaluative; must store or regenerate worm seeds consistently across chunk borders.

### 4. 3D CA — organic pockets

Start from a seed (random air/solid, or a noisy threshold), then iterate rules on the **3×3×3 neighborhood** (up to **26** neighbors):

```text
example birth/survive style (tune to taste):
  count = number of solid neighbors (0..26)
  next = solid if count >= stayMin && count <= stayMax
         else air / solid per your cave rule
```

Run several steps, then freeze the grid (or use it only as a carve mask).

- **Look:** eroded, organic pockets and pillars — “grown,” not drawn.
- **Cost:** each step touches every voxel × ~26 neighbor reads.
- **Control:** **low** — you tweak rules and steps, not “put a room here.”
- **Cons:** not evaluative; chunk edges need halo / shared borders or the CA disagrees across seams.

### Choosing a method

| You want… | Prefer |
|---|---|
| Fast, seamless infinite caves | **Threshold** or **Intersection** |
| Big rooms | **Threshold** (and/or CSG rooms) |
| Natural slim networks | **Intersection** |
| Designed paths / gameplay routes | **Worms** |
| Weird organic erosion | **3D CA** (often as a post-pass) |

Many worlds **stack** them: threshold chambers + intersection filaments, or worms for main routes + threshold for side pockets; CA as a softener.

### Carve into terrain (one line)

SDF terrain `t`, cave mask as SDF `c` (negative inside the void you want):

```js
const world = Math.max(t, -c)   // subtract cave from solid
```

For evaluative methods, build `c` from the noise test (e.g. map `isCave` to a soft SDF, or hard-threshold after sampling). For worms/CA, stamp the carve into a grid, then mesh.

---

## Mesh generation — from volume to polygons

A density / SDF / binary grid is great for editing. GPUs and most engines draw **triangles** (or quads). **Mesh generation** extracts a surface from the field.

Pipeline reminder:

```text
field d(p)  →  sample on grid  →  classify inside/outside  →  place surface points  →  connect into faces
```

### Marching Cubes idea (2D first = Marching Squares)

The Class diagram: cyan blob on a lattice.

1. **Sample** the field at every grid vertex.
2. **Classify** each vertex — inside (red) or outside (blue) by sign / threshold.
3. Find **crossing edges** — one end inside, one outside. The surface must hit that edge.
4. Place an **edge point** (pink) — midpoint for a quick look, or **linear interpolate** using the two scalar values for a better fit.
5. Connect those points into segments (2D) or **triangles** (3D). That polyline / mesh approximates the cyan shape.

In 3D, each cell is a cube with 8 corners → `2^8 = 256` inside/outside patterns (looked up in a table). March cube-by-cube across the volume (“marching”).

```js
// edge hit between corners A and B (scalar values va, vb; iso = 0)
const t = (iso - va) / (vb - va)          // 0..1 along the edge
const hit = mix(posA, posB, t)
```

### Resolution vs facets

Finer grid → smoother mesh → **more faces** (and cost). Same peanut / dumbbell shape from the slide:

| Grid size | Facets (approx.) | Look |
|---|---|---|
| 10 | 70 | barely a shape |
| 5 | 220 | chunky |
| 2 | 1,700 | readable form |
| 1 | 6,800 | much smoother |
| 0.5 | 27,000 | dense / smooth |

**Grid size** here means cell spacing: smaller number = higher resolution. In games you often pick a chunk resolution (e.g. 32³) and live with the tradeoff, or use LODs.

### Mesh generation methods compared

| Method | Input | Look | Faces | Sharp features | Topology | Relative cost |
|---|---|---|---|---|---|---|
| **Culled faces** | binary | blocky | medium | yes (axis-aligned only) | watertight, often non-manifold | lowest |
| **Greedy** | binary | blocky | lowest | yes (axis-aligned only) | T-junctions | low–medium |
| **Marching cubes** | density | smooth, bevelled | highest (tris) | no | manifold if disambiguated | medium |
| **Marching tetrahedra** | density | smooth | very high | no | unambiguous | medium–high |
| **Surface nets** | density | smooth | low (quads) | no | mostly manifold | low–medium |
| **Dual contouring** | Hermite | smooth + sharp | low (quads) | **yes** | risk of non-manifold / self-intersection | **high** |

### What each method is for

**Culled faces** — Minecraft default: emit a quad only where solid meets air. Cheap, blocky, axis-aligned sharp edges only.

**Greedy meshing** — merge coplanar culled quads into larger rectangles. Same blocky look, **fewest faces**. Watch **T-junctions** (edge of a big quad meeting mid-edge of a neighbor) if you care about perfect seams / lighting.

**Marching cubes** — density / SDF in, smooth triangle mesh out. Great for organic terrain and CSG blobs. **Bevels** sharp corners (a cube’s edge becomes chamfered). Needs ambiguity handling for a clean manifold.

**Marching tetrahedra** — split cubes into tets, march those. Topology is clearer (fewer ambiguous cases) at the price of **even more faces**.

**Surface nets** — dual-ish approach: one vertex per occupied cell, connect into quads. Smooth look, **low face count**, mostly manifold. Still softens sharp features.

**Dual contouring** — input is **Hermite**: edge intersection **plus** surface normal. Solves for a vertex inside each cell that best fits the cutting planes → can keep **true sharp edges and corners** while staying relatively low-poly (quads). Cost is high; topology can go non-manifold or self-intersect on hard cases (thin sheets, complex junctions — the red-line diagrams on the Dual Contouring slide).

### Dual Contouring vs Marching Cubes (why both exist)

| | Marching Cubes | Dual Contouring |
|---|---|---|
| Input | density / SDF | Hermite (hits + normals) |
| Sharp cube / CSG edge | rounded / bevelled | can stay crisp |
| Face count | high (tris) | lower (quads) |
| Robustness | well-known; watch ambiguities | sharper, but topology risks |
| Typical use | terrain, organic SDF | buildings, hard-surface + smooth in one field |

The Dual Contouring diagrams (thin bridges, merged contacts, holes, red feature lines) are reminding you: **feature preservation and topology** fight each other. Narrow necks can split or glue wrong; junctions need careful QEF / vertex placement.

### Input types (pick before you mesh)

| Input | Means | Unlocks |
|---|---|---|
| **Binary** | solid / air only | Culled, Greedy |
| **Density / SDF** | continuous field | MC, MT, Surface nets |
| **Hermite** | edge hit + normal | Dual Contouring (sharp + smooth) |

If you only store `0/1`, you cannot get a smooth MC surface without inventing densities. If you want sharp CSG boxes *and* smooth blobs, plan for Hermite (or hybrid: blocky props + MC terrain).

### Practical tips for meshing

1. **Prototype culled faces** on binary voxels — fastest way to see your density / CSG / caves.
2. Move to **Marching Cubes** when you want smooth diggable terrain from the same float field.
3. Use **Greedy** if you stay blocky but need fewer draw calls.
4. Reach for **Dual Contouring** when sharp architecture must survive isosurfacing.
5. Match **chunk borders**: share a 1-cell halo of samples so seams do not crack.
6. Finer grid ≠ free — profile face count; consider LOD or dual methods for distance.

---

## What to try next

1. Implement **ground plane** on a small chunk; render as cubes.
2. Swap in **3D fBm**, then **ridged**.
3. Add a **dig** brush — sphere **subtraction** (`max(a, -b)` in SDF).
4. Attempt **planet** or **floating islands** once ground feels solid.
5. **Union** two spheres, then try **smin**; compare the crease.
6. **Shell** a box or sphere; look for a hollow interior.
7. Combine: noisy rock **union** + room **subtract** + optional shell walls.
8. Carve **threshold** chambers under a ground plane; tune the threshold.
9. Switch to **intersection** tunnels; tune `epsilon`.
10. Add one **worm** corridor you can walk; then a **3D CA** polish pass if you want organic edges.
11. Mesh with **culled faces**, then try **Marching Cubes** on the same float field — compare blocky vs smooth.
12. Halve the grid size once; note facet explosion vs smoothness.
13. Optional stretch: **Dual Contouring** on a box ∪ sphere and check whether the box edge stays sharp.

When those work, you understand the Class 01 voxel loop: **define a field → carve with CSG / caves → extract a mesh** at a resolution you can afford.
