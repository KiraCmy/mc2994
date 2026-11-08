/**
 * World Final — shared tweakables (terrain + camera).
 * Lifecycle zone radii are spatial logic only; they do not carve visible rings.
 *
 * The canvas is transparent and the page's Exp04 CSS gradient
 * (.playground-page--exp05) is the sky; atmosphere colors live in
 * atmosphere.js and are taken from that stylesheet.
 */

export const WORLD_FINAL_ZONES = Object.freeze({
  nurseryEnd: 0.25,
  driftEnd: 0.75,
  rimStart: 0.75,
  boundary: 0.95,
})

/** Drift spawn: mid drift ring. */
export const WORLD_FINAL_CAMERA_START_R = 0.55

/** Default (un-zoomed) vertical field of view; the wheel zooms around it. */
export const WORLD_FINAL_CAMERA_FOV = 55

/**
 * Terrain plane extends past the basin rim so elevated surroundings exist;
 * it fades out radially between these multiples of basinRadius.
 */
export const WORLD_FINAL_TERRAIN_EXTENT = 1.4
export const WORLD_FINAL_EDGE_FADE = Object.freeze({ start: 1.12, end: 1.38 })

export const WORLD_FINAL_DEFAULTS = Object.freeze({
  seed: 1042,
  /** World radius (XZ) of the walkable basin. */
  basinRadius: 400,

  /* Macro — the basin itself. */
  /** Floor-to-rim height difference (world units). */
  basinDepth: 58,
  /** Rim radius as a fraction of basinRadius. */
  basinWidth: 0.82,
  /** 0 = round, centred bowl; 1 = offset, elongated, tilted, lobed. */
  basinAsymmetry: 0.5,

  /* Meso — elongated sediment ridges. */
  /** Crest height of the sediment ridges. */
  ridgeHeight: 7,
  /** Ridge wavelength across their long axis (world units). */
  ridgeSpacing: 120,

  /* Micro — surface irregularity. */
  surfaceDetail: 0.8,

  /** PlaneGeometry segments per side (advanced). */
  gridRes: 320,
  /** Camera hover above terrain. */
  hoverHeight: 5.5,
  /** Horizontal drift speed (units / s); Shift multiplies it. */
  maxSpeed: 36,
  /** Q / E vertical speed (units / s). */
  verticalSpeed: 16,
  damping: 0.92,
  lookSensitivity: 0.0024,
  /* Atmosphere (M2A) — shading only, never rebuilds the mesh. */
  /** Key + fill light strength (1 = reference look). */
  lightIntensity: 1,
  /** Ambient / light hue: −1 cool cyan · 0 pearl lavender · 1 warm pink. */
  colorBalance: 0,
  /** Haze density: terrain tints toward the page atmosphere, then fades out. */
  fogDensity: 0.0014,
  /** Clear water in front of the camera before haze begins (world units). */
  fogDistance: 60,
  /** Fine procedural sediment relief + grain (shading only, M2B). */
  sedimentGrain: 0.8,
  /** Light filtered through the water: drifting pools + dimmer deep floor. */
  lightFiltering: 0.6,
  /* Water light (M3C) — shading only. */
  /** Sun shafts fanning through the water. */
  lightShafts: 1,
  /** Drifting caustic filaments on sunlit sediment. */
  caustics: 1,
  /** Glitter flakes in the sediment. */
  sedimentSparkle: 1,
  /* Glass seabed (M3D). */
  /** Thin-film rainbow glaze on the basin and the seabed sprays. */
  basinIridescence: 1,
  /** Glassy splash crowns on the seabed (fraction of the base count, 0–2); off by default since M3E. */
  sprayDensity: 0,
  /** Abstract glass formations: ribbons, crumpled films, crystals, pebbles (M3E, 0–2). */
  formationDensity: 1,

  /* Living water (M2C) — shared current + suspended particles. */
  /** Fraction of the particle budget drawn (0 = none). */
  particleDensity: 0.55,
  /** Current magnitude: mean drift and eddy amplitude. */
  currentStrength: 1,
  /** How fast the current flows and evolves. */
  currentSpeed: 0.7,
  /** Extra luminous haze pooled on the deep basin floor. */
  valleyHaze: 0.4,
  terrainColor: '#a497bf',

  /* Organism (M3A) — one Final Form organism placed in the basin. */
  /** World scale of the organism body (1 = Playground Population size). */
  organismScale: 5,
  /** How strongly the shared current moves the organism (0 = still). */
  organismFloat: 1,
})

export function normalizeWorldFinalConfig(partial = {}) {
  const base = { ...WORLD_FINAL_DEFAULTS, ...partial }
  return {
    ...base,
    seed: Math.max(1, Math.floor(Number(base.seed) || 1)),
    basinRadius: clamp(base.basinRadius, 80, 1200),
    basinDepth: clamp(base.basinDepth, 0, 140),
    basinWidth: clamp(base.basinWidth, 0.4, 1.1),
    basinAsymmetry: clamp01(base.basinAsymmetry),
    ridgeHeight: clamp(base.ridgeHeight, 0, 24),
    ridgeSpacing: clamp(base.ridgeSpacing, 30, 320),
    surfaceDetail: clamp(base.surfaceDetail, 0, 4),
    gridRes: Math.round(clamp(base.gridRes, 64, 512)),
    hoverHeight: clamp(base.hoverHeight, 0.5, 20),
    maxSpeed: clamp(base.maxSpeed, 2, 150),
    verticalSpeed: clamp(base.verticalSpeed, 1, 80),
    damping: clamp(base.damping, 0.7, 0.99),
    lookSensitivity: clamp(base.lookSensitivity, 0.0005, 0.01),
    lightIntensity: clamp(base.lightIntensity, 0, 2),
    colorBalance: clamp(base.colorBalance, -1, 1),
    fogDensity: clamp(base.fogDensity, 0, 0.05),
    fogDistance: clamp(base.fogDistance, 0, 600),
    valleyHaze: clamp01(base.valleyHaze),
    sedimentGrain: clamp(base.sedimentGrain, 0, 2),
    lightFiltering: clamp01(base.lightFiltering),
    lightShafts: clamp(base.lightShafts, 0, 2),
    caustics: clamp(base.caustics, 0, 2),
    sedimentSparkle: clamp(base.sedimentSparkle, 0, 2),
    basinIridescence: clamp(base.basinIridescence, 0, 2),
    sprayDensity: clamp(base.sprayDensity, 0, 2),
    formationDensity: clamp(base.formationDensity, 0, 2),
    particleDensity: clamp01(base.particleDensity),
    currentStrength: clamp(base.currentStrength, 0, 3),
    currentSpeed: clamp(base.currentSpeed, 0, 3),
    terrainColor: String(base.terrainColor || WORLD_FINAL_DEFAULTS.terrainColor),
    organismScale: clamp(base.organismScale, 3, 8),
    organismFloat: clamp(base.organismFloat, 0, 2),
  }
}

function clamp01(v) {
  return Math.min(1, Math.max(0, Number(v) || 0))
}

function clamp(v, min, max) {
  const n = Number(v)
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}
