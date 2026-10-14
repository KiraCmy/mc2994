import { deformRestPoint } from '../path/surfaceDisplace.js'
import {
  LSYSTEM_CONTACT_CLEARANCE,
  LSYSTEM_CURVE_DIVISIONS,
  LSYSTEM_GROWTH_LAG,
  LSYSTEM_CURVE_TENSION,
  LSYSTEM_DISPLAY_REST_STEP,
  LSYSTEM_MICRO_STEP,
  LSYSTEM_ORIGIN_COUNT,
  LSYSTEM_RAYS_PER_SITE,
  LSYSTEM_SURFACE_LENGTH_SCALE,
} from './lsystemParams.js'

function mulberry32(seed) {
  let t = seed >>> 0
  return function next() {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function jitter(rand, amount) {
  if (amount <= 1e-6) return 0
  return (rand() * 2 - 1) * amount
}

function len3(v) {
  return Math.hypot(v[0], v[1], v[2]) || 1
}

function normalize3(v) {
  const L = len3(v)
  return [v[0] / L, v[1] / L, v[2] / L]
}

function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x))
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function projectTangent(v, n) {
  const d = dot3(v, n)
  const out = [v[0] - n[0] * d, v[1] - n[1] * d, v[2] - n[2] * d]
  const L = len3(out)
  if (L < 1e-8) {
    const axis = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
    return normalize3(cross3(n, axis))
  }
  return [out[0] / L, out[1] / L, out[2] / L]
}

function rotateAround(v, axis, radians) {
  const c = Math.cos(radians)
  const s = Math.sin(radians)
  const d = dot3(v, axis)
  const ax = cross3(axis, v)
  return [
    v[0] * c + ax[0] * s + axis[0] * d * (1 - c),
    v[1] * c + ax[1] * s + axis[1] * d * (1 - c),
    v[2] * c + ax[2] * s + axis[2] * d * (1 - c),
  ]
}

function stepOnSphere(pos, heading, arc) {
  const a = Math.max(1e-5, arc)
  const c = Math.cos(a)
  const s = Math.sin(a)
  const next = normalize3([
    pos[0] * c + heading[0] * s,
    pos[1] * c + heading[1] * s,
    pos[2] * c + heading[2] * s,
  ])
  const nextHeading = projectTangent(
    [
      -pos[0] * s + heading[0] * c,
      -pos[1] * s + heading[1] * c,
      -pos[2] * s + heading[2] * c,
    ],
    next,
  )
  return { pos: next, heading: nextHeading }
}

function initialHeading(pos, rand) {
  const axis = Math.abs(pos[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  let heading = projectTangent(cross3(pos, axis), pos)
  heading = normalize3(rotateAround(heading, pos, rand() * Math.PI * 2))
  return heading
}

function blendHeading(heading, prefer, amount) {
  const t = clamp(amount, 0, 1)
  return normalize3([
    heading[0] * (1 - t) + prefer[0] * t,
    heading[1] * (1 - t) + prefer[1] * t,
    heading[2] * (1 - t) + prefer[2] * t,
  ])
}

function slerpRest(a, b, t) {
  const A = normalize3(a)
  const B = normalize3(b)
  const dot = clamp(dot3(A, B), -1, 1)
  if (dot > 0.9995) {
    return normalize3([
      A[0] + (B[0] - A[0]) * t,
      A[1] + (B[1] - A[1]) * t,
      A[2] + (B[2] - A[2]) * t,
    ])
  }
  const omega = Math.acos(dot)
  const so = Math.sin(omega)
  const s0 = Math.sin((1 - t) * omega) / so
  const s1 = Math.sin(t * omega) / so
  return normalize3([
    A[0] * s0 + B[0] * s1,
    A[1] * s0 + B[1] * s1,
    A[2] * s0 + B[2] * s1,
  ])
}

function densifyRestPolyline(restPoints, maxStep = LSYSTEM_DISPLAY_REST_STEP) {
  if (!restPoints || restPoints.length < 2) {
    return restPoints ? restPoints.map((p) => normalize3(p)) : []
  }
  const out = [normalize3(restPoints[0])]
  const step = Math.max(0.006, maxStep)
  for (let i = 1; i < restPoints.length; i += 1) {
    const a = out[out.length - 1]
    const b = normalize3(restPoints[i])
    const ang = Math.acos(clamp(dot3(a, b), -1, 1))
    const n = Math.max(1, Math.ceil(ang / step))
    for (let k = 1; k <= n; k += 1) {
      out.push(slerpRest(a, b, k / n))
    }
  }
  return out
}

function smoothRestPolyline(restPoints, divisions, tension) {
  if (!restPoints || restPoints.length < 2) {
    return restPoints ? restPoints.map((p) => [...p]) : []
  }
  if (restPoints.length === 2 || divisions <= 1) {
    return restPoints.map((p) => normalize3(p))
  }

  const pts = restPoints.map((p) => normalize3(p))
  const out = []
  const segs = pts.length - 1
  const per = Math.max(1, Math.round(divisions))

  for (let i = 0; i < segs; i += 1) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const count = i === segs - 1 ? per + 1 : per
    for (let k = 0; k < count; k += 1) {
      const t = k / per
      const t2 = t * t
      const t3 = t2 * t
      const s = (1 - tension) * 0.5
      const c0 = -s * t3 + 2 * s * t2 - s * t
      const c1 = (2 - s) * t3 + (s - 3) * t2 + 1
      const c2 = (s - 2) * t3 + (3 - 2 * s) * t2 + s * t
      const c3 = s * t3 - s * t2
      out.push(
        normalize3([
          c0 * p0[0] + c1 * p1[0] + c2 * p2[0] + c3 * p3[0],
          c0 * p0[1] + c1 * p1[1] + c2 * p2[1] + c3 * p3[1],
          c0 * p0[2] + c1 * p1[2] + c2 * p2[2] + c3 * p3[2],
        ]),
      )
    }
  }
  return out
}

function makeUniforms({
  time = 0,
  age,
  seed,
  noiseScale,
  speed,
  pulseSpeed,
  displacement,
  noiseAmount,
  decayScale,
  decayDisplacement,
  lateWarp,
}) {
  return {
    time: Number(time) || 0,
    age: Number(age) || 0,
    seed: Number(seed) || 1,
    noiseScale: noiseScale ?? 2.8,
    speed: speed ?? 0.32,
    pulseSpeed: pulseSpeed ?? 1.1,
    displacement: displacement ?? 0.22,
    noiseAmount: noiseAmount ?? 1.55,
    decayScale: decayScale ?? 1.35,
    decayDisplacement: decayDisplacement ?? 0.055,
    lateWarp: lateWarp ?? 1,
    pathPoints: null,
    pathGrowthStrength: 0,
    pathGrowthRadius: 0.32,
    pathPointProgress: null,
  }
}

/**
 * Centers of the vein units: an even Fibonacci spread with a seeded rotation
 * and jitter, then turned so unit 0 faces the default camera axis (+Z).
 */
function pickUnitCenters(count, seed) {
  const n = clamp(Math.round(count), 1, 24)
  const rand = mulberry32((Math.floor(seed) || 1) ^ 0xc0ffee)
  if (n === 1) return [[0, 0, 1]]
  const golden = Math.PI * (3 - Math.sqrt(5))
  const axis = normalize3([rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1])
  const turn = rand() * Math.PI * 2
  const spread = Math.sqrt((4 * Math.PI) / n)
  const centers = []
  for (let i = 0; i < n; i += 1) {
    const y = 1 - ((i + 0.5) / n) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    let p = normalize3(rotateAround([Math.cos(golden * i) * r, y, Math.sin(golden * i) * r], axis, turn))
    const t = initialHeading(p, rand)
    p = normalize3(rotateAround(p, normalize3(cross3(p, t)), (rand() - 0.5) * spread * 0.25))
    centers.push(p)
  }
  const c0 = centers[0]
  const toZ = cross3(c0, [0, 0, 1])
  const sinA = Math.hypot(toZ[0], toZ[1], toZ[2])
  if (sinA < 1e-6) return centers
  const ang = Math.atan2(sinA, c0[2])
  const k = normalize3(toZ)
  return centers.map((p) => normalize3(rotateAround(p, k, ang)))
}

/** Rest-space spatial hash of grown vein knots, for branch-to-branch contact. */
function createOccupancy(cell) {
  const map = new Map()
  const keyOf = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`
  return {
    add(p, branchId) {
      const k = keyOf(p[0], p[1], p[2])
      let list = map.get(k)
      if (!list) {
        list = []
        map.set(k, list)
      }
      list.push(p[0], p[1], p[2], branchId)
    },
    // True when p is within `radius` of a knot not owned by `ignoreA`/`ignoreB`
    // and outside the tip's own start neighbourhood.
    hits(p, radius, ignoreA, ignoreB, start, startRadius) {
      const cx = Math.floor(p[0] / cell)
      const cy = Math.floor(p[1] / cell)
      const cz = Math.floor(p[2] / cell)
      const r2 = radius * radius
      const s2 = startRadius * startRadius
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dz = -1; dz <= 1; dz += 1) {
            const list = map.get(`${cx + dx},${cy + dy},${cz + dz}`)
            if (!list) continue
            for (let i = 0; i < list.length; i += 4) {
              const id = list[i + 3]
              if (id === ignoreA || id === ignoreB) continue
              const qx = list[i]
              const qy = list[i + 1]
              const qz = list[i + 2]
              const ex = qx - p[0]
              const ey = qy - p[1]
              const ez = qz - p[2]
              if (ex * ex + ey * ey + ez * ez > r2) continue
              const sx = qx - start[0]
              const sy = qy - start[1]
              const sz = qz - start[2]
              if (sx * sx + sy * sy + sz * sz < s2) continue
              return true
            }
          }
        }
      }
      return false
    },
  }
}

/**
 * A growing vein tip on the rest sphere. Laterals are planned at distributed
 * positions along the run (never at the start point), alternate sides, leave
 * nearly parallel to this vein, then curve away toward their own side.
 * `startDist` is the rest-arc distance from the unit hub (growth timing).
 */
function createTip({
  id,
  parentId = -1,
  startRest,
  startHeading,
  totalArc,
  nest,
  maxNest,
  lateralCount,
  leaveAngle,
  leaveSide = 1,
  curvature,
  amp,
  seed,
  ds,
  width0 = 1,
  startDist = 0,
  lagArc = 0,
}) {
  const rand = mulberry32(Math.floor(seed) || 1)
  const arc = Math.max(ds * 4, totalArc)
  const rest = normalize3(startRest)
  const leaveTarget = nest > 0 ? leaveAngle * (0.75 + rand() * 0.5) * leaveSide : 0

  const planned = []
  if (nest < maxNest && lateralCount > 0) {
    const a0 = nest === 0 ? 0.14 : 0.22
    const a1 = 0.86
    const slot = (a1 - a0) / lateralCount
    for (let i = 0; i < lateralCount; i += 1) {
      const u = a0 + slot * (i + 0.5) + jitter(rand, slot * 0.3 * (0.3 + amp))
      planned.push(arc * clamp(u, a0, a1))
    }
  }

  return {
    id,
    parentId,
    rand,
    arc,
    nest,
    leaveAngle,
    leaveTarget,
    curvature,
    seed,
    width0,
    startDist,
    // Matches the shader growth front, where each nest level starts later.
    delay: startDist + nest * lagArc,
    start: rest,
    rest,
    heading: projectTangent(startHeading, rest),
    planned,
    nextIdx: 0,
    side: rand() < 0.5 ? 1 : -1,
    points: [rest.slice()],
    traveled: 0,
    alive: true,
  }
}

function finishTip(tip, out) {
  tip.alive = false
  if (tip.points.length < 2) return
  out.push({
    points: tip.points,
    nest: tip.nest,
    width0: tip.width0,
    startDist: tip.startDist,
    smoothed: densifyRestPolyline(
      smoothRestPolyline(tip.points, LSYSTEM_CURVE_DIVISIONS, LSYSTEM_CURVE_TENSION),
      LSYSTEM_DISPLAY_REST_STEP,
    ),
  })
}

/**
 * Radial vein units in rest (unit-sphere) space: each hub sends primaries out
 * in different directions, secondaries spaced along them, tertiaries along
 * secondaries. All tips grow together in time; a tip stops for good when it
 * reaches another branch, so neighbouring branches and units never overlap.
 * Deterministic for a given SEED + shape params; independent of AGE and time.
 * Widths are relative (primary root = 1); Base Thickness scales them in the shader.
 */
export function buildVeinTopology({
  depth,
  angle,
  length,
  branchRotation,
  randomness,
  seed,
  childThicknessRatio = 0.4,
  taperStrength = 0.6,
  originCount = LSYSTEM_ORIGIN_COUNT,
  raysPerSite = LSYSTEM_RAYS_PER_SITE,
} = {}) {
  const rngSeed = Math.floor(Number(seed) || 1) || 1
  const amp = Math.min(1, Math.max(0, randomness))
  const centers = pickUnitCenters(originCount, rngSeed)
  const sites = []
  const branches = []

  const primaryArc = Math.max(0.3, length * LSYSTEM_SURFACE_LENGTH_SCALE)
  const depthN = Math.max(1, Math.min(5, Math.round(depth)))
  const maxNest = Math.min(3, depthN - 1)
  const leaveAngle = ((angle * 0.9 + 6) * Math.PI) / 180
  const curvature = 0.05 + amp * 0.1
  const childRatio = clamp(childThicknessRatio, 0.12, 0.85)
  const taperExp = 0.35 + clamp(taperStrength, 0, 1) * 2.15
  const primaryLaterals = lerp(10, 3, clamp(branchRotation / 180, 0, 1))
  const ds = Math.max(0.008, LSYSTEM_MICRO_STEP)
  const lagArc = LSYSTEM_GROWTH_LAG * primaryArc
  const occupancy = createOccupancy(LSYSTEM_CONTACT_CLEARANCE)
  const startRadius = LSYSTEM_CONTACT_CLEARANCE * 2.5

  let nextId = 0
  const tips = []
  for (let s = 0; s < centers.length; s += 1) {
    const siteRand = mulberry32((rngSeed + Math.imul(s + 1, 2654435761)) >>> 0)
    const siteSeed = (rngSeed + Math.imul(s + 9, 1597334677)) >>> 0
    const c = centers[s]
    const spokes = clamp(Math.round(raysPerSite + jitter(siteRand, 1.2)), 3, 9)
    const baseHeading = initialHeading(c, siteRand)
    const slot = (Math.PI * 2) / spokes
    sites.push(c)

    for (let r = 0; r < spokes; r += 1) {
      const heading = normalize3(
        rotateAround(baseHeading, c, slot * r + jitter(siteRand, slot * 0.22 * (0.3 + amp))),
      )
      tips.push(
        createTip({
          id: nextId++,
          startRest: c,
          startHeading: heading,
          totalArc: primaryArc * (0.85 + siteRand() * 0.3),
          nest: 0,
          maxNest,
          lateralCount:
            maxNest === 0 ? 0 : Math.max(2, Math.round(primaryLaterals + jitter(siteRand, 1))),
          leaveAngle,
          curvature,
          amp,
          seed: (siteSeed + r * 9973) >>> 0,
          ds,
          width0: 1,
          startDist: 0,
          lagArc,
        }),
      )
      occupancy.add(c, tips[tips.length - 1].id)
    }
  }

  // Every tip advances one micro step per tick once its growth time arrives,
  // so whichever branch reaches a spot first claims it.
  for (let tick = 0, active = tips.length; active > 0; tick += 1) {
    const now = tick * ds
    const count = tips.length
    active = 0
    for (let i = 0; i < count; i += 1) {
      const tip = tips[i]
      if (!tip.alive) continue
      active += 1
      if (tip.delay > now) continue

      const take = Math.min(ds, tip.arc - tip.traveled)
      const along = tip.traveled / tip.arc
      const wander = tip.nest === 0 ? 0.5 : 1
      let heading = normalize3(
        rotateAround(tip.heading, tip.rest, jitter(tip.rand, tip.curvature * wander * (0.3 + amp * 0.7))),
      )
      if (tip.nest > 0) {
        heading = normalize3(
          rotateAround(heading, tip.rest, tip.leaveTarget * (ds / tip.arc) * (0.8 + along * 2.4)),
        )
      }
      heading = projectTangent(heading, tip.rest)
      const walked = stepOnSphere(tip.rest, heading, take)

      if (
        occupancy.hits(
          walked.pos,
          LSYSTEM_CONTACT_CLEARANCE,
          tip.id,
          tip.parentId,
          tip.start,
          startRadius,
        )
      ) {
        finishTip(tip, branches)
        continue
      }

      tip.rest = walked.pos
      tip.heading = walked.heading
      tip.points.push(walked.pos.slice())
      tip.traveled += take
      occupancy.add(walked.pos, tip.id)

      while (tip.nextIdx < tip.planned.length && tip.traveled >= tip.planned[tip.nextIdx]) {
        const parentAlong = tip.traveled / tip.arc
        const depart =
          tip.leaveAngle * 0.4 * tip.side + jitter(tip.rand, amp * tip.leaveAngle * 0.1)
        let childHeading = normalize3(rotateAround(tip.heading, tip.rest, depart))
        childHeading = projectTangent(blendHeading(childHeading, tip.heading, 0.25), tip.rest)
        const childArc =
          tip.arc *
          (tip.nest === 0 ? 0.42 : 0.5) *
          (1 - 0.55 * parentAlong) *
          (0.8 + tip.rand() * 0.4)
        const parentWidthHere =
          tip.width0 * Math.pow(Math.max(1e-4, 1 - parentAlong), taperExp)
        const childLaterals =
          tip.nest + 1 < maxNest
            ? Math.max(1, Math.round(2 + depthN * 0.35 + jitter(tip.rand, 0.8)))
            : 0

        tips.push(
          createTip({
            id: nextId++,
            parentId: tip.id,
            startRest: tip.rest,
            startHeading: childHeading,
            totalArc: Math.max(ds * 4, childArc),
            nest: tip.nest + 1,
            maxNest,
            lateralCount: childLaterals,
            leaveAngle: tip.leaveAngle * 0.9,
            leaveSide: tip.side,
            curvature: tip.curvature * 1.1,
            amp,
            seed: (Math.floor(tip.seed) + (tip.nextIdx + 1) * 7919 + tip.nest * 104729) >>> 0,
            ds,
            width0: parentWidthHere * childRatio,
            startDist: tip.startDist + tip.traveled,
            lagArc,
          }),
        )
        tip.nextIdx += 1
        if (tip.rand() > 0.12 * amp) tip.side *= -1
      }

      if (tip.traveled >= tip.arc - 1e-6) finishTip(tip, branches)
    }
  }

  return { branches, sites }
}

/**
 * Static rest-space ribbon: one quad per segment so each segment can drop out
 * independently during decay. The vertex shader deforms it with the body.
 *
 * Attributes:
 *   position  rest point on the unit sphere
 *   aTangent  rest tangent along the vein
 *   aInfo     side (±1), along (0..1 within branch), dist (0..1 from hub), hash
 *   aBranch   relative width0, nest level
 */
export function buildVeinRibbonAttributes(branches, seed) {
  const runs = []
  let maxDist = 1e-6

  for (let b = 0; b < branches.length; b += 1) {
    const branch = branches[b]
    const pts = branch.smoothed
    if (!pts || pts.length < 2) continue
    const cum = [0]
    for (let i = 1; i < pts.length; i += 1) {
      cum.push(cum[i - 1] + Math.acos(clamp(dot3(pts[i - 1], pts[i]), -1, 1)))
    }
    const total = cum[cum.length - 1] || 1e-6
    maxDist = Math.max(maxDist, (branch.startDist ?? 0) + total)
    runs.push({ branch, pts, cum, total, index: b })
  }

  let segCount = 0
  for (let r = 0; r < runs.length; r += 1) segCount += runs[r].pts.length - 1

  const position = new Float32Array(segCount * 4 * 3)
  const tangent = new Float32Array(segCount * 4 * 3)
  const info = new Float32Array(segCount * 4 * 4)
  const branchAttr = new Float32Array(segCount * 4 * 2)
  const index = new Uint32Array(segCount * 6)
  const rand = mulberry32(((Math.floor(Number(seed) || 1) || 1) ^ 0x5bd1e995) >>> 0)

  let v = 0
  let k = 0
  for (let r = 0; r < runs.length; r += 1) {
    const { branch, pts, cum, total } = runs[r]
    const n = pts.length
    const tangents = new Array(n)
    for (let i = 0; i < n; i += 1) {
      const a = pts[Math.max(0, i - 1)]
      const c = pts[Math.min(n - 1, i + 1)]
      tangents[i] = projectTangent([c[0] - a[0], c[1] - a[1], c[2] - a[2]], pts[i])
    }
    const startDist = branch.startDist ?? 0
    const width0 = branch.width0 ?? 1
    const nest = branch.nest ?? 0

    // Chunked hash so decay breaks veins into short pieces, not single quads.
    let chunkHash = rand()
    let chunkLeft = 2 + Math.floor(rand() * 4)

    for (let i = 0; i < n - 1; i += 1) {
      if (chunkLeft <= 0) {
        chunkHash = rand()
        chunkLeft = 2 + Math.floor(rand() * 4)
      }
      chunkLeft -= 1

      const base = v
      for (let e = 0; e < 2; e += 1) {
        const pi = i + e
        const p = pts[pi]
        const t = tangents[pi]
        const along = cum[pi] / total
        const dist = (startDist + cum[pi]) / maxDist
        for (let sIdx = 0; sIdx < 2; sIdx += 1) {
          const side = sIdx === 0 ? -1 : 1
          position.set(p, v * 3)
          tangent.set(t, v * 3)
          info[v * 4] = side
          info[v * 4 + 1] = along
          info[v * 4 + 2] = dist
          info[v * 4 + 3] = chunkHash
          branchAttr[v * 2] = width0
          branchAttr[v * 2 + 1] = nest
          v += 1
        }
      }
      index[k] = base
      index[k + 1] = base + 2
      index[k + 2] = base + 1
      index[k + 3] = base + 1
      index[k + 4] = base + 2
      index[k + 5] = base + 3
      k += 6
    }
  }

  return { position, tangent, info, branch: branchAttr, index, segments: segCount }
}

/** CPU knots + normals on the deformed surface, for the debug overlay only. */
export function buildVeinDebugSamples(branches, uniformInputs) {
  const uniforms = makeUniforms(uniformInputs)
  const points = []
  const normals = []
  for (let b = 0; b < branches.length; b += 1) {
    if ((branches[b].nest ?? 0) !== 0) continue
    const knots = branches[b].points
    const stride = Math.max(1, Math.floor(knots.length / 6))
    for (let i = 0; i < knots.length; i += stride) {
      const hit = deformRestPoint(knots[i], uniforms, 0)
      const p = hit.position
      const nn = hit.normal
      points.push(p[0], p[1], p[2])
      normals.push(p[0], p[1], p[2], p[0] + nn[0] * 0.1, p[1] + nn[1] * 0.1, p[2] + nn[2] * 0.1)
    }
  }
  return {
    points: new Float32Array(points),
    normals: new Float32Array(normals),
  }
}
