# Born Another — Playground

Progress log for the **Playground** mode (`#playground`): a place to prototype final-project ideas without changing World, Studies, or Memory Lab.

Related plan: [Website-Organization.md](../planning/Website-Organization.md)

---

## Why Playground exists

- Fast, isolated experiments next to Concept / Studies / System / World.
- Lazy-loaded so inactive experiments do not run WebGL or life loops.
- Registry-based: new experiments = one registry entry + one component — no repeated `App.jsx` architecture changes.

---

## Framework (done)

| Piece | Role |
|-------|------|
| `modes.js` + `SiteHeader` | Top nav tab **Playground** → `#playground` |
| `PlaygroundPage.jsx` | Shared chrome + experiment tablist; only the active experiment mounts |
| `experiments.js` | Registry (`id`, `label`, `title`, `description`) |
| `playground.css` | System-like light page; Studies-style experiment tabs |

**Isolation rules**

- Experiment state stays inside Playground — not in global Studies / World state.
- Leaving Playground unmounts the active experiment (Canvas + Life Engine rAF clean up).
- World / Memory Lab keep their own `WorldViewport` + `useLifeEngine` instances.

**Shared organism adapter (later reuse)**

`worldv2/WorldViewport.jsx` was extracted so Playground (and Memory Lab) can render the real World organism without duplicating World chrome or forking the Life Engine.

---

## Experiment 01 — Language as Environment

**Research question:** Can human language alter environmental conditions and indirectly shape the evolution of a procedural organism?

**Status:** Step 03B complete — thermal structural memory on Branch B; Playground UI/scene aligned with **World B — Dark**. Moisture / Disturbance still env-only.

---

### Step 01 — Scaffold

1. **Renamed** Experiment 01 to **Language as Environment** (id `01` kept).
2. **Scene** mounts the existing World organism via `WorldViewport` + a dedicated `useLifeEngine` (auto-plays; Color-Graded / `shader` presentation).
3. **Language** multiline input under the scene — stores full sentences.
4. **Controls** panel shows Temperature / Moisture / Disturbance at neutral **0.5**.
5. Env helpers in `playground/languageAsEnvironment/envState.js`.

**Not in Step 01:** speech, AI, language→env, env→growth, World/Memory Lab changes.

---

### Step 02 — Language → environment

Wire typed language into continuous environmental variables **without** touching the organism.

**First pass**

- Rule-based parser → impulses on Temperature / Moisture / Disturbance.
- Continuous simulation (velocity + damp + relax toward 0.5); submission history; last-parse feedback.
- Scene HUD: play/pause, restart, enter/exit; Born→Death AGE scrubber (organism AGE only — not driven by language).

**Refinement (accumulation / feedback)**

During testing, peaks stalled near ~0.56: small impulses (~0.16 into velocity) fought by strong damp (2.4/s) and continuous relax (0.22/s). Repeats *did* accumulate into velocity, but recovery erased gains; UI showed current values only.

Replaced with **accumulated influence → target → soft-follow**:

- `influence += impulse × Impulse Strength`, clamped by **Accumulation Limit**
- `target = 0.5 + influence`; values ease toward target; influence decays at **Recovery Rate**
- Frame-rate independent (`dt`); defaults aim for a visible band roughly **0.20–0.80** under repeated inputs
- Controls: Impulse Strength, Recovery Rate, Accumulation Limit; current / target / Δ; compact history sparkline

**Acceptance (Step 02 dynamics):** single “rain” raises Moisture; three “rain”s accumulate; idle recovers; “fire and rain” moves Temperature and Moisture; values stay in 0–1; organism remains independent.

---

### Step 02B — Semantic interpretation

Broader natural-language coverage and **intent gating** before any env→organism link. Still rule-based (no LLM / API).

**Prior parser (Step 02):** four concepts — rain→Moisture+, fire→Temp+, cold→Temp−, wind/storm→Disturbance+. Multi-concept per sentence yes; negation clause-local; **no** question/conversation intent (e.g. “Do you need water?” would still impulse Moisture). No Dryness / Stillness.

**Six semantic categories** (`semanticConcepts.js`)

| Category | Channel |
|----------|---------|
| Water / Wetness | Moisture + |
| Dryness | Moisture − |
| Heat | Temperature + |
| Cold | Temperature − |
| Turbulence | Disturbance + |
| Stillness | Disturbance − |

Synonyms / inflections / simple phrases; one sentence can hit multiple categories (e.g. “A cold, rainy storm is approaching”).

**Intent** (`classifyIntent.js`): Environmental Description · Environmental Request · Question to Organism · General Conversation · Uncertain.  
Only Description and Request apply impulses; prefer **no impulse** when uncertain.

**Developer feedback:** intent, concepts, impulse magnitudes, Applied / Ignored, short explanation.

**Acceptance (10/10):** raining heavily → M+; extremely dry → M−; cold storm → T− D+; warm and humid → T+ M+; calm and quiet → D−; “Do you need water?” / “Can you hear me?” / “I hope you survive.” → ignored; “There is no fire.” → no Heat+; cold rainy storm → all three channels.

**Known limitations:** lexicon/patterns only; shallow negation; no intensity scaling (“heavily”); English-only; modular so a later semantic model can replace the same parse shape.

---

### Step 03A — Temperature-driven membrane deformation

**Research question:** How does temperature alter procedural membrane deformation under identical seed / AGE / time?

#### A/B comparison

- **A — Baseline:** shared Life Engine; Temperature forced neutral (0.50); no spatial field.
- **B — Temperature Affected:** same seed, AGE, shared visual clock, camera/lighting/materials; Temperature from env (or scrub/presets).
- Shared Play / Pause / Restart / AGE scrubber; **Freeze AGE**; **Pause Time** (temporal freeze; spatial still updates with T).

Language → env pipeline preserved. Only Temperature affects geometry; Moisture / Disturbance accumulate but do not deform.

#### Coupling architecture (visual adapter only)

Life Engine stays temperature-agnostic. Display path:

1. **Temporal** — breath scale + soft pulsing ambient `localDeformations` (time-dependent).
2. **Spatial** — distributed rest-space FBM → per-vertex extra radial offset via `applyLifeToWorld` / `deformRadialPoint` (time-independent). Crystals use the same offset so they stay membrane-attached.

Optional WorldViewport hooks (`extraRadialOffset`, `influenceOverlay`, `resolveLifeForRender`, `sharedTimeRef`) default off → World / Memory Lab unchanged.

#### Refinement 01 — visible spatial form

First coupling mostly scaled **animation** (breath + time-pulsed ambient lobes). Paused silhouettes stayed nearly identical.

Added a **static spatial field** separate from temporal response, plus Temperature presets (0.30 / 0.50 / 0.70) and Pause Time.

#### Refinement 02 — distributed field

Lobe-based spatial Gaussians concentrated deformation in one region; raising strength only enlarged the same blobs.

Replaced with **seed-locked low-frequency FBM** on rest-space surface directions. Independent controls:

| Control | Effect |
|---------|--------|
| Spatial Coverage | Soft threshold on \|noise\| → active surface fraction |
| Spatial Variation | Noise frequency only |
| Displacement Strength | Radial offset magnitude only |

Developer toggle **Show Temperature Influence Field** — temporary cool/warm vertex tint on branch B (not a permanent material change).

**Acceptance:** T=0.50 → A/B match; T=0.70 / 0.30 with time+AGE frozen → clear distributed silhouette difference; Spatial OFF → identical; language still drives live Temperature when Preview is Live.

**Limits:** dual WebGL canvases (higher GPU cost); free-fly can desync panes if navigated independently; field is smooth/low-frequency (not fine wrinkles); no Moisture/Disturbance/lifespan coupling yet.

---

### Step 03B — Thermal exposure & structural memory

Environment recovery and organism recovery are no longer identical.

- Keep env Temperature recovery toward **0.50**.
- **Immediate response** (Step 03A temporal + spatial) remains reversible with current T.
- **Structural memory** accumulates `thermalExposure` from `|T − 0.50|` over advancing simulation time (threshold + rate + cap; **no auto-decay** when T normalizes).
- Persistent morphology: separate seed-xor rest-space FBM scaled by exposure magnitude; polarity from signed heat/cold bias.
- Final Branch B offset = immediate field + memory field (same `extraRadialOffset` path; crystals stay attached).

**Controls — Thermal Memory:** ON/OFF, Exposure Threshold, Accumulation Rate, Memory Deformation Strength, Current Thermal Exposure, Persistent Memory Magnitude, **Clear Structural Memory**.

**Time / reset semantics**

| Action | Effect |
|--------|--------|
| Pause Time | Stops exposure accumulation (and shared visual clock) |
| Freeze AGE | Holds AGE; sim time / exposure can continue |
| Restart | Resets life + environment + structural memory |
| Reset Environment | Clears env only; memory retained |
| Clear Structural Memory | Exposure → 0; AGE / seed / env unchanged |

**Acceptance:** brief heat → little memory; prolonged/repeated heat → divergent morphology after T recovers to 0.50; Clear Memory → A/B match again at neutral T; Pause Time → exposure frozen.

---

### Visual alignment — World B — Dark

Playground page and both organism viewports aligned with **World B — Dark** (not D — Shader).

- **3D:** `backgroundStudy = 'dark'` — black clear/background, same PMREM / lights / fog / AgX / bloom as World Dark; ShaderPass grade disabled.
- **UI:** `playground.css` dark tokens (`#010405` page, `#f3fbf8` type, muted cyan-gray lines/panels). Layout and Experiment 01 logic unchanged.
- World / Concept / Studies / Memory Lab untouched.

Remaining visual difference vs World: dual side-by-side canvases vs single fullscreen; Playground chrome (controls/language) has no World counterpart.

---

### Why this shape

- Reuse World appearance and autonomous AGE animation instead of a placeholder sphere.
- Keep language and environment as **explicit state** so later steps can wire `text → env → organism` without redesigning the UI.
- Separate **description of world** from **talking to the organism**; couple Temperature first, then retain exposure history as structural memory.
- Match World Dark so Playground reads as the same cinematic organism, not a light Studies sheet.

### Explicitly still out of scope

- Speech recognition / LLM interpretation  
- Moisture / Disturbance → geometry  
- Crystal growth rule changes / AGE / lifespan changes  
- Changes to World or Memory Lab default behavior  

### Key files

| File | Notes |
|------|--------|
| `src/playground/Experiment01.jsx` | A/B UI, coupling + thermal memory, `backgroundStudy: dark` |
| `src/playground/playground.css` | Dark theme aligned with World B |
| `src/playground/languageAsEnvironment/envState.js` | Neutral env state factory |
| `src/playground/languageAsEnvironment/environmentSimulation.js` | Influence / target / recovery dynamics + tuning |
| `src/playground/languageAsEnvironment/useEnvironmentSimulation.js` | rAF sim + submit / history / graph |
| `src/playground/languageAsEnvironment/semanticConcepts.js` | Six-category lexicon |
| `src/playground/languageAsEnvironment/classifyIntent.js` | Intent heuristics |
| `src/playground/languageAsEnvironment/parseEnvironmentalLanguage.js` | Parse pipeline (match → intent → gated impulses) |
| `src/playground/languageAsEnvironment/temperatureCoupling.js` | Temporal resolve + spatial sampler wiring |
| `src/playground/languageAsEnvironment/temperatureSpatialField.js` | Distributed FBM Coverage / Variation / Strength |
| `src/playground/languageAsEnvironment/thermalMemory.js` | Exposure accumulation + persistent memory field |
| `src/playground/languageAsEnvironment/EnvHistoryGraph.jsx` | Env value sparkline |
| `src/playground/experiments.js` | Title / description for Exp 01 |
| `src/worldv2/life/worldLifeAdapter.js` | Optional `extraRadialOffset` / influence overlay |
| `src/worldv2/WorldViewport.jsx` | Optional compare hooks (defaults preserve World) |

### Manual check

Open `#playground` → Experiment 01:

1. Page and organisms read as World B — Dark (black ground, bloom, translucent membrane).  
2. At T preview **0.50** with no memory, A and B match.  
3. Prolonged elevated T → exposure rises; after T recovers to 0.50, B still differs from A.  
4. Clear Structural Memory → forms match again.  
5. Pause Time while hot → exposure stops climbing.  
6. Moisture / Disturbance can move without changing geometry.

---

## Next (not started)

- Moisture / Disturbance → geometry (later steps).  
- Optional richer semantics (intensity, better negation, later model swap).  
- Optional single-canvas / shared GPU path if dual viewports become too heavy.

---

## Screenshots — Experiment 01

### Step 02B — Intent-gated language → environment

Environmental descriptions applied, conversation ignored; organism still independent of env.

![[born-another-playground-exp01-language-env.jpg]]

### Step 03A — Temperature spatial A/B compare

Synchronized Baseline (A) vs Temperature Affected (B) with distributed spatial coupling; live Temperature from language / scrub.

![[born-another-playground-exp01-temp-spatial.jpg]]

### Step 03B — Dark theme + thermal structural memory

World B — Dark visual language; Branch B shows accumulated thermal memory deformation after environmental recovery toward neutral.

![[born-another-playground-exp01-dark-memory.jpg]]

Full exposure (Thermal Exposure / Persistent Memory Magnitude at 1.0) under dark cinematic framing — Baseline vs Temperature Affected.

![[born-another-playground-exp01-dark-memory-02.jpg]]
