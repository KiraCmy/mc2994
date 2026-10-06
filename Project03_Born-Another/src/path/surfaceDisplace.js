/**
 * JS port of Study 03 micro displace + AGE macro morphology + path growth.
 * Used so path samples stay on the same deformed surface as the body shader.
 * Rest positions are on the unit sphere (object space).
 */

import { applyPathGrowth } from './pathGrowth.js'

function fract(x) {
  return x - Math.floor(x)
}

function hash31(x, y, z) {
  let px = fract(x * 0.3183099 + 0.11)
  let py = fract(y * 0.3183099 + 0.17)
  let pz = fract(z * 0.3183099 + 0.23)
  px *= 17
  py *= 17
  pz *= 17
  return fract(px * py * pz * (px + py + pz))
}

function valueNoise(x, y, z) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  const fx0 = x - ix
  const fy0 = y - iy
  const fz0 = z - iz
  const fx = fx0 * fx0 * (3 - 2 * fx0)
  const fy = fy0 * fy0 * (3 - 2 * fy0)
  const fz = fz0 * fz0 * (3 - 2 * fz0)

  const n000 = hash31(ix, iy, iz)
  const n100 = hash31(ix + 1, iy, iz)
  const n010 = hash31(ix, iy + 1, iz)
  const n110 = hash31(ix + 1, iy + 1, iz)
  const n001 = hash31(ix, iy, iz + 1)
  const n101 = hash31(ix + 1, iy, iz + 1)
  const n011 = hash31(ix, iy + 1, iz + 1)
  const n111 = hash31(ix + 1, iy + 1, iz + 1)

  const nx00 = n000 * (1 - fx) + n100 * fx
  const nx10 = n010 * (1 - fx) + n110 * fx
  const nx01 = n001 * (1 - fx) + n101 * fx
  const nx11 = n011 * (1 - fx) + n111 * fx
  const nxy0 = nx00 * (1 - fy) + nx10 * fy
  const nxy1 = nx01 * (1 - fy) + nx11 * fy
  return nxy0 * (1 - fz) + nxy1 * fz
}

function fbm(x, y, z) {
  let sum = 0
  let amp = 0.5
  let px = x
  let py = y
  let pz = z
  for (let i = 0; i < 4; i += 1) {
    sum += amp * valueNoise(px, py, pz)
    px = px * 2.03 + 1.7
    py = py * 2.03 + 9.2
    pz = pz * 2.03 + 2.3
    amp *= 0.5
  }
  return sum
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function normalize3(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / len, v[1] / len, v[2] / len]
}

function macroSeedDir(seed, channel) {
  const s = seed * 0.00137 + channel * 17.23
  return normalize3([
    Math.sin(s * 1.7 + 0.4),
    Math.cos(s * 1.3 + 1.1),
    Math.sin(s * 2.1 + 2.6),
  ])
}

function macroRegion(n, center, width) {
  const d =
    1 -
    Math.max(
      0,
      n[0] * center[0] + n[1] * center[1] + n[2] * center[2],
    )
  const w = Math.max(width, 0.08)
  return Math.exp(-(d * d) / (w * w))
}

/** Seed-locked anisotropic body proportions (volume soft-normalized). */
function macroBodyScale(seed) {
  const ux = Math.sin(seed * 0.0113) * 0.5 + 0.5
  const uy = Math.cos(seed * 0.0147 + 1.7) * 0.5 + 0.5
  const uz = Math.sin(seed * 0.0091 + 2.3) * 0.5 + 0.5
  let sx = 0.9 + (1.12 - 0.9) * ux
  let sy = 0.88 + (1.14 - 0.88) * uy
  let sz = 0.9 + (1.12 - 0.9) * uz
  const vol = Math.max(sx * sy * sz, 1e-4)
  const norm = Math.pow(1 / vol, 1 / 3)
  sx *= norm
  sy *= norm
  sz *= norm
  const overall =
    0.97 + (1.04 - 0.97) * (Math.sin(seed * 0.0077 + 0.9) * 0.5 + 0.5)
  return [sx * overall, sy * overall, sz * overall]
}

/** Seed-locked region radius (falloff width) for channel 0–5. */
function macroRegionWidth(seed, channel) {
  const t =
    Math.sin(seed * (0.041 + channel * 0.013) + channel * 2.17) * 0.5 + 0.5
  const lo = 0.22 + (0.38 - 0.22) * (channel * 0.12)
  const hi = 0.55 + (0.95 - 0.55) * (channel * 0.14)
  return lo + (hi - lo) * t
}

/** Seed-locked signed amplitude for region channel (before dominant boost). */
function macroRegionAmp(seed, channel) {
  const phase = seed * (0.017 + channel * 0.0073) + channel * 1.91
  const unit = Math.sin(phase) * 0.5 + 0.5
  const signBit =
    fract(Math.sin(phase * 1.7 + 0.3) * 43758.5453) >= 0.5 ? 1 : 0
  const mag = 0.28 + (0.62 - 0.28) * unit
  return signBit ? mag : -mag
}

function macroMorphologyOffset(p, age, seed) {
  const a = Math.min(1, Math.max(0, age))
  const rad = Math.hypot(p[0], p[1], p[2]) || 1e-4
  const n = [p[0] / rad, p[1] / rad, p[2] / rad]

  const develop = smoothstep(0.02, 0.28, a) * (1 - smoothstep(0.72, 0.96, a))
  const mature = smoothstep(0.12, 0.4, a) * (1 - smoothstep(0.68, 0.92, a))
  const collapse = smoothstep(0.52, 0.78, a)
  const present = Math.max(develop, mature)

  // Seed-locked active region count in {3,4,5,6}.
  const countUnit = fract(Math.sin(seed * 0.0129 + 4.1) * 43758.5453)
  const regionCount = Math.floor(3 + countUnit * 3.999)

  const c0 = macroSeedDir(seed, 0)
  const c1 = macroSeedDir(seed, 1)
  const c2 = normalize3([
    c0[1] * c1[2] - c0[2] * c1[1] + c1[0] * 0.38 + c0[0] * 0.22,
    c0[2] * c1[0] - c0[0] * c1[2] + c1[1] * 0.38 + c0[1] * 0.22,
    c0[0] * c1[1] - c0[1] * c1[0] + c1[2] * 0.38 + c0[2] * 0.22,
  ])
  const c3 = normalize3([
    c0[0] * -0.55 + c1[0] * 0.35 + c2[0] * 0.75,
    c0[1] * -0.55 + c1[1] * 0.35 + c2[1] * 0.75,
    c0[2] * -0.55 + c1[2] * 0.35 + c2[2] * 0.75,
  ])
  const d4 = macroSeedDir(seed, 4)
  const c4 = normalize3([
    d4[0] * 0.65 + c2[0] * -0.45 + c3[0] * 0.4,
    d4[1] * 0.65 + c2[1] * -0.45 + c3[1] * 0.4,
    d4[2] * 0.65 + c2[2] * -0.45 + c3[2] * 0.4,
  ])
  const d5 = macroSeedDir(seed, 5)
  const c5 = normalize3([
    d5[0] * 0.7 + c0[0] * 0.35 + c3[0] * -0.5,
    d5[1] * 0.7 + c0[1] * 0.35 + c3[1] * -0.5,
    d5[2] * 0.7 + c0[2] * 0.35 + c3[2] * -0.5,
  ])
  const centers = [c0, c1, c2, c3, c4, c5]

  // 1–2 dominant regions get a stronger push/pull.
  const dualDom =
    fract(Math.sin(seed * 0.0211 + 2.6) * 43758.5453) >= 0.42 ? 1 : 0
  let domA = Math.floor(
    fract(Math.sin(seed * 0.0337 + 0.8) * 43758.5453) * regionCount,
  )
  let domB = Math.floor(
    fract(Math.sin(seed * 0.0283 + 5.2) * 43758.5453) * regionCount,
  )
  if (Math.abs(domA - domB) < 0.5) {
    domB = (domA + 1 + Math.floor(regionCount * 0.5)) % regionCount
  }

  const boost = 1.72
  const amps = []
  for (let i = 0; i < 6; i += 1) {
    let amp = macroRegionAmp(seed, i)
    if (i === domA) amp *= 1 + boost
    if (dualDom && i === domB) amp *= 1 + boost
    if (i >= regionCount) amp = 0
    amps.push(amp)
  }

  let coverage = 0
  let radial = 0
  for (let i = 0; i < 6; i += 1) {
    if (i >= regionCount) continue
    const r = macroRegion(n, centers[i], macroRegionWidth(seed, i))
    coverage += r
    radial += r * amps[i]
  }

  const slow = valueNoise(
    n[0] * 0.35 + seed * 0.061,
    n[1] * 0.35 + 0.27,
    n[2] * 0.35 + 1.4,
  )
  const slow2 = valueNoise(
    n[0] * 0.22 + 1.9,
    n[1] * 0.22 + seed * 0.044,
    n[2] * 0.22 + 0.55,
  )
  let mass = (slow - 0.5) * 0.16 + (slow2 - 0.5) * 0.1
  const calmGate = smoothstep(0.08, 0.45, coverage)
  mass *= 0.25 + (1 - 0.25) * calmGate

  const along = n[0] * c0[0] + n[1] * c0[1] + n[2] * c0[2]
  const developOffset = [
    (c0[0] * (along * 0.32 + (slow - 0.5) * 0.08) +
      n[0] * (radial * 0.38 + mass * 0.35) +
      c1[0] * (slow2 - 0.5) * 0.06) *
      develop,
    (c0[1] * (along * 0.32 + (slow - 0.5) * 0.08) +
      n[1] * (radial * 0.38 + mass * 0.35) +
      c1[1] * (slow2 - 0.5) * 0.06) *
      develop,
    (c0[2] * (along * 0.32 + (slow - 0.5) * 0.08) +
      n[2] * (radial * 0.38 + mass * 0.35) +
      c1[2] * (slow2 - 0.5) * 0.06) *
      develop,
  ]

  const matureOffset = [
    (n[0] * (radial * 0.88 + mass * 0.75) +
      (c1[0] * (slow - 0.42) * 0.1 + c2[0] * (slow2 - 0.5) * 0.08) +
      c0[0] * along * 0.08) *
      mature,
    (n[1] * (radial * 0.88 + mass * 0.75) +
      (c1[1] * (slow - 0.42) * 0.1 + c2[1] * (slow2 - 0.5) * 0.08) +
      c0[1] * along * 0.08) *
      mature,
    (n[2] * (radial * 0.88 + mass * 0.75) +
      (c1[2] * (slow - 0.42) * 0.1 + c2[2] * (slow2 - 0.5) * 0.08) +
      c0[2] * along * 0.08) *
      mature,
  ]

  const shellOffset = [
    n[0] * mass * 0.45 * present,
    n[1] * mass * 0.45 * present,
    n[2] * mass * 0.45 * present,
  ]

  const hollow =
    1 -
    Math.max(radial, 0) * 0.45 +
    Math.max(-radial, 0) * 0.55 +
    (slow - 0.5) * 0.4
  const crush = Math.pow(Math.min(1.5, Math.max(0, hollow)), 1.2)
  const collapseOffset = [
    (-n[0] * crush * 0.32 -
      c0[0] * (slow2 - 0.5) * 0.1 +
      c1[0] * (slow - 0.5) * 0.07) *
      collapse,
    (-n[1] * crush * 0.32 -
      c0[1] * (slow2 - 0.5) * 0.1 +
      c1[1] * (slow - 0.5) * 0.07) *
      collapse,
    (-n[2] * crush * 0.32 -
      c0[2] * (slow2 - 0.5) * 0.1 +
      c1[2] * (slow - 0.5) * 0.07) *
      collapse,
  ]

  const localOffset = [
    developOffset[0] + matureOffset[0] + shellOffset[0] + collapseOffset[0],
    developOffset[1] + matureOffset[1] + shellOffset[1] + collapseOffset[1],
    developOffset[2] + matureOffset[2] + shellOffset[2] + collapseOffset[2],
  ]
  const bodyScale = macroBodyScale(seed)
  return [
    (p[0] + localOffset[0]) * bodyScale[0] - p[0],
    (p[1] + localOffset[1]) * bodyScale[1] - p[1],
    (p[2] + localOffset[2]) * bodyScale[2] - p[2],
  ]
}

function formField(p, time, seed, noiseScale, speed) {
  const moving = fbm(
    p[0] * noiseScale,
    p[1] * noiseScale + time * speed,
    p[2] * noiseScale + seed * 0.137,
  )
  const detail = fbm(
    p[0] * noiseScale * 2.35 + time * speed * 0.7,
    p[1] * noiseScale * 2.35 + seed * 0.29,
    p[2] * noiseScale * 2.35 + 1.7,
  )
  const ridges = fbm(
    p[0] * noiseScale * 0.55 + seed * 0.08,
    p[1] * noiseScale * 0.55 + 4.1,
    p[2] * noiseScale * 0.55 + time * speed * 0.22,
  )
  return (moving * 2 - 1) * 0.7 + (detail * 2 - 1) * 0.45 + (ridges * 2 - 1) * 0.35
}

function developmentDisplaceAmount(p, uniforms) {
  const {
    time,
    age,
    seed,
    noiseScale,
    speed,
    pulseSpeed,
    displacement,
    noiseAmount,
  } = uniforms
  const pulse = Math.sin(time * pulseSpeed + seed * 0.01) * 0.5 + 0.5
  const lifeEnvelope = smoothstep(0, 0.1, age) * (1 - smoothstep(0.88, 1, age))
  const noiseGain = 0.85 + Math.min(1, Math.max(0, noiseAmount * 0.5)) * (2.1 - 0.85)
  const field = formField(p, time, seed, noiseScale, speed)
  // Secondary surface variation — macro regions own the silhouette.
  return (field * 0.42 + (pulse - 0.5) * 0.1) * displacement * lifeEnvelope * noiseGain
}

/**
 * Map a rest sample on the unit sphere to the deformed body surface.
 * Returns { position, normal } in object space.
 */
export function deformRestPoint(rest, uniforms, surfaceOffset = 0) {
  const offset = macroMorphologyOffset(rest, uniforms.age, uniforms.seed)
  const macroPos = [rest[0] + offset[0], rest[1] + offset[1], rest[2] + offset[2]]
  const restN = normalize3(rest)

  // Finite-difference macro normal (matches shader).
  const e = 0.07
  const up = Math.abs(restN[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const t = normalize3([
    restN[1] * up[2] - restN[2] * up[1],
    restN[2] * up[0] - restN[0] * up[2],
    restN[0] * up[1] - restN[1] * up[0],
  ])
  const b = normalize3([
    restN[1] * t[2] - restN[2] * t[1],
    restN[2] * t[0] - restN[0] * t[2],
    restN[0] * t[1] - restN[1] * t[0],
  ])
  const c = macroPos
  const oT = macroMorphologyOffset(
    [rest[0] + t[0] * e, rest[1] + t[1] * e, rest[2] + t[2] * e],
    uniforms.age,
    uniforms.seed,
  )
  const oB = macroMorphologyOffset(
    [rest[0] + b[0] * e, rest[1] + b[1] * e, rest[2] + b[2] * e],
    uniforms.age,
    uniforms.seed,
  )
  const pT = [
    rest[0] + t[0] * e + oT[0],
    rest[1] + t[1] * e + oT[1],
    rest[2] + t[2] * e + oT[2],
  ]
  const pB = [
    rest[0] + b[0] * e + oB[0],
    rest[1] + b[1] * e + oB[1],
    rest[2] + b[2] * e + oB[2],
  ]
  let macroN = normalize3([
    (pT[1] - c[1]) * (pB[2] - c[2]) - (pT[2] - c[2]) * (pB[1] - c[1]),
    (pT[2] - c[2]) * (pB[0] - c[0]) - (pT[0] - c[0]) * (pB[2] - c[2]),
    (pT[0] - c[0]) * (pB[1] - c[1]) - (pT[1] - c[1]) * (pB[0] - c[0]),
  ])
  if (macroN[0] * restN[0] + macroN[1] * restN[1] + macroN[2] * restN[2] < 0) {
    macroN = [-macroN[0], -macroN[1], -macroN[2]]
  }

  const amount = developmentDisplaceAmount(macroPos, uniforms)
  let position = [
    macroPos[0] + macroN[0] * amount,
    macroPos[1] + macroN[1] * amount,
    macroPos[2] + macroN[2] * amount,
  ]

  // Path growth swell (same field as the body shader), then optional ribbon lift.
  position = applyPathGrowth(
    rest,
    position,
    macroN,
    uniforms.pathPoints,
    uniforms.pathGrowthStrength,
    uniforms.pathGrowthRadius,
    uniforms.pathPointProgress,
  )
  if (surfaceOffset) {
    position = [
      position[0] + macroN[0] * surfaceOffset,
      position[1] + macroN[1] * surfaceOffset,
      position[2] + macroN[2] * surfaceOffset,
    ]
  }
  return { position, normal: macroN }
}

/** Ray ↔ unit sphere at origin. Returns rest [x,y,z] or null. */
export function raycastUnitSphere(origin, direction) {
  const ox = origin.x
  const oy = origin.y
  const oz = origin.z
  const dx = direction.x
  const dy = direction.y
  const dz = direction.z
  const a = dx * dx + dy * dy + dz * dz
  const b = 2 * (ox * dx + oy * dy + oz * dz)
  const c = ox * ox + oy * oy + oz * oz - 1
  const disc = b * b - 4 * a * c
  if (disc < 0 || a < 1e-12) return null
  const sqrtD = Math.sqrt(disc)
  let t = (-b - sqrtD) / (2 * a)
  if (t < 1e-4) t = (-b + sqrtD) / (2 * a)
  if (t < 1e-4) return null
  const x = ox + dx * t
  const y = oy + dy * t
  const z = oz + dz * t
  const len = Math.hypot(x, y, z) || 1
  return [x / len, y / len, z / len]
}
