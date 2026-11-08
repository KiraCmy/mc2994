/**
 * World Final — shared water current (M2C).
 *
 * One environmental flow field for everything that drifts: particles now,
 * organisms later. Velocity (world units / s) at point p:
 *
 *   v(p) = strength · speed · ( mean(τ) + Σᵢ aᵢ cos(kᵢ·p + ωᵢτ + φᵢ) )
 *
 *   mean(τ)  slowly wandering, mostly horizontal drift (incommensurate
 *            frequencies, so it never visibly repeats)
 *   eddies   aᵢ = kᵢ × eᵢ: each mode is the curl of a sinusoidal vector
 *            potential, so the sum is divergence-free — suspended matter
 *            neither bunches up nor thins out.
 *   τ        "flow time": integrated at `speed`, so changing the speed
 *            slider never makes the field jump.
 *
 * Eddy displacement d(p) = strength · Σᵢ aᵢ sin(…)/ωᵢ has ∂d/∂t equal to the
 * eddy velocity; the particle shader uses it (CURRENT_GLSL mirrors this file).
 */

export const CURRENT_MODE_COUNT = 6

/** Mean drift speed at strength 1, speed 1 (world units / s). */
const MEAN_SPEED = 0.6

/** Small deterministic PRNG in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

/**
 * Deterministic eddy modes. Four rotate about the vertical (horizontal
 * swirls); two about horizontal axes (gentle vertical rolls, weaker).
 */
export function createCurrentField(seed = 4197) {
  const rand = mulberry32(seed)
  const modes = []
  for (let i = 0; i < CURRENT_MODE_COUNT; i += 1) {
    const horizontalSwirl = i < 4
    const wavelength = 70 + rand() * 130
    const yaw = rand() * Math.PI * 2
    const pitch = (rand() - 0.5) * (horizontalSwirl ? 0.5 : 1.2)
    const kMag = (Math.PI * 2) / wavelength
    const k = [
      Math.cos(yaw) * Math.cos(pitch) * kMag,
      Math.sin(pitch) * kMag,
      Math.sin(yaw) * Math.cos(pitch) * kMag,
    ]
    const axis = horizontalSwirl ? [0, 1, 0] : [Math.cos(yaw + 1.3), 0, Math.sin(yaw + 1.3)]
    const dir = cross(k, axis)
    const len = Math.hypot(...dir) || 1
    const amplitude = (horizontalSwirl ? 0.34 : 0.14) * (0.7 + rand() * 0.6)
    modes.push({
      k,
      a: dir.map((v) => (v / len) * amplitude),
      omega: 0.06 + rand() * 0.13,
      phase: rand() * Math.PI * 2,
    })
  }
  return { seed, modes }
}

/** Mean drift direction × MEAN_SPEED at flow time τ (unit-free of strength). */
export function meanCurrent(flowTime, out = [0, 0, 0]) {
  const t = flowTime
  const yaw = 0.6 + 0.55 * Math.sin(t * 0.0131) + 0.3 * Math.sin(t * 0.00707 + 2.1)
  const rise = 0.07 * Math.sin(t * 0.0193 + 0.4)
  out[0] = Math.cos(yaw) * MEAN_SPEED
  out[1] = rise * MEAN_SPEED
  out[2] = Math.sin(yaw) * MEAN_SPEED
  return out
}

export function createCurrentState() {
  return {
    flowTime: 0,
    /** Integrated mean drift (world units), unbounded. */
    drift: [0, 0, 0],
    /** Current mean velocity (world units / s). */
    mean: [0, 0, 0],
    strength: 1,
    speed: 1,
  }
}

const _mean = [0, 0, 0]

/** Advance the shared current by dt seconds (call once per frame). */
export function advanceCurrent(state, dt, { currentStrength = 1, currentSpeed = 1 } = {}) {
  const step = Math.min(Math.max(dt, 0), 0.1)
  state.strength = currentStrength
  state.speed = currentSpeed
  state.flowTime += step * currentSpeed
  meanCurrent(state.flowTime, _mean)
  const scale = currentStrength * currentSpeed
  for (let i = 0; i < 3; i += 1) {
    state.mean[i] = _mean[i] * scale
    state.drift[i] += state.mean[i] * step
  }
  return state
}

/** World velocity at (x, y, z) — mean drift + eddies (for organisms). */
export function sampleCurrentVelocity(field, state, x, y, z, out = [0, 0, 0]) {
  const scale = state.strength * state.speed
  out[0] = state.mean[0]
  out[1] = state.mean[1]
  out[2] = state.mean[2]
  for (const m of field.modes) {
    const c = Math.cos(m.k[0] * x + m.k[1] * y + m.k[2] * z + m.omega * state.flowTime + m.phase)
    out[0] += m.a[0] * c * scale
    out[1] += m.a[1] * c * scale
    out[2] += m.a[2] * c * scale
  }
  return out
}

/** Eddy displacement at (x, y, z); its time derivative is the eddy velocity. */
export function sampleCurrentDisplacement(field, state, x, y, z, out = [0, 0, 0]) {
  out[0] = 0
  out[1] = 0
  out[2] = 0
  for (const m of field.modes) {
    const s =
      Math.sin(m.k[0] * x + m.k[1] * y + m.k[2] * z + m.omega * state.flowTime + m.phase) /
      m.omega
    out[0] += m.a[0] * s * state.strength
    out[1] += m.a[1] * s * state.strength
    out[2] += m.a[2] * s * state.strength
  }
  return out
}

/** GLSL mirror of sampleCurrentDisplacement (uniform names prefixed uCurrent). */
export const CURRENT_GLSL = /* glsl */ `
uniform vec3 uCurrentK[${CURRENT_MODE_COUNT}];
uniform vec3 uCurrentA[${CURRENT_MODE_COUNT}];
uniform vec2 uCurrentWP[${CURRENT_MODE_COUNT}];
uniform float uCurrentFlowTime;
uniform float uCurrentStrength;

vec3 currentDisplacement(vec3 p) {
  vec3 d = vec3(0.0);
  for (int i = 0; i < ${CURRENT_MODE_COUNT}; i++) {
    float ph = dot(uCurrentK[i], p) + uCurrentWP[i].x * uCurrentFlowTime + uCurrentWP[i].y;
    d += uCurrentA[i] * (sin(ph) / uCurrentWP[i].x);
  }
  return d * uCurrentStrength;
}
`
