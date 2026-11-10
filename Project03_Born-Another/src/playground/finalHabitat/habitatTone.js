/**
 * Exp07 habitat tone: the whole medium answers the environment.
 *
 * The starting environment (temperature 0.38, moisture 0.68, turbulence 0.12)
 * gives exactly the base palette; moving away from it changes the world:
 *  - cold  → icy blue water, clear and far-seeing, white light, bright caustics
 *  - warm  → peach / amber haze, golden light, sun-warmed sand and crystals
 *  - wet   → dense, soft, pale haze (short view), heavier veils
 *  - dry   → crisp grey clarity (long view), thin veils, sharp caustics
 *  - turbulence → sandy storm haze, thicker fog, dust lifted off the floor,
 *    dim light, few caustics, busy particles
 *  - moisture rising past the calm habitat → a rainbow film on the ground
 * `dusk` (0..1, end of life) pulls everything toward night.
 * Pure (no three.js): colours are [r, g, b] in 0..1 (sRGB).
 */

export const TONE_REFERENCE = Object.freeze({ temperature: 0.38, moisture: 0.68, turbulence: 0.12 })

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
const rgb = (r, g, b) => [r / 255, g / 255, b / 255]

export const TONE_BASE = Object.freeze({
  fog: hex('#9da5b5'),
  top: hex('#c6ccd8'),
  horizon: hex('#a2aaba'),
  bottom: hex('#7d8597'),
  hemiGround: hex('#6f6984'),
  key: hex('#ffffff'),
  ground: hex('#bdbacb'),
  crystal: hex('#e4e3f0'),
  bloomA: rgb(232, 198, 214),
  bloomB: rgb(156, 214, 222),
  floor: rgb(70, 74, 92),
})

const COLD = {
  fog: hex('#86a3c4'), top: hex('#cddcee'), horizon: hex('#8fa8c6'), bottom: hex('#5f7898'),
  hemiGround: hex('#4f6386'), key: hex('#e6f2ff'), ground: hex('#a9b7ce'), crystal: hex('#dbe8f8'),
  bloomA: rgb(178, 206, 238), bloomB: rgb(150, 222, 238), floor: rgb(52, 70, 98),
}
/* Warm water: peach / apricot haze, amber light, sun-warmed sand. */
const WARM = {
  fog: hex('#cfa488'), top: hex('#f0d3b8'), horizon: hex('#d6a98a'), bottom: hex('#a5735a'),
  hemiGround: hex('#9a6448'), key: hex('#ffd4a3'), ground: hex('#dcbb9e'), crystal: hex('#f6e1cf'),
  bloomA: rgb(252, 196, 164), bloomB: rgb(250, 214, 150), floor: rgb(112, 74, 52),
}
const WET = { fog: hex('#b4b9c8'), top: hex('#d6d9e2'), horizon: hex('#b8bdcb'), bottom: hex('#959cab'), ground: hex('#b8b4c8') }
const DRY = { fog: hex('#959aa3'), top: hex('#c3c5ca'), horizon: hex('#9b9ea6'), bottom: hex('#737781'), ground: hex('#c3bec4'), crystal: hex('#e8e7ec') }
const STORM = {
  fog: hex('#6a7080'), top: hex('#8e94a1'), horizon: hex('#6e7484'), bottom: hex('#4b5161'),
  hemiGround: hex('#45434f'), key: hex('#c9ced8'), ground: hex('#9796a3'), crystal: hex('#c9cad6'),
  bloomA: rgb(170, 172, 190), bloomB: rgb(140, 160, 176), floor: rgb(36, 38, 48),
}
const NIGHT = {
  fog: hex('#2a2e3a'), top: hex('#3a3f4e'), horizon: hex('#2c303c'), bottom: hex('#1d2029'),
  hemiGround: hex('#1e1d26'), key: hex('#b9c3dd'), ground: hex('#5a5866'), crystal: hex('#8f90a3'),
  bloomA: rgb(60, 62, 80), bloomB: rgb(50, 60, 74), floor: rgb(14, 15, 20),
}

function clamp01(v) {
  return Math.min(1, Math.max(0, Number(v) || 0))
}
function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}
/** Signed offset from the reference, normalised to −1..1 on each side. */
function side(value, ref) {
  const v = clamp01(value)
  return v >= ref ? (v - ref) / (1 - ref || 1) : (v - ref) / (ref || 1)
}

/**
 * Tone for an environment (+ dusk). Colours for fog / sky / lights / sand /
 * crystals / page overlay, plus scalars: fogDensity, hemiIntensity,
 * keyIntensity, shaftStrength (×), caustic, veilFade, moteDrift, bloomAlpha.
 */
export function habitatTone(env = TONE_REFERENCE, dusk = 0) {
  const t = side(env?.temperature ?? TONE_REFERENCE.temperature, TONE_REFERENCE.temperature)
  const m = side(env?.moisture ?? TONE_REFERENCE.moisture, TONE_REFERENCE.moisture)
  const u = side(env?.turbulence ?? TONE_REFERENCE.turbulence, TONE_REFERENCE.turbulence)
  const d = clamp01(dusk)
  const storm = Math.max(0, u)
  const out = {}
  for (const key of Object.keys(TONE_BASE)) {
    let c = TONE_BASE[key]
    if (t < 0 && COLD[key]) c = mix(c, COLD[key], -t)
    if (t > 0 && WARM[key]) c = mix(c, WARM[key], t)
    if (m > 0 && WET[key]) c = mix(c, WET[key], m * 0.75)
    if (m < 0 && DRY[key]) c = mix(c, DRY[key], -m * 0.75)
    if (storm > 0 && STORM[key]) c = mix(c, STORM[key], storm * 0.95)
    if (d > 0 && NIGHT[key]) c = mix(c, NIGHT[key], d * 0.92)
    out[key] = c
  }
  /* Storm lifts a sandy haze: much thicker than the calm water, still capped. */
  const density = 0.0105 * (1 + (m > 0 ? 1.1 : 0.55) * m) * (1 + 0.35 * t) * (1 + 2.6 * storm) * (1 + 0.4 * d)
  if (storm > 0) out.fog = mix(out.fog, hex('#c4b7a6'), Math.min(1, storm * 0.55))
  const clear = Math.max(0, -m) + Math.max(0, -t) * 0.6
  /* Rainbow film arrives as moisture rises past the calm habitat. */
  const filmIn = clamp01(((env?.moisture ?? TONE_REFERENCE.moisture) - 0.55) / 0.45)
  const film = filmIn * filmIn * (3 - 2 * filmIn)
  return {
    ...out,
    storm,
    film,
    fogDensity: Math.min(0.05, Math.max(0.0045, density)),
    hemiIntensity: 0.45 * (1 - 0.4 * storm) * (1 - 0.7 * d),
    keyIntensity: 1.5 * (1 - 0.5 * storm) * (1 + 0.12 * Math.max(0, -t)) * (1 - 0.8 * d),
    shaftStrength: (1 - 0.75 * storm) * (1 - 0.3 * Math.max(0, m)) * (1 + 0.5 * clear) * (1 - 0.9 * d),
    caustic: 0.3 * (1 + 0.6 * clear + 0.2 * Math.max(0, t)) * (1 - 0.6 * Math.max(0, m)) * (1 - 0.7 * storm) * (1 - d),
    veilFade: Math.min(1, 0.45 * (1 + 0.6 * m) * (1 + 0.4 * storm) * (1 - 0.5 * d)),
    moteDrift: clamp01(env?.turbulence ?? 0) * 0.9,
    bloomAlpha: 1 - 0.5 * storm - 0.6 * d,
  }
}

/** CSS custom properties for the page overlay (vignette / blooms / floor). */
export function toneCssVars(tone) {
  const c = (v, a) => `rgba(${Math.round(v[0] * 255)}, ${Math.round(v[1] * 255)}, ${Math.round(v[2] * 255)}, ${a.toFixed(3)})`
  const k = Math.max(0, tone.bloomAlpha)
  return {
    '--exp07-bloom-a': c(tone.bloomA, 0.14 * k),
    '--exp07-bloom-a2': c(tone.bloomA, 0.04 * k),
    '--exp07-bloom-b': c(tone.bloomB, 0.12 * k),
    '--exp07-bloom-b2': c(tone.bloomB, 0.04 * k),
    '--exp07-floor': c(tone.floor, 0.24),
    '--exp07-top': c(tone.top, 0.55),
    '--exp07-dust': c([0.72, 0.66, 0.56], 0.5 * clamp01(tone.storm ?? 0)),
    '--exp07-film': clamp01(tone.film ?? 0).toFixed(3),
  }
}
