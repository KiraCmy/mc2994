/**
 * Path → surface growth influence (rest-space).
 * Shared by the body shader uniforms packer and JS surfaceDisplace.
 *
 * Closed strokes are a growth stimulus: after draw ends, influence expands
 * from the path outward over `growthDuration`, capped by Growth Strength /
 * Growth Radius maxima. Planned surface extensions are packed as they reveal.
 */

import { revealExtensionPlan } from './pathExtend.js'

export const PATH_GROWTH_MAX = 96

/** Default seconds from stroke close → full strength/radius. */
export const PATH_GROWTH_DURATION = 3.2

/** Chord distance on the unit sphere between two directions. */
function chordDistance(a, b) {
  const ax = a[0]
  const ay = a[1]
  const az = a[2]
  const bx = b[0]
  const by = b[1]
  const bz = b[2]
  const al = Math.hypot(ax, ay, az) || 1
  const bl = Math.hypot(bx, by, bz) || 1
  return Math.hypot(ax / al - bx / bl, ay / al - by / bl, az / al - bz / bl)
}

/** Smootherstep 0→1 for organic ramp. */
export function smootherstep01(t) {
  const x = Math.min(1, Math.max(0, t))
  return x * x * x * (x * (x * 6 - 15) + 10)
}

/**
 * Growth maturity for a stroke (0 = just finished drawing, 1 = full).
 * Missing bornAt → already mature (legacy / fully settled).
 */
export function pathStrokeProgress(bornAt, now = performance.now(), duration = PATH_GROWTH_DURATION) {
  if (bornAt == null || !Number.isFinite(bornAt)) return 1
  // `duration` is seconds; performance.now() is ms.
  const spanMs = Math.max(duration ?? PATH_GROWTH_DURATION, 1e-3) * 1000
  return smootherstep01((now - bornAt) / spanMs)
}

/**
 * Flatten closed strokes (+ revealed extensions) into ≤ PATH_GROWTH_MAX samples.
 * @param {{ restPoints: number[][], bornAt?: number, extensionPlan?: number[][] }[]} strokes
 * @returns {{ points: number[][], progresses: number[] }}
 */
export function packPathRestPoints(
  strokes,
  now = performance.now(),
  duration = PATH_GROWTH_DURATION,
  extensionDuration,
) {
  const points = []
  const progresses = []
  if (!strokes?.length) return { points, progresses }

  for (const stroke of strokes) {
    const pts = stroke?.restPoints
    if (!pts?.length) continue
    const prog = pathStrokeProgress(stroke.bornAt, now, duration)
    for (const p of pts) {
      if (p && p.length >= 3) {
        points.push([p[0], p[1], p[2]])
        progresses.push(prog)
      }
    }

    const plan = stroke.extensionPlan
    if (plan?.length) {
      const revealed = revealExtensionPlan(
        plan,
        stroke.bornAt,
        now,
        extensionDuration,
      )
      const spanMs = Math.max(extensionDuration ?? 4.6, 1e-3) * 1000
      for (let i = 0; i < revealed.length; i += 1) {
        const p = revealed[i]
        if (!p || p.length < 3) continue
        const appearedAt =
          stroke.bornAt == null
            ? now
            : stroke.bornAt + ((i + 1) / plan.length) * spanMs
        const sampleProg = pathStrokeProgress(appearedAt, now, duration * 0.85)
        points.push([p[0], p[1], p[2]])
        progresses.push(sampleProg)
      }
    }
  }

  if (points.length <= PATH_GROWTH_MAX) return { points, progresses }

  const outPts = []
  const outProg = []
  const last = points.length - 1
  for (let i = 0; i < PATH_GROWTH_MAX; i += 1) {
    const idx = Math.round((i / (PATH_GROWTH_MAX - 1)) * last)
    outPts.push(points[idx])
    outProg.push(progresses[idx])
  }
  return { points: outPts, progresses: outProg }
}

/**
 * Soft falloff weight at a single rest sample with a given radius.
 */
function weightToPoint(rest, pathPoint, growthRadius) {
  const radius = Math.max(growthRadius ?? 0, 1e-4)
  let w = 1 - Math.min(1, Math.max(0, chordDistance(rest, pathPoint) / radius))
  return w * w * (3 - 2 * w)
}

/**
 * Soft falloff weight: 1 on the path, 0 beyond growthRadius (chord).
 * When `progresses` is provided, each sample uses radius * progress (outward growth).
 */
export function pathGrowthWeight(rest, pathPoints, growthRadius, progresses) {
  if (!pathPoints?.length) return 0
  let best = 0
  for (let i = 0; i < pathPoints.length; i += 1) {
    const prog = progresses?.[i] ?? 1
    if (prog < 1e-5) continue
    const w = weightToPoint(rest, pathPoints[i], growthRadius * prog)
    if (w > best) best = w
  }
  return best
}

/**
 * Swell along deformed normal after AGE deform.
 * Per-sample progress scales both lift and falloff radius up to the maxima.
 * @returns {[number, number, number]}
 */
export function applyPathGrowth(
  rest,
  position,
  normal,
  pathPoints,
  growthStrength,
  growthRadius,
  progresses,
) {
  const strengthMax = growthStrength ?? 0
  if (!strengthMax || !pathPoints?.length) {
    return [position[0], position[1], position[2]]
  }

  let bestLift = 0
  for (let i = 0; i < pathPoints.length; i += 1) {
    const prog = progresses?.[i] ?? 1
    if (prog < 1e-5) continue
    const w = weightToPoint(rest, pathPoints[i], growthRadius * prog)
    const lift = strengthMax * prog * w
    if (lift > bestLift) bestLift = lift
  }

  return [
    position[0] + normal[0] * bestLift,
    position[1] + normal[1] * bestLift,
    position[2] + normal[2] * bestLift,
  ]
}
