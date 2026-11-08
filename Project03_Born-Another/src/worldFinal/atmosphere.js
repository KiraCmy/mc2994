/**
 * World Final — underwater lighting + haze palette (M2A).
 *
 * Every color derives from Playground Experiment 04:
 *   - EXP04_CSS: the .playground-page--exp05 background stops and bloom
 *     layers in playground.css (the sky behind the transparent canvas).
 *   - EXP04_MEMBRANE: linear-space constants of the Pearlescent Membrane V2
 *     shader (exp05PearlescentMembraneV2.js), so the seabed shares the
 *     organism's pearl, fold, and pastel vocabulary.
 * M3C: the visible water is WATER below (drawn by WaterBackdrop); the haze
 * color is its horizon tone. EXP04_CSS is kept as the palette's origin.
 */
import * as THREE from 'three'
import { normalizeWorldFinalConfig } from './config.js'

export const EXP04_CSS = Object.freeze({
  gradientCenter: [192, 198, 208], // #c0c6d0
  gradientMid: [174, 181, 193], // #aeb5c1
  /* [r, g, b, alpha at bloom centre], painted bottom → top. */
  blooms: [
    [186, 172, 226, 0.32], // lavender
    [156, 214, 222, 0.38], // cyan
    [232, 198, 214, 0.42], // pink
  ],
})

export const EXP04_MEMBRANE = Object.freeze({
  pearlBase: [0.86, 0.84, 0.88],
  lavender: [0.72, 0.64, 0.92],
  pink: [0.95, 0.62, 0.74],
  cyan: [0.42, 0.86, 0.92],
  foldTint: [0.66, 0.54, 0.74],
  foldCool: [0.5, 0.62, 0.72],
})

/**
 * World Final water volume (linear sRGB), drawn by WaterBackdrop.
 * A cool gray close to the Playground Experiment 04 page, with only a faint
 * blue lift. The sun glow (and the light shafts that use it) stays warm.
 * See waterVolume.js for how direction maps to these.
 */
export const WATER = Object.freeze({
  /** Looking straight down into the basin. */
  deep: [0.34, 0.35, 0.39],
  horizon: [0.52, 0.54, 0.58],
  /** Toward the surface. */
  zenith: [0.64, 0.65, 0.69],
  sun: [0.98, 0.86, 0.93],
})

/**
 * Bloom coverage where the horizon sits on screen (between bloom centre and
 * the falloff stops), and position between the gradient's centre and mid stop.
 */
const HORIZON_BLOOM_COVERAGE = 0.7
const HORIZON_GRADIENT_T = 0.45

/** Light directions (toward the light). The key (also the sun seen through
 *  the water, ~27° up) is to the side of the default approach bearing: low
 *  enough to rake light and shadow across the dunes, and
 *  still reaches the far basin wall, which faces the camera. The cool fill
 *  comes from the opposite side so shaded flanks read blue, not black. */
export const KEY_DIRECTION = Object.freeze(new THREE.Vector3(0.656, 0.4, -0.436).normalize())
export const FILL_DIRECTION = Object.freeze(new THREE.Vector3(-0.6, 0.6, 0.4).normalize())

/** sRGB 0–255 composite of the Exp04 background at the horizon. */
export function exp04HorizonRgb() {
  const { gradientCenter: c, gradientMid: m, blooms } = EXP04_CSS
  let rgb = c.map((v, i) => v + (m[i] - v) * HORIZON_GRADIENT_T)
  for (const [r, g, b, a] of blooms) {
    const t = a * HORIZON_BLOOM_COVERAGE
    rgb = [rgb[0] + (r - rgb[0]) * t, rgb[1] + (g - rgb[1]) * t, rgb[2] + (b - rgb[2]) * t]
  }
  return rgb
}

function cssColor([r, g, b]) {
  return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace)
}

function linearColor([r, g, b]) {
  return new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace)
}

function bloom(index) {
  return cssColor(EXP04_CSS.blooms[index])
}

/**
 * Linear-space shading parameters for the seabed material.
 * colorBalance shifts the lights and ambient, never the haze: the haze must
 * keep matching the fixed page background.
 */
export function atmosphereParams(config) {
  const cfg = normalizeWorldFinalConfig(config)
  const warm = Math.max(0, cfg.colorBalance)
  const cool = Math.max(0, -cfg.colorBalance)
  const lavender = bloom(0)
  const cyan = bloom(1)
  const pink = bloom(2)
  /* Base haze = horizon water; the seabed shader hazes toward the full
     direction-dependent water color (waterVolume.js). */
  const haze = linearColor(WATER.horizon)
  const M = EXP04_MEMBRANE

  /* Lights stay near-neutral: they multiply an already pearl-mauve albedo,
     so strong tints here would square the saturation. */
  const key = new THREE.Color('#fff8f5').lerp(pink, 0.22 + 0.35 * warm - 0.15 * cool)
  const fill = new THREE.Color('#eef3f7').lerp(cyan, 0.4 + 0.4 * cool - 0.25 * warm)

  const sky = haze.clone().lerp(new THREE.Color('#ffffff'), 0.25).lerp(lavender, 0.12)
  if (warm > 0) sky.lerp(pink, warm * 0.3)
  if (cool > 0) sky.lerp(cyan, cool * 0.3)
  const ground = linearColor(M.foldCool).lerp(linearColor(M.foldTint), 0.5 + 0.5 * cfg.colorBalance)
  ground.multiplyScalar(0.55)

  /* Sediment tones: the configured terrain color pulled toward Exp04 hues
     at controlled luminance, so variation shifts hue, not exposure. */
  const base = new THREE.Color(cfg.terrainColor)
  const L = luminance(base)
  const tone = (rgb, lum, amount) => base.clone().lerp(atLuminance(linearColor(rgb), lum), amount)
  const pearl = tone([1, 1, 1], L * 1.04, 0.45).lerp(atLuminance(pink.clone(), L), 0.04)
  const lavenderTone = tone(M.lavender, L * 0.97, 0.32)
  const deep = tone(M.foldCool, L * 0.78, 0.42)
  const bank = tone(M.foldTint, L * 0.86, 0.38)
  const high = tone(M.pearlBase, L * 1.12, 0.5).lerp(atLuminance(pink.clone(), L * 1.1), 0.07)
  const crest = tone(M.pearlBase, L * 1.15, 0.5)

  const valley = haze.clone().lerp(lavender, 0.2).lerp(cyan, 0.15 + 0.25 * cool)
  valley.lerp(pink, 0.25 * warm)

  return {
    base,
    pearl,
    lavender: lavenderTone,
    deep,
    bank,
    high,
    crest,
    key,
    fill,
    sky,
    ground,
    haze,
    valley,
    glintCool: cyan.clone().multiplyScalar(0.7),
    glintWarm: pink.clone().multiplyScalar(0.7),
    sedimentGrain: cfg.sedimentGrain,
    lightFiltering: cfg.lightFiltering,
    lightIntensity: cfg.lightIntensity,
    hazeDensity: cfg.fogDensity,
    hazeStart: cfg.fogDistance,
    valleyHaze: cfg.valleyHaze,
  }
}

/** Relative luminance of a linear THREE.Color. */
export function luminance(color) {
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b
}

/** Rescales a linear color (in place) to the given luminance. */
function atLuminance(color, target) {
  return color.multiplyScalar(target / Math.max(1e-6, luminance(color)))
}
