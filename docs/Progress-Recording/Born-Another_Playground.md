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

**Status:** Language → Life Engine sync complete — Temperature, Moisture, and Disturbance→Turbulence drive the organism in Playground; World UI transfer still deferred.

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

### Step 04 — Environmental system audit → Moisture & Turbulence lab

Read-only World audit first (see [Prompt_Archive.md](../planning/Prompt_Archive.md); summary in [work_analysis.md](../analysis/work_analysis.md)), then lab implementations with World UI left clean for later transfer.

**Moisture → crystal growth / branching (Life Engine)**

- `environment.moisture` + piecewise `environmentHistory`.
- `moistureGrowthMultiplier` — neutral at **0.50**; dry / wet scale future growth.
- Branching gates: count delta, maturity, mineral from moisture.
- `setLifeMoisture` — record at current step (future growth only).
- `applyLifeMoistureFromBirth` — lab scrub rebuilds crystals from birth at constant moisture up to current AGE (0.2 / 0.5 / 0.8 comparable).
- Playground: Crystal Moisture presets / slider (not shown in World).

**Turbulence → reversible membrane field**

- `turbulenceField.js` — deterministic value-noise + traveling wrap; radial offset from `life.environment.turbulence` and `life.time`.
- `setLifeTurbulence` — immediate reversible field; history for AGE scrub.
- Composed in `worldLifeAdapter` / crystal anchors (crystals stay attached).
- Default calm = **0.00**. Lab-only Membrane Turbulence in Experiment 01; peak displacement raised (~0.11 → ~0.36) so mid/high values read on the form.

---

### Step 05 — Language environment → Life Engine sync

**Problem:** “rain” / “wind” moved Playground Moisture / Disturbance, but Compare **M / Turb** stayed at Life defaults; only Temperature reached the organism.

**Data flow**

```
Language → parseEnvironmentalLanguage → useEnvironmentSimulation
  → environment.moisture / .disturbance (soft-follow)
  → Experiment01 sync (quantized)
      moisture → setMoistureAtStep → setLifeMoisture → environmentHistory
      disturbance → disturbanceToTurbulence → setTurbulence → setLifeTurbulence
  → organism (growth / membrane waves)
```

**Mapping:** Disturbance **0.50 → Turbulence 0**, **1.0 → 1.0** (`disturbanceToTurbulence`).

**Manual controls:** Live sync by default; Crystal Moisture / Membrane Turbulence sliders override until language reclaims the channel or Live is pressed. Compare **M / Turb** always read `life.environment`.

**Compare:** **A — Baseline** neutral T/M/Turb at same AGE; **B — Environment Affected** live Temperature + Moisture + Turbulence + thermal memory. No extra canvases.

---

### Step 06 — Layout lock + frame stutter fix

**Layout:** Desktop Experiment One uses a locked flex split — organism viewport + language stay on screen; Controls scroll independently. Mobile: sticky scene while parameters scroll.

**Stutter:** Env sim had called `setSim` every rAF, reconciling WebGL trees every frame. Now: step in a ref; React publish only when values change (~10 Hz, `startTransition`); membrane Temperature reads the live env ref in the R3F / thermal path; Playground skips redundant `useLayoutEffect` mesh apply when `useFrame` already refreshes display life.

---

### Why this shape

- Reuse World appearance and autonomous AGE animation instead of a placeholder sphere.
- Keep language and environment as **explicit state** so `text → env → Life Engine → organism` can be validated in Playground before World transfer.
- Separate **description of world** from **talking to the organism**; couple Temperature first, then Moisture / Turbulence, with thermal exposure as structural memory.
- Match World Dark so Playground reads as the same cinematic organism, not a light Studies sheet.

### Explicitly still out of scope

- Speech recognition / LLM interpretation  
- World UI Moisture / Turbulence controls (lab stays in Playground until transfer)  
- AGE / lifespan redesign  
- Changes to World or Memory Lab default behavior  

### Key files

| File | Notes |
|------|--------|
| `src/playground/Experiment01.jsx` | A/B UI, language→Life sync, coupling + thermal memory, `backgroundStudy: dark` |
| `src/playground/playground.css` | Dark theme + locked desktop layout (scene stays visible) |
| `src/playground/languageAsEnvironment/envState.js` | Neutral env + `disturbanceToTurbulence` / quantize helpers |
| `src/playground/languageAsEnvironment/environmentSimulation.js` | Influence / target / recovery dynamics + tuning |
| `src/playground/languageAsEnvironment/useEnvironmentSimulation.js` | rAF sim in ref; throttled React publish (~10 Hz) |
| `src/playground/languageAsEnvironment/semanticConcepts.js` | Six-category lexicon |
| `src/playground/languageAsEnvironment/classifyIntent.js` | Intent heuristics |
| `src/playground/languageAsEnvironment/parseEnvironmentalLanguage.js` | Parse pipeline (match → intent → gated impulses) |
| `src/playground/languageAsEnvironment/temperatureCoupling.js` | Temporal resolve + spatial sampler wiring |
| `src/playground/languageAsEnvironment/temperatureSpatialField.js` | Distributed FBM Coverage / Variation / Strength |
| `src/playground/languageAsEnvironment/thermalMemory.js` | Exposure accumulation + persistent memory field |
| `src/playground/languageAsEnvironment/EnvHistoryGraph.jsx` | Env value sparkline |
| `src/playground/experiments.js` | Title / description for Exp 01 |
| `src/worldv2/life/lifeEngine.js` | Moisture / Turbulence env history + growth / branch gates |
| `src/worldv2/life/useLifeEngine.js` | `setMoisture` / `setMoistureAtStep` / `setTurbulence` |
| `src/worldv2/turbulenceField.js` | Reversible membrane turbulence sampler |
| `src/worldv2/life/worldLifeAdapter.js` | Turbulence + optional `extraRadialOffset` / influence overlay |
| `src/worldv2/WorldViewport.jsx` | Optional compare hooks (defaults preserve World) |

### Manual check

Open `#playground` → Experiment 01:

1. Page and organisms read as World B — Dark (black ground, bloom, translucent membrane).  
2. At T preview **0.50** with no memory, A and B match.  
3. Prolonged elevated T → exposure rises; after T recovers to 0.50, B still differs from A.  
4. Clear Structural Memory → forms match again.  
5. Pause Time while hot → exposure stops climbing.  
6. **rain** / **wind** / **hot** update Life Engine M / Turb / Temperature; Compare B labels match organism values.  
7. Desktop: language / controls do not scroll the organism off-screen.  
8. Animation stays smooth when env is idle or soft-following.

---

## Next (not started)

- Transfer validated Moisture / Turbulence method into World UI.  
- Optional richer semantics (intensity, better negation, later model swap).  
- Optional single-canvas / shared GPU path if dual viewports become too heavy.  
- Experiment 03 Study 01 follow-ups: agent states (Growing / Dormant / Dying), neighbor perception, competition.  
- Studies 02–03 placeholders (Organism Agents, Environmental Signals).

---

## Experiment 03 — Agent Behaviors

**Research question:** Can crystal growth be observed and eventually controlled as local agent behavior on a stable membrane substrate, before whole-organism or environmental-signal agency?

**Status:** Study 01 — Crystal Growth Agent Lab (baseline) complete. Membrane frozen; Growth Time drives crystals only; fixed observation camera. Agent FSM / neighbor perception / competition not enabled. Studies 02–03 remain placeholders.

---

### Why Study 01 first

Earlier Playground work treated the organism as a full lifecycle viewer (AGE drives membrane morph, deformations, vitality, and crystals together). That makes it hard to isolate **crystal growth behavior**.

Study 01 establishes a **Baseline Growth Experiment**:

- Macro close-up of a locked local crystal cluster (~3–5 sites).
- Membrane geometry held at a fixed reference AGE.
- Only crystal growth evolves with the timeline.
- Camera and observation region stay stable.
- Environment constant; no Moisture / Temperature / Turbulence experiments here.
- No Agent FSM yet — observation lab before agency.

---

### Step 01 — Scaffold (macro framing)

1. Registry entry **Agent Behaviors** (`id: '03'`) with Study tabs: Crystal Agents (active), Organism Agents / Environmental Signals (placeholders).
2. Scene mounts shared `WorldViewport` + dedicated `useLifeEngine` (World Dark presentation).
3. One-shot **stable growth cluster** lock at observation AGE (`selectStableGrowthCluster` in `agentBehaviors/growthFocus.js`) — site IDs fixed for the session; no AGE-driven site switching.
4. Frontal membrane patch camera: locked yaw, limited zoom; organism silhouette mostly out of frame.
5. Optional WorldViewport hooks only (defaults preserve World): `followGrowthSiteIds`, `exteriorControlMode` (`macro` → later `observe`), `visibleGrowthSiteIds`.

**Not in Step 01:** agent states, competition, env coupling, Life Engine forks.

---

### Step 02 — Membrane / crystal time decoupling

**Problem:** Scrubbing AGE still deformed the membrane, so crystal growth could not be read in isolation. Roots also ride membrane morph + `localDeformations`, so a naive “freeze mesh” would detach crystals.

**Audit:** Life Engine keeps a single `age`. Membrane morph (`variables.growth` → `formMorphAmount`), stimulus deformations, and `spatialGrowthSites` crystal lengths all derive from that sample — but they only meet at the **render adapter**. Safe to composite at display time without duplicating or changing Life Engine logic.

**Smallest safe approach (implemented)**

1. Seek to membrane reference AGE **0.45** and `captureMembraneFreeze(life)` — snapshot form scale / vitality / integrity / `localDeformations` (+ display growth & decay used for membrane presence).
2. While Growth Time scrubs the live Life Engine sample, pass  
   `composeFrozenMembraneLife(growthLife, freeze)` into `WorldViewport`:
   - **Frozen:** membrane morph, deformations, body scale, presence (no breath).
   - **Live:** `spatialGrowthSites` crystal lengths / branches (existing growth rules).
3. Crystal roots still use `primaryCrystalAnchor` with the frozen morph + deformations → roots stay seated; no drift when Growth Time changes.
4. Environment left at Life defaults; stimulus no-op in Study 01. Camera mode **`observe`**: fixed framing, scroll / slider zoom only (no orbit, no tilt, no reframing on scrub).

**UI rename:** timeline **AGE → Growth Time**. Panel separates **Fixed conditions** (Membrane AGE 0.45, Environment Constant, Agent Behavior Not enabled, Camera Fixed) from **Evolving growth** (Growth Time, visible site counts, mean length). Selected-site checkboxes filter which locked clusters render; other sites hidden.

**Acceptance:** Growth Time scrub / Play → crystals lengthen or recede; membrane silhouette and camera framing hold; roots stay attached; World / Exp 01 / Exp 02 defaults unchanged.

**Still out of scope for Study 01:** Growing / Dormant / Dying FSM, neighbor perception, resource competition, Moisture/Temp/Turbulence labs, new crystal morphology.

---

### Why this shape

- Treat crystals as the first **agent-scale** observable before inventing new simulation rules.
- Freeze membrane at the display boundary so Life Engine replay / growth logic stays authoritative and shared with World.
- Lock cluster IDs + observe camera so the lab reads as a controlled microscope, not another full-organism lifecycle scrubber.
- Keep Studies 02–03 as named placeholders so the multi-scale agent roadmap stays visible.

### Key files

| File | Notes |
|------|--------|
| `src/playground/Experiment03.jsx` | Study tabs; Study 01 baseline lab UI (Growth Time, freeze readout, sites, zoom) |
| `src/playground/agentBehaviors/growthFocus.js` | Cluster lock, membrane freeze capture/compose, site listing |
| `src/playground/experiments.js` | Exp 03 title / description |
| `src/playground/playground.css` | Exp 03 chrome, fixed vs evolving panel, site list |
| `src/worldv2/WorldViewport.jsx` | Optional `exteriorControlMode: 'observe'`, `visibleGrowthSiteIds`, follow-site pivot (defaults = World) |

### Manual check

Open `#playground` → Experiment 03 → Study 01:

1. Viewport is a macro close-up of a few crystal clusters on a local membrane patch (full organism not readable).  
2. Panel shows Membrane (AGE) **Fixed (0.45)** once capture completes; Freeze Membrane control reads pressed.  
3. Scrub **Growth Time** or Play — crystals evolve; membrane shape does not morph with the scrubber.  
4. Crystal roots stay on the membrane (no floating / sliding off).  
5. Camera does not auto-orbit or jump sites; Zoom slider / scroll only change distance.  
6. Toggling Selected sites shows/hides those clusters; “Other sites (hidden)” stay off.  
7. World and Experiments 01 / 02 still behave as before (no membrane-freeze default).

---

## Experiment 05 — Final Form Lab

**Research question:** Can World morphology drive a Life-shaped body while Explore’s ethereal fragment look (body + petals + particles) stays intact, so a final form can be tuned in Playground without touching World / Life Engine / Studies?

**Status:** Phase C2 lab usable — shared surface evaluator, stable composition toggles, AGE scrub + Space play/pause, morphology Low / Medium / High presets (same AGE / Seed).

---

### Done

1. **Life → Explore path** — World `radiusAt` + form morph / growth sites shape the membrane; Explore fragment shading stays for body, petals, and particles. Original Explore remains a side-by-side visual reference.
2. **Shared surface evaluator** (`exp05SurfaceEvaluator`) — one Exp05-only evaluator seats body, petals, and particles on the same Explore-framed field (no Life Engine / World forks).
3. **Composition stability** — body / petals / particles stay mounted across AGE scrub and composition modes (`dispose={null}`, visibility + reseat). Fixed earlier white-out / vanish when AGE or layer toggles remounted shared GPU materials.
4. **Morphology calibration (audit → presets)** — World `formMorphAmount` saturates early (~AGE 0.45); empty `localDeformations` without stimuli made old “macro deform” knobs inert. Lab **Morphology Complexity** now scales rest-radius lobe amplitude on the existing `radiusAt` field (no new morph algorithm). Presets **Low / Medium / High** only change morph knobs; AGE, Seed, petals, and particles stay put.
5. **Lab chrome** — petal / particle density & scale, composition modes (Body Only → Full), AGE bar, Space play/pause.

**Out of scope (held):** Life Engine / World / Studies / Exp 01–04 edits; crystal-fold morph matching World’s stimulus deformations; new shape algorithms.

### Key files

| File | Notes |
|------|--------|
| `src/playground/Experiment05.jsx` | Life→Explore / Original Explore; AGE + Space |
| `src/playground/finalForm/ExploreLifeScene.jsx` | Composition visibility; lobe amplitude wiring |
| `src/playground/finalForm/exp05SurfaceEvaluator.js` | Shared body / petal / particle seating |
| `src/playground/finalForm/exp05MorphologyCalibration.js` | Lobe amp remap + Low / Med / High presets |
| `src/playground/finalForm/Exp05LabPanel.jsx` | Lab knobs, presets, composition |
| `src/playground/finalForm/ExploreWorld{Body,Scatter,Particles}.jsx` | Keep-mounted Explore layers |

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

### Language → Life Engine (Moisture + Turbulence + Temperature)

Compare after environmental language: **A — Baseline** at neutral T/M/Turb vs **B — Environment Affected** with live Temperature, Moisture, and Disturbance→Turbulence.

![[born-another-playground-exp01-language-life-sync.jpg]]

---

## Screenshots — Experiment 05

### Life → Explore — full composition

Shared World surface evaluator with Explore look: body, petals, and particles seated together (default lab, AGE ≈ 0.45).

![[born-another-playground-exp05-life-explore.jpg]]

### Morphology High preset

Same AGE / Seed; **High** exaggerates rest-radius lobe amplitude on the existing `radiusAt` field (no new morph algorithm).

![[born-another-playground-exp05-morph-high.jpg]]

### Body Only composition

Layers stay mounted; composition mode hides petals / particles without remount white-out.

![[born-another-playground-exp05-body-only.jpg]]
