# Born Another — Technic Log

Technical notes for recurring World / Studies issues (Oct 2026).

**Live site:** https://born-another.web.app

---

# Part A — Windows Particle / Explore

Concise record of the **Windows Chrome freeze and particle fidelity** work. Use this if the same symptoms return on Windows + NVIDIA / ANGLE.

**Related code:** `src/renderBudget.js`, `src/particle/ParticleField.jsx`, `src/surfaceShader.js`, `src/particleDiag.js`

---

## Symptoms

| Platform | Behavior |
|----------|----------|
| **Windows 11 + Chrome** (e.g. RTX 5070) | Particle and Explore tabs **froze the whole browser**. After a safe path, tab opened but particles looked **sparse** and **did not follow** body AGE deformation. |
| **macOS / mobile** | Full particle field + live GPGPU currents — looked correct. |
| **World / other Studies** | Fine on Windows (not the Particle pipeline). |

Console `[BA-DIAG …]` logs often never appeared: the tab locked before the console could flush.

---

## Root causes (two separate problems)

### 1. Freeze — GPGPU init, not “too many points” alone

Particle and Explore both mount **`ParticleField`** (`showParticles = particle \|\| explore`).

On Windows, creating **`GPUComputationRenderer`** (float ping-pong + heavy `particleFlowSimShader`) during tab switch could **hard-lock Chrome**. That path is the Mac “live currents” sim — **not** required for grains to sit on the deforming body.

**Safe Windows production rule:** keep **`allowGpu = false`** (static / no sim). Do **not** re-enable full Mac GPGPU on Windows without a controlled bisect.

### 2. Wrong look after freeze was avoided — soft-cap + wrong rest source

Temporary Windows mitigations that fixed freezes but broke fidelity:

| Issue | What happened |
|-------|----------------|
| **Low density** | `resolveParticleDrawCount()` soft-capped Windows to **8 000** (Explore **4 000**) while the UI still showed the full slider (e.g. 120 000). |
| **Not following form** | Windows used a **lite** vertex shader (radial grow + one noise sample) instead of the organism’s **`macroMorphology` + `developmentDisplace`**. Also, rest positions came from a float **`DataTexture`** without `NearestFilter` — unreliable on ANGLE/NVIDIA — so rest origins could collapse. |

**Important distinction:** GPGPU only **advects** rest points along currents. **Surface attachment** is done every frame in the **vertex shader** from rest XYZ + the same displacement as the body mesh (`uAge`, etc.). You can keep GPGPU off and still match Mac deformation.

---

## Fix that worked (keep this)

Windows / heavy host production path (Mac unchanged):

1. **GPGPU off** — `allowGpu = !isHeavyWebGLHost()` (Windows → false).
2. **Full surface vertex shader** — same `macroMorphology` + `developmentDisplace` (+ late warp) as the organism; **not** the lite VS.
3. **Attribute rests when GPGPU is off** — define `USE_PARTICLE_ATTR_REST`: rest XYZ in the `position` attribute; VS deforms from that. Avoids fragile float state-texture sampling for placement.
4. **Count** — Particle tab uses the **full slider** (up to max). Explore soft-caps (~60k) because Scatter + particles share the frame.
5. **Float DataTextures** (if still used) — `NearestFilter`, no mipmaps.

Build badge (bottom-left) uses `BA_BUILD_ID` in `particleDiag.js` so you can confirm the deployed bundle even when Console is unusable.

---

## Diagnostic URL modes (temporary bisect)

If freeze returns, isolate **without** running the full pipeline every time:

| URL | What runs | If this freezes… |
|-----|-----------|------------------|
| `?baDiag=mount#particle` | Mount stub only | App / Canvas / tab path |
| `?baDiag=cpu#particle` | CPU sampling only | Sampling / count |
| `?baDiag=geom#particle` | Static `PointsMaterial` | POINTS / buffers |
| `?baDiag=simple#particle` | Lite VS + static textures | Lite shader / textures |
| `?baDiag=gpu#particle` | + GPGPU sim | **GPGPU / driver** (expected risk) |

Same modes with `#explore`. Badge shows `baDiag=<mode>` and build ID. Omit `baDiag` for the normal production path.

---

## What not to do

- Do **not** turn Windows back onto the full Mac path (**75k–120k + GPGPU**) as the default — that was the freeze.
- Do **not** “fix” density only by raising caps while still using the **lite** VS — grains will still detach from the body.
- Do **not** change Mac / mobile GPGPU behavior to match Windows.

---

## Key files & knobs

| File | Role |
|------|------|
| `renderBudget.js` | `isWindowsHost()`, `isHeavyWebGLHost()`, `resolveParticleDrawCount()` |
| `particle/ParticleField.jsx` | `allowGpu`, `useAttrRest`, currents / POINTS |
| `surfaceShader.js` | `particleSurfaceVertexShader` (+ `USE_PARTICLE_ATTR_REST`), lite VS |
| `particleDiag.js` | `BA_BUILD_ID`, `?baDiag=`, on-screen badge |

Deploy: build `Project03_Born-Another`, then `npx firebase deploy --only hosting` (project `born-another`).

---

## Quick checklist if it happens again

1. Hard-refresh; confirm badge build ID matches the deploy you expect.  
2. World OK but Particle/Explore freeze → suspect **ParticleField** / GPGPU.  
3. Bisect with `?baDiag=mount` → `cpu` → `geom` → `simple` → `gpu`.  
4. Opens but sparse → check `resolveParticleDrawCount` / Explore cap.  
5. Opens but ignores AGE morph → confirm **full** VS + attribute rests (GPGPU still off).  
6. Only `?baDiag=gpu` freezes → leave production GPGPU off on Windows.

---

# Part B — World D — Shader (B — Dark + milky grade)

How **D — SHADER** is implemented on the World page. Reference when tuning the milky look or checking that A / B / C stayed isolated.

**Related code:** `src/worldv2/WorldV2.jsx` (`createWorldBackground`, `FINISH_SHADER`, `SHADER_STUDY_GRADE`, `WorldPostprocessing`), `src/worldv2/worldV2.css`

---

## 1. Does D reuse exact B — Dark before treatment?

**Yes, for the 3D scene.** D draws the same organism, lights, environment map, fog, bloom, and finish pass as B.

Scene-level alignment with B: both Dark and Shader use black (`#000000`) in `createWorldBackground()`. D does **not** use a separate light-gray clear anymore.

Not forked for D: membrane / crystal materials, lights, PMREM studio, fog, Life Engine, camera.

---

## 2. Mechanism (not CSS)

**Three.js postprocessing only** — a full-screen `ShaderPass` (`SHADER_STUDY_GRADE`) on the shared `EffectComposer`.

- Not CSS filters or blend modes on the Canvas  
- Not separate membrane / crystal material shaders for D  
- A / B / C do not run this grade (`enabled = false`)

---

## 3. Render / compositing sequence

One Canvas, one composer in `WorldPostprocessing`:

1. **RenderPass** — draw the scene (same as B when D is selected)  
2. **UnrealBloomPass** — shared bloom  
3. **OutputPass** — tone mapping / color space  
4. **FINISH_SHADER** — shared chromatic fringe, vignette, noise (all studies)  
5. **SHADER_STUDY_GRADE** — **D only:** soft invert → milky lift → pastel → output  

Toggle B ↔ D only flips step 5 on/off via `backgroundStudy === 'shader'`.

---

## 4. What controls milky look, contrast, pastels, dark shadows?

All in **`SHADER_STUDY_GRADE`** fragment shader in `WorldV2.jsx` (hardcoded; no UI sliders yet):

| Look | How |
|------|-----|
| **Milky white** | Soft invert `1.0 - src`, then mix toward `paper = vec3(0.9, 0.89, 0.875)` |
| **Contrast** | `pow(..., 0.9)` plus paper mixes (`0.82` / `0.08`) |
| **Pastels** | Desaturate toward luma (`mix(..., 0.58)`), then warm bias `+ vec3(0.018, 0.012, 0.008)` |
| **Dark / charcoal “shadows”** | Former bright highlights become dark after invert; paper mix softens them into gray smudges |

Enable switch: `uEnabled` / `shaderGrade.enabled` in `WorldPostprocessing`.

**UI only (not the 3D grade):** `.world-v2--background-shader` in `worldV2.css` uses dark HUD text so labels stay readable on the milky image.

---

## 5. Whole Canvas or per-object?

**Entire rendered frame as one image.** Membrane, crystals, and background are not graded separately. Whatever is in the Dark framebuffer (black void + organism + bloom) is graded pixel-by-pixel — so black becomes pale paper and speculars become soft charcoal.

---

## 6. Shared with A / B / C?

| Shared across A–D | Differs by study |
|-------------------|------------------|
| Organism geometry & materials | **Background:** Light gray / Dark+Shader black / Atmospheric gradient (`createWorldBackground`) |
| Lights, PMREM, fog | **D-only** milky grade pass |
| Bloom + Finish | CSS HUD colors (Light & Shader → dark type; Dark & Atmospheric → light type) |
| Life Engine, camera, one Canvas | |

**One line:** D draws World like B (black bg + same materials/lights/bloom/finish), then runs one full-screen soft-invert / milky grade; nothing is CSS or per-mesh for that look.
