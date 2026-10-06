/**
 * Procedural path continuation on the unit sphere (rest space).
 * After the user finishes a stroke, the organism extends from the tip
 * along the surface with light wander — never off the sphere.
 */

/** Default arc length of the auto-extension on the unit sphere. */
export const PATH_EXTENSION_LENGTH = 1.15

/** Seconds for the full planned extension to reveal. */
export const PATH_EXTENSION_DURATION = 4.6

/** Heading noise strength while walking the surface. */
export const PATH_EXTENSION_WANDER = 0.4

function smootherstep01(t) {
  const x = Math.min(1, Math.max(0, t))
  return x * x * x * (x * (x * 6 - 15) + 10)
}

function len3(v) {
  return Math.hypot(v[0], v[1], v[2]) || 1
}

function normalize3(v) {
  const L = len3(v)
  return [v[0] / L, v[1] / L, v[2] / L]
}

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/** Project vector into the tangent plane at unit normal n. */
function projectTangent(v, n) {
  const d = dot3(v, n)
  return normalize3([v[0] - n[0] * d, v[1] - n[1] * d, v[2] - n[2] * d])
}

/** Stable 0–1 hash from seed + step index. */
function hash11(seed, i) {
  const x = Math.sin(seed * 0.00137 + i * 17.23 + 0.71) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Travel direction at the tip in the tangent plane (from previous sample → tip).
 */
export function tipTravelDirection(restPoints) {
  if (!restPoints || restPoints.length < 2) return null
  const tip = normalize3(restPoints[restPoints.length - 1])
  const prev = normalize3(restPoints[restPoints.length - 2])
  const raw = [tip[0] - prev[0], tip[1] - prev[1], tip[2] - prev[2]]
  if (len3(raw) < 1e-6) {
    const axis = Math.abs(tip[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
    return projectTangent(cross3(tip, axis), tip)
  }
  return projectTangent(raw, tip)
}

/**
 * Plan a full surface continuation from the stroke tip (does not include tip).
 * Rest-space unit samples only — display/deform happen later via shared field.
 *
 * @param {number[][]} restPoints user stroke (unchanged)
 * @param {{ seed?: number, step?: number, maxLength?: number, wander?: number }} opts
 * @returns {number[][]}
 */
export function planSurfaceExtension(restPoints, opts = {}) {
  const step = Math.max(opts.step ?? 0.045, 0.02)
  const maxLength = Math.max(opts.maxLength ?? PATH_EXTENSION_LENGTH, step)
  const wander = opts.wander ?? PATH_EXTENSION_WANDER
  const seed = (opts.seed ?? 1) + restPoints.length * 13.1

  if (!restPoints || restPoints.length < 2) return []

  let pos = normalize3(restPoints[restPoints.length - 1])
  let dir = tipTravelDirection(restPoints)
  if (!dir) return []

  const out = []
  let traveled = 0
  const maxSteps = Math.min(96, Math.ceil(maxLength / step) + 2)

  for (let i = 0; i < maxSteps && traveled < maxLength; i += 1) {
    const side = projectTangent(cross3(pos, dir), pos)
    const turn = (hash11(seed, i) * 2 - 1) * wander
    const curl = (hash11(seed, i + 41) * 2 - 1) * wander * 0.35
    const yaw = turn + curl * 0.2
    dir = projectTangent(
      [dir[0] + side[0] * yaw, dir[1] + side[1] * yaw, dir[2] + side[2] * yaw],
      pos,
    )

    const c = Math.cos(step)
    const s = Math.sin(step)
    const next = normalize3([
      pos[0] * c + dir[0] * s,
      pos[1] * c + dir[1] * s,
      pos[2] * c + dir[2] * s,
    ])
    dir = projectTangent(dir, next)
    pos = next
    out.push([pos[0], pos[1], pos[2]])
    traveled += step
  }

  return out
}

/**
 * How much of the planned extension is visible (0→1, eased).
 */
export function extensionRevealAmount(
  bornAt,
  now = performance.now(),
  duration = PATH_EXTENSION_DURATION,
) {
  if (bornAt == null || !Number.isFinite(bornAt)) return 1
  // `duration` is seconds; performance.now() is ms.
  const spanMs = Math.max(duration ?? PATH_EXTENSION_DURATION, 1e-3) * 1000
  return smootherstep01((now - bornAt) / spanMs)
}

/**
 * Prefix of the planned extension revealed so far (progressive growth).
 * @returns {number[][]}
 */
export function revealExtensionPlan(
  plan,
  bornAt,
  now = performance.now(),
  duration = PATH_EXTENSION_DURATION,
) {
  if (!plan?.length) return []
  const amount = extensionRevealAmount(bornAt, now, duration)
  if (amount <= 1e-4) return []
  const count = Math.max(1, Math.ceil(amount * plan.length))
  return plan.slice(0, Math.min(count, plan.length))
}

/**
 * Rest samples for the extension ribbon: tip + revealed plan (seamless join).
 */
export function extensionRibbonPoints(
  stroke,
  now = performance.now(),
  duration = PATH_EXTENSION_DURATION,
) {
  const user = stroke?.restPoints
  if (!user?.length) return []
  const revealed = revealExtensionPlan(
    stroke.extensionPlan,
    stroke.bornAt,
    now,
    duration,
  )
  if (!revealed.length) return []
  const tip = user[user.length - 1]
  return [tip, ...revealed]
}
