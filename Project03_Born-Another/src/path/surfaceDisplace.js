/**
 * JS port of Study 03 micro displace + AGE macro morphology.
 * Used so path samples stay on the same deformed surface as the body shader.
 * Rest positions are on the unit sphere (object space).
 */

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

function macroSoftLobe(n, axis, power) {
  const d = n[0] * axis[0] + n[1] * axis[1] + n[2] * axis[2]
  return Math.pow(Math.max(0, d), power)
}

function macroMorphologyOffset(p, age, seed) {
  const a = Math.min(1, Math.max(0, age))
  const rad = Math.hypot(p[0], p[1], p[2]) || 1e-4
  const n = [p[0] / rad, p[1] / rad, p[2] / rad]

  const develop = smoothstep(0.02, 0.3, a) * (1 - smoothstep(0.7, 0.95, a))
  const mature = smoothstep(0.2, 0.48, a) * (1 - smoothstep(0.65, 0.9, a))
  const collapse = smoothstep(0.52, 0.78, a)

  const axisA = macroSeedDir(seed, 0)
  const axisB = macroSeedDir(seed, 1)
  const axisC = normalize3([
    axisA[1] * axisB[2] - axisA[2] * axisB[1] + axisB[0] * 0.42 + axisA[0] * 0.18,
    axisA[2] * axisB[0] - axisA[0] * axisB[2] + axisB[1] * 0.42 + axisA[1] * 0.18,
    axisA[0] * axisB[1] - axisA[1] * axisB[0] + axisB[2] * 0.42 + axisA[2] * 0.18,
  ])

  const slow = valueNoise(n[0] * 1.05 + seed * 0.061, n[1] * 1.05 + 0.27, n[2] * 1.05 + 1.4)
  const slow2 = valueNoise(n[0] * 0.72 + 1.9, n[1] * 0.72 + seed * 0.044, n[2] * 0.72 + 0.55)

  const along = n[0] * axisA[0] + n[1] * axisA[1] + n[2] * axisA[2]
  const developOffset = [
    (axisA[0] * (along * 0.11 + (slow - 0.5) * 0.04) + n[0] * (slow2 - 0.5) * 0.035) * develop,
    (axisA[1] * (along * 0.11 + (slow - 0.5) * 0.04) + n[1] * (slow2 - 0.5) * 0.035) * develop,
    (axisA[2] * (along * 0.11 + (slow - 0.5) * 0.04) + n[2] * (slow2 - 0.5) * 0.035) * develop,
  ]

  const w1 = 0.5 + 0.2 * Math.sin(seed * 0.019)
  const w2 = 0.4 + 0.2 * Math.cos(seed * 0.023)
  const w3 = 0.32 + 0.18 * Math.sin(seed * 0.029 + 1.2)
  const lobe =
    macroSoftLobe(n, axisA, 2.15) * w1 +
    macroSoftLobe(n, axisB, 2.35) * w2 +
    macroSoftLobe(n, axisC, 2.55) * w3

  const matureOffset = [
    (n[0] * lobe * 0.24 +
      (axisB[0] * (slow - 0.42) * 0.05 + axisC[0] * (slow2 - 0.5) * 0.04)) *
      mature,
    (n[1] * lobe * 0.24 +
      (axisB[1] * (slow - 0.42) * 0.05 + axisC[1] * (slow2 - 0.5) * 0.04)) *
      mature,
    (n[2] * lobe * 0.24 +
      (axisB[2] * (slow - 0.42) * 0.05 + axisC[2] * (slow2 - 0.5) * 0.04)) *
      mature,
  ]

  const hollow = 1 - lobe * 0.55 + (slow - 0.5) * 0.45
  const crush = Math.pow(Math.min(1.4, Math.max(0, hollow)), 1.35)
  const collapseOffset = [
    (-n[0] * crush * 0.2 -
      axisA[0] * (slow2 - 0.5) * 0.07 +
      axisB[0] * (slow - 0.5) * 0.045) *
      collapse,
    (-n[1] * crush * 0.2 -
      axisA[1] * (slow2 - 0.5) * 0.07 +
      axisB[1] * (slow - 0.5) * 0.045) *
      collapse,
    (-n[2] * crush * 0.2 -
      axisA[2] * (slow2 - 0.5) * 0.07 +
      axisB[2] * (slow - 0.5) * 0.045) *
      collapse,
  ]

  return [
    developOffset[0] + matureOffset[0] + collapseOffset[0],
    developOffset[1] + matureOffset[1] + collapseOffset[1],
    developOffset[2] + matureOffset[2] + collapseOffset[2],
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
  return (field * 0.92 + (pulse - 0.5) * 0.18) * displacement * lifeEnvelope * noiseGain
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
  const e = 0.045
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
  const position = [
    macroPos[0] + macroN[0] * (amount + surfaceOffset),
    macroPos[1] + macroN[1] * (amount + surfaceOffset),
    macroPos[2] + macroN[2] * (amount + surfaceOffset),
  ]
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
