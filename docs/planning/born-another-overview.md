# Born Another — project overview (for writing the README)

*Written Nov 10, 2026, from the working session on World Final. It describes the code as it is now. The existing `README.md` (311 lines) stops at the midterm (Concept, Studies, System, World V2) and does not yet cover Playground, World Final, Memory Lab or Archive.*

## What it is
**Born Another** (MC2994 Procedural World Building, Cornell, Fall 2026, Project 03) is "a procedural world of lost and possible lives". The viewer sets conditions for artificial digital lives that develop, crystallize, die and leave remains. The same idea runs through the course: one procedural field, read in many ways. Project 02 (Noise Lab) came first, in `../Project02`.

## Stack and running it
- React 19, @react-three/fiber 9, drei 10, three r186, Vite 8, oxlint. Firebase Hosting serves `dist/` with an SPA rewrite.
- `npm install`, then `npm run dev`. The site is at `http://127.0.0.1:5173`.
- Other scripts: `npm run build`, `npm run preview`, `npm run lint`.
- Tests use the Node test runner, e.g. `node --test src/playground/finalHabitat/*.test.js` (58 tests).
- Routing is hash-based (`src/modes.js`, `src/App.jsx`).

## Sections (hash routes)
| Section | Hash | What it is |
|---|---|---|
| Concept | `#concept` | Statement of intent |
| Studies | `#shader`, `#scatter`, `#path`, `#particle`, `#explore`, `#lsystem`, `#material` | Technical studies on one shared organism |
| System | `#system` | Architecture and crystal-growth diagrams |
| World | `#world` | World V2: the organism as a world, with the Life Engine |
| Playground | `#playground` | Experiments 01–07 that led to World Final |
| **World Final** | `#world-final` | The final piece (below) |
| Memory Lab | `#memory-lab` | Memory experiments |
| Archive | `#archive`, `#archive/<key>` | The Life Archive of kept remains |

## World Final
The core is `src/playground/Experiment07.jsx` and `src/playground/finalHabitat/`.
- **Arrival:** the viewer descends into an underwater habitat of dunes, veils, crystal outcrops and frost-crystal trees.
  - Three lives share one water. The central one is met young, at AGE 0.14, and lives about 3.7 minutes.
  - New lives grow in from a small pearl bud; they never pop in.
- **Language → environment:** the viewer's typed words are read by an AI interpreter into Δtemperature, Δmoisture and Δturbulence, plus intensity and confidence. Each message moves the water at most ±0.6 on top of the base sliders, then fades.
- **Environment → form:** the form changes with the water.
  - Warm water raises ridges along the fibres; cold contracts the body.
  - Wet swells blisters and adds more petals; turbulence stratifies the body into bands.
  - Each shift of the water leaves marks on the body.
  - Each species (spiral/ammonite, segmented, trilobite) has its own sensitivities and morph logic.
- **Crystallization:** the target level is roughly cold × wet × calm; dry water crystallizes faster.
  - The habit depends on species: druse prisms, satin plates or iridescent blocks.
  - The cut depends on the dominant shape: prism, faceted, stubby or tabular.
  - The form freezes between 35% and 60% of the crystallization level. After death nothing changes shape: the body only falls and petrifies.
- **Remains and the Archive:** at death the remains settle on the sand. The viewer can keep them; they are named and saved in the browser's Life Archive.
- **Underworld:** a hole in the dunes leads to a dark iridescent cavern.
  - Light from the hole falls as a pool on the floor.
  - Lilac quartz and amber ember druses grow on the floor, walls and ceiling.
  - Kept remains rest there as cut-out images. Approaching one draws a white leader line to a small tag that links to its Archive card.
- **Persistence:** the world keeps running while you visit other pages of the site. Only the **Start a new world ↺** button (with a confirm click) restarts it. Reloading the page also starts over.
- The mapping is also drawn as a sheet: "Language → Environment → Crystallization" (Design artifact).

## Key files (finalHabitat)
| Area | Files |
|---|---|
| Body, morphs, crystals | `CrystalBody.jsx`, `unfoldForm.js`, `crystalShapes.js`, `habitatShaders.js` |
| Terrain | `habitatField.js`, `habitatTerrainBuild.js`, `HabitatTerrain.jsx` |
| Ground growths | `habitatGrowthBuild.js`, `emberCrystals.js`, `HabitatGrowth.jsx` |
| Crystal trees | `crystalSpires.js`, `CrystalSpires.jsx` |
| Underworld | `caves.js`, `caveGeometry.js`, `Caves.jsx` |
| Other lives (kin) | `habitatKin.js`, `useHabitatKin.js`, `HabitatKin.jsx` |
| Death, remains, archive | `habitatFossil.js`, `Remains.jsx`, `archive.js`, `lifeLog.js`, `snapshotCutout.js` |
| Scene, lighting, opening | `HabitatScene.jsx`, `FocusStudio.jsx`, `HabitatAtmosphere.jsx`, `worldOpening.js` |

## Language interpreter (server side)
- The interpreter lives in `server/interpret` and is added to Vite by `server/vitePlugin.js`.
- Providers: `openai`, `anthropic`, `gemini`, `mock` or `local`, chosen with `BA_AI_PROVIDER`.
- Other settings: `BA_AI_MODEL`, `BA_AI_TIMEOUT_MS`, `BA_AI_MAX_INPUT_CHARS`, `BA_AI_FALLBACK` (`local` or `neutral`).
- **Security rules (the README must keep these):**
  - Copy `.env.example` to `.env.local` and put the API key there. `.env.local` is git-ignored.
  - Never prefix keys with `VITE_`: VITE_* variables are bundled into the browser.
  - Never put real keys in `.env.example` or anywhere in the README.
