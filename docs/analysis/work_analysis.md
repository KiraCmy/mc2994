# Born Another — Work Analysis

Chronological analysis of recent environmental / Playground work (World Life Engine + Experiment 01 — Language as Environment). Companion logs: [Born-Another_Playground.md](../Progress-Recording/Born-Another_Playground.md), [Prompt_Archive.md](../planning/Prompt_Archive.md).

---

## 1. Environmental System Audit (read-only)

**Goal:** Establish what Moisture and Turbulence actually did in World before adding behaviors.

**Findings (baseline at audit time)**

| Channel | Status |
|---------|--------|
| Temperature | Playground-only visual coupling (membrane); not a Life Engine env input |
| Moisture | Largely disconnected or non-visible in World UI; growth path incomplete for lab comparison |
| Turbulence | Not a coherent World environmental membrane field yet; risk of confusion with particle / artistic noise |

**Architecture confirmed**

- Life Engine: fixed-step (`1/30`), deterministic `seed + history + environmentHistory + step` replay.
- World organism: `WorldViewport` + `applyLifeToWorld` / crystal sites.
- Playground: separate language env sim (`useEnvironmentSimulation`) — at audit time only Temperature reached the 3D form.

**Recommended first experiments (later implemented):** Moisture → crystal growth/branching; Turbulence → reversible membrane field; keep World clean; lab in Playground.

---

## 2. Moisture → Crystal Growth / Branching

**Implemented in Life Engine**

- `environment.moisture` + piecewise `environmentHistory`.
- `moistureGrowthMultiplier` — neutral at **0.50**; dry / wet scale future growth rates.
- Branching gates: count delta, maturity, mineral gates from moisture.
- `setLifeMoisture` — record at current step (future growth only).
- `applyLifeMoistureFromBirth` — lab scrub rebuilds crystals from birth at constant moisture up to current AGE (makes 0.2 / 0.5 / 0.8 comparable).

**Wiring**

- `useLifeEngine.setMoisture` → from-birth rebuild (manual Crystal Moisture scrub).
- Playground Experiment 01: Crystal Moisture presets / slider (lab-only; not World UI).

**Tests:** `lifeEngine.test.js` moisture growth, history replay, branching persistence.

---

## 3. Turbulence → Membrane Field

**Implemented**

- `turbulenceField.js` — deterministic value-noise + traveling wrap; radial membrane offset from `life.environment.turbulence` and `life.time`.
- `setLifeTurbulence` — immediate reversible field; history for AGE scrub.
- Composed in `worldLifeAdapter` / crystal anchors so crystals stay membrane-attached.
- Default calm = **0.00** (unlike language Disturbance neutral 0.50).

**Placement decision**

- **Not** exposed on World tab (World stays clean for final transfer).
- Lab controls on Playground Experiment 01 — Membrane Turbulence.
- Displacement later strengthened (~0.11 → ~0.36 peak) so mid/high Turbulence reads clearly on the form.

**Tests:** `turbulenceField.test.js` (zero at calm, bounded, deterministic, no crystal length change).

---

## 4. Language Env → Life Engine Sync

**Problem:** Typing “rain” / “wind” updated Playground Moisture / Disturbance readouts and graph, but Compare **M / Turb** stayed at Life Engine defaults (0.50 / 0.00). Only Temperature affected the organism.

**Data flow (now)**

```
Language → parseEnvironmentalLanguage → useEnvironmentSimulation
  → environment.moisture / .disturbance (soft-follow)
  → Experiment01 sync (quantized)
      moisture → setMoistureAtStep → setLifeMoisture → environmentHistory
      disturbance → disturbanceToTurbulence → setTurbulence → setLifeTurbulence
  → organism (growth / membrane waves)
```

**Mapping:** `disturbanceToTurbulence` — Disturbance **0.50 → Turbulence 0**, **1.0 → 1.0** (language neutral ≠ Life calm).

**Manual controls coexistence**

- **Live** (default): language env pushes into Life Engine.
- Manual Crystal Moisture / Membrane Turbulence: override; language sync paused for that channel until language reclaims it or user presses Live.
- Compare **M / Turb** always read `life.environment` (organism truth).

**Compare viewports**

- **A — Baseline:** neutral T / M / Turb at same AGE (replay with neutral env history).
- **B — Environment Affected:** live Temperature + Moisture + Turbulence + thermal memory.
- Temperature compare behavior preserved; no extra canvases.

---

## 5. Playground Layout (viewport stays visible)

**Problem:** Page scrolled when focusing language or long Controls; organism left the viewport.

**Fix (`playground.css`)**

- Desktop: locked flex layout; scene + language stay put; **Controls** panel scrolls independently.
- Compact intro / language strip; history capped with internal scroll.
- Mobile: page may scroll; scene `position: sticky` at top.

---

## 6. Playground Frame Stutter

**Cause:** `useEnvironmentSimulation` called `setSim` every `requestAnimationFrame`, forcing React to reconcile one or two WebGL trees every frame.

**Fixes**

- Env steps every frame in a **ref**; React publish only when values change (~10 Hz, `startTransition`).
- Membrane Temperature reads live env ref inside R3F / thermal tick (smooth soft-follow without 60 Hz React).
- Playground skips redundant `useLayoutEffect` mesh apply on each Life tick when `resolveLifeForRender` / `extraRadialOffset` already refresh in `useFrame` (World path unchanged).

---

## 7. Explicit non-goals (this arc)

- World UI Turbulence / Moisture controls (deferred until Playground method is validated).
- New language parser / LLM / API.
- Changes to AGE, death timing, crystal shaders, or growth equations beyond moisture multipliers/gates already added.
- Second organism or extra rendering passes.

---

## 8. Key files

| Area | Files |
|------|--------|
| Life env | `lifeEngine.js`, `useLifeEngine.js`, `lifeEngine.test.js` |
| Turbulence field | `turbulenceField.js`, `turbulenceField.test.js`, `worldLifeAdapter.js` |
| Language env | `envState.js`, `environmentSimulation.js`, `useEnvironmentSimulation.js`, `parseEnvironmentalLanguage.js`, `semanticConcepts.js` |
| Playground UI | `Experiment01.jsx`, `playground.css` |
| Viewport | `WorldViewport.jsx` (optional Playground hooks; World defaults preserved) |

---

## 9. Manual verification checklist

1. `#playground` → Experiment 01 → Compare, Moisture/Turbulence **Live**.
2. **rain** → Moisture graph + Life **M** rise; crystals respond over AGE.
3. **wind** → Disturbance + Life **Turb** rise; membrane waves with Play.
4. **hot** → Temperature coupling unchanged.
5. Manual sliders override; Live / matching language reclaim.
6. AGE scrub / Restart keep env history consistent; death timing unchanged.
7. Typing / scrubbing Controls does not scroll the organism off-screen (desktop).
8. Animation remains smooth when env is idle or soft-following.

---

## 10. Status snapshot

| Item | Status |
|------|--------|
| Env audit | Done |
| Moisture growth / branching | Done (Life Engine + Playground lab) |
| Turbulence membrane field | Done (Playground lab; World UI deferred) |
| Language → Moisture / Turbulence | Done |
| Compare A/B multi-factor labels | Done |
| Layout lock / sticky scene | Done |
| Stutter (env setState every frame) | Done |
| Transfer Moisture / Turbulence into World UI | Not started (by design) |

---

## Screenshots

### Language → Life Engine (Moisture + Turbulence + Temperature)

Compare mode after environmental language: **A — Baseline** at neutral T/M/Turb vs **B — Environment Affected** with live Temperature, Moisture, and Disturbance→Turbulence driving the organism.

![[born-another-playground-exp01-language-life-sync.jpg]]
