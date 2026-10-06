# Born Another — Design & Technical Logic

This file records **important design and technical decisions** that shape the project: why a approach was chosen, what it controls, and what must stay consistent for the system to hold together.

It is **not** a progress log. Day-to-day steps, screenshots, and incremental tuning belong in [docs/Progress-Recording/Born-Another.md](../Progress-Recording/Born-Another.md). Concept and intent live in [docs/concept/born-another-concept.md](../concept/born-another-concept.md).

When unsure whether something belongs here, ask: *Would losing this explanation make it hard to keep future work coherent?* If yes, it belongs. If it only documents that a pass happened or how a slider was nudged, it does not.

---

## How to use this file

**Write here**

- Decisions that define the system (life clock, identity, form vs surface, attachment, preservation)
- The *reason* a technical split exists (e.g. macro vs micro displace)
- What drives a behavior (`uAge`, `uSeed`, shared fields) and what must not drive it
- Constraints that later features must respect
- Rejected directions that matter because they protect the concept (e.g. nested layered meshes)

**Do not write here**

- Chronological study-by-study progress or every parameter tweak
- Screenshots and visual checklists (progress recording)
- Full concept essays (concept doc)
- Temporary experiments that did not change the architecture
- Implementation walkthroughs better suited to tutorials

---

## Core separation: conditions vs form

**Decision.** The user chooses initial conditions; the system develops form over a finite life. The user does not sculpt the final shape.

**Why.** Matches the concept shift from “generate an object” to “observe a life.” Customization would mean designing the outcome; procedural life means designing the starting conditions.

**Implication.** UI and parameters should bias *identity and conditions* (seed, family, growth type) more than direct mesh editing. Age advances on its own when Animate runs; death is part of the design.

---

## Two clocks: `uAge` and `uTime`

**Decision.** Split life progress from surface motion.

| Uniform | Owns | Does not own |
|--------|------|----------------|
| **`uAge` (0 → 1)** | Life stage, envelopes, decay threshold, preserve/trace handoff, irreversibility | Frame-to-frame breathing flicker |
| **`uTime`** | Noise motion, pulse, breath sampling | Whether the entity is developing, decaying, or dead |

**Why.** Scrubbing age should read as development and mortality, not as scrubbing a looping animation. Stopping the life clock at death must not require freezing every shader clock if residue is already frozen by design.

**Implication.** Lifecycle modes advance `uAge` only while the life is playing. Death is irreversible until New Life. Near death (~0.95), identity can be preserved once for the trace.

---

## Identity locked by seed

**Decision.** `uSeed` (and related individuality params) lock *which* regions mark, fail, and bulge—so the same individual is repeatable across studies and modes.

**Why.** Lineage and preservation only make sense if a life has a stable identity. Randomness without a seed would break “this residue belonged to that life.”

**Implication.** Decay discard fields, identity noise, macro region centers/amplitudes, and trace residue should all derive from the same seed family unless a deliberate offset is documented (e.g. inner layer offset—if used).

---

## Form pipeline: macro morphology, then micro / breath

**Decision.** Low-frequency **macro morphology** runs first and owns the silhouette. Study 03–style **micro / breath** displacement runs second along the deformed normal and stays secondary.

**Why.** Noise-only displacement keeps a sphere silhouette with textured surface. The entity needs to *become a body*—large, seed-locked bulges and dents—so life stages change readable form, not only pattern. Different seeds must produce *structurally* different bodies (lobe count, dominance, calm zones), not only tall / wide / compressed versions of the same sphere.

**What controls macro**

- **`uAge`** — overlapping stage envelopes (develop → mature → collapse), not hard cuts
- **`uSeed`** — everything structural below; fixed for one life
- **Not `uTime`** — macro is life-cycle form, not frame animation

**Seed-locked structure (stable per life)**

| Piece | Role |
|--------|------|
| **X/Y/Z body scale** | Soft anisotropic proportions (volume-normalized); keep this |
| **Active region count** | 3–6 soft `macroRegion` zones on the unit sphere |
| **Per-region radius** | Seeded falloff width (tight local lobe ↔ broad hemisphere) |
| **Per-region amplitude** | Signed push / pull |
| **1–2 dominant regions** | Stronger push or pull so one or two lobes own the silhouette |
| **Calm zones** | Global mass fades where region coverage is low—some surface stays relatively quiet |

**Spatial model.** Soft regions + mild ultra-low-frequency mass—not surface grain. Micro displace amplitude stays weaker so macro remains the silhouette. Do not “fix” the body by raising Study 03 noise.

**Shared code.** GLSL in `surfaceShader.js` and JS in `path/surfaceDisplace.js` stay aligned so Scatter, Path, and the body sample the same deformation.

**Implication.** Any surface attachment or drawn path must follow **macro + micro**, not rest-sphere positions alone, or growths/paths will float while the body morphs. New silhouette work extends the region system; it does not add high-frequency displace.

---

## One aging pipeline; materials bias how failure looks

**Decision.** Studies 04–08 share one aging / decay path. Material family (Membrane / Crystalline / Hybrid) retunes *how* the body thins, fractures, and exits—not a separate life story per family.

**Why.** Family should feel like substance on the same individual, not three different organisms. Concept tension: same life, different mortality character.

**Implication.** Do not fork three decay clocks. Bias thresholds, edge softness, discard sharpness, and late warp from one seed-locked field.

---

## Layered body = material depth on one mesh

**Decision.** Reject nested outer/inner meshes for “layered.” Keep one mesh; fake interior glow, foil fracture, and edge grain on a single silhouette.

**Why.** Nested shells read as a ball in a bubble or pale haze; depth failed. One life, one outline.

**Implication.** Future “thickness” should stay in shading / secondary fields unless a new decision explicitly reopens multi-mesh structure.

---

## Scatter: rest samples + shared displace field

**Decision.** Sample positions live on the **unit sphere (rest frame)**. Each frame, attachment shaders reuse the same displace field as the host (macro + Study 03 amount) so growths ride the living body.

**Why.** GPU-deformed host vertices are not cheap to read back. Duplicating the field in the instance shader keeps growths stuck without a second approximation.

**Coverage.** Samples are full-sphere (Fibonacci). Flat membranes edge-on to the camera only read as a silhouette ring—so face-on instances must present readable area (frame bias toward the view) and the soft body must not depth-bury the front disc (scatter composites over the host; host depthWrite off while growths are live). Far-hemisphere instances are dropped so they do not thicken a false halo.

**Material direction.** Scatter shading is **frosted glass / thin ice**: clear cool-white, luminous Fresnel edges, soft glow—separate from the body’s cyan/pink identity blotches. Growths may borrow rim tint lightly; they do not reuse identity noise.

**Asset direction.** Growths are localized differentiation of the organism (membrane lobes, plume, pod)—not decorative buds/flowers on stalks. Rejected recognizable botanical or viral spike silhouettes. Growth Type swaps the asset only.

**Implication.** Sampling, Density / Size / Regenerate, and the shared displace field stay across types. Lifecycle and decay of growths follow the host clock and discard field. Do not “fix” attachment by baking deformed world positions into instance matrices.

---

## Path: rest-space strokes, deformed display

**Decision.** Drawn paths store ordered **rest-space** samples from unit-sphere raycast. Display deforms those samples each frame through the shared AGE/time displace field and lifts slightly along the deformed normal.

**Path as growth influence.** Closed strokes also drive a soft **growth field** on the body: vertices near the path swell outward along the deformed surface normal. Influence is strongest on the path and falls off with chord distance (`Growth Strength`, `Growth Radius`). Those sliders are **final maxima**: after a stroke closes, influence expands from the path outward over a few seconds (wall-clock), rather than appearing at full strength immediately. AGE macro + micro stay underneath; the path does not replace life-cycle form.

**Organism continues the path.** When a stroke closes, the tip travel direction on the unit sphere seeds a planned surface walk (rest-space only, with light wander). The user `restPoints` stay frozen; a separate `extensionPlan` reveals over time as a growing ribbon. Revealed extension samples join the same growth field so deformation follows the tip. No branching yet.

**Why.** Same rest frame as Scatter. Paths remain editable/reusable data for later growth or deformation, while staying visually glued to the living body. Influence should read as the organism *responding* to the drawn trail over time—and then *continuing* that trail on its own surface—not as a tube sitting on top, and not as an instant morph.

**Implication.** Do not store screen-space ink as the source of truth. GLSL body shaders and JS `deformRestPoint` share the packed rest-point field plus per-stroke growth maturity and revealed extension samples. Branching / secondary objects are later work.

---

## Preserve a moment vs live residue

**Decision.** Near death, freeze identity for the **trace** so residue is a memory of that life, not a still-breathing specimen. Preserved moments (user choice) are conceptual siblings: a record of age, not a new design.

**Why.** Death without memory collapses the concept. Trace must stop developing with `uTime` as a living body would.

**Implication.** Trace materials use preserved age/seed. Reviving requires explicit New Life, not scrubbing age backward after death.

---

## Open / unresolved (record when decided)

- What initial conditions the user may choose beyond seed / family / growth type
- What information survives as trace and what later generations inherit
- How much mutation vs fidelity in lineage
- Whether Path strokes drive body morphology beyond the soft growth field, or only secondary growth
- Particle mode’s role relative to membrane / spoil / residue

---

## Decision log

Add new entries below as decisions solidify. Prefer short titled sections like those above: **Decision → Why → What controls it → Implication**.

### 2026-10-06 — Macro structural diversity between seeds

**Decision.** Extend seeded `macroRegion` so silhouettes differ by structure: 3–6 active regions, per-region radii, 1–2 dominant push/pull lobes, and calm surface where coverage is low. Keep seed-locked X/Y/Z proportions.

**Why.** Proportion-only variation still reads as the same sphere stretched. Lineage needs individuals that are recognizably different bodies, not only different aspect ratios.

**Controls / constraints.** All structural values from `uSeed`, stable for one life. `uAge` still opens/closes envelopes. Do not raise surface noise to fake form. GLSL and JS displace stay mirrored.

**Implication.** Future form work extends this region model; Scatter/Path keep sampling the shared field.

### 2026-10-06 — Scatter reads as full-surface growth, glass membrane

**Decision.** Treat ring-only silhouettes as a visibility/attachment bug, not as the intended look. Growths cover the front disc; shading is frosted-glass ice with edge glow, distinct from body identity color.

**Why.** Concept is differentiation *on* the organism. A fringe-only halo reads as decoration around a soft blob.

**Controls / constraints.** Rest-frame samples + shared macro/micro field. Face-on readability and host/scatter depth compositing are part of the contract. Material may tune opacity/glow; it must not reintroduce body identity blotches onto growths.

**Implication.** New growth assets stay swappable; attachment and glass shading rules persist across Membrane / Plume / Pod.
