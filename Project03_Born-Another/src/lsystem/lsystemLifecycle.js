/**
 * AGE-driven reveal / decay for hierarchical vascular veins.
 * Topology rest paths stay fixed; this only clips and fragments display polylines.
 *
 * Reference targets:
 *   AGE 0.18 — partial primaries, almost no secondaries
 *   AGE 0.35 — primaries extended, secondaries emerging
 *   AGE 0.55 — full hierarchy including terminals
 *   AGE 0.85 — fade / fragment smaller veins first
 */

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x))
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Deterministic unit hash for fragmentation (SEED + branch + segment). */
function hash01(seed, branchIndex, segmentIndex) {
  let n =
    (Math.imul(Math.floor(seed) ^ 0x9e3779b9, 747796405) +
      Math.imul(branchIndex + 1, 1597334677) +
      Math.imul(segmentIndex + 1, 3812015801)) >>>
    0
  n = Math.imul(n ^ (n >>> 15), 2246822519) >>> 0
  n = Math.imul(n ^ (n >>> 13), 3266489917) >>> 0
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

/**
 * Per-nest lifecycle at global AGE.
 * @returns {{ reveal: number, fragment: number, residual: boolean, thickness: number }}
 *   thickness — 1 at maturity; drops so AGE 0.85 reads as thinner remnants
 */
export function veinLifecycleAtAge(nest, age) {
  const a = clamp(Number(age) || 0, 0, 1)

  if (a <= 1e-4) {
    return { reveal: 0, fragment: 0, residual: false, thickness: 0 }
  }

  // Growth 0 → 0.5 (t = age/0.5). At age 0.18 → t ≈ 0.36.
  if (a < 0.5) {
    const t = a / 0.5
    let reveal
    if (nest <= 0) {
      // Primaries grow through early ages (≈0.55 length at 0.18).
      reveal = smoothstep(0.02, 0.62, t)
    } else if (nest === 1) {
      // Secondaries stay off until after ~0.20 age (t≈0.40).
      reveal = smoothstep(0.4, 0.92, t)
    } else {
      // Terminals fill in late in the growth window.
      reveal = smoothstep(0.58, 1.0, t)
    }
    return { reveal, fragment: 0, residual: false, thickness: 1 }
  }

  // Peak 0.5 → 0.7
  if (a < 0.7) {
    return { reveal: 1, fragment: 0, residual: false, thickness: 1 }
  }

  // Decay 0.7 → 1. At AGE 0.85, fade ≈ 0.5: thinner, broken, not a full web.
  const fade = (a - 0.7) / 0.3

  if (nest >= 2) {
    return {
      reveal: 1 - smoothstep(0.0, 0.32, fade),
      fragment: smoothstep(0.0, 0.4, fade),
      residual: false,
      thickness: 1 - smoothstep(0.0, 0.35, fade) * 0.9,
    }
  }

  if (nest === 1) {
    return {
      reveal: 1 - smoothstep(0.04, 0.5, fade) * 0.96,
      fragment: smoothstep(0.05, 0.55, fade),
      residual: fade > 0.5,
      thickness: 1 - smoothstep(0.0, 0.6, fade) * 0.8,
    }
  }

  return {
    reveal: 1 - smoothstep(0.12, 0.9, fade) * 0.5,
    fragment: smoothstep(0.08, 0.75, fade) * 0.72,
    residual: true,
    thickness: 1 - smoothstep(0.0, 0.55, fade) * 0.62,
  }
}

/**
 * Clip a root→tip polyline by reveal, then optionally fragment for decay.
 * @returns {number[][][]}
 */
export function applyVeinLifecycle(restPoints, nest, branchIndex, age, seed) {
  if (!restPoints || restPoints.length < 2) return []

  const life = veinLifecycleAtAge(nest, age)
  if (life.reveal <= 1e-4) return []

  const last = Math.max(
    1,
    Math.min(
      restPoints.length - 1,
      Math.ceil((restPoints.length - 1) * life.reveal),
    ),
  )
  const clipped = restPoints.slice(0, last + 1)
  if (clipped.length < 2) return []

  if (life.fragment <= 1e-4) {
    return [clipped]
  }

  const runs = []
  let run = [clipped[0]]
  const dropChance = life.fragment
  const keepStride = life.residual ? 3 : 2

  for (let i = 0; i < clipped.length - 1; i += 1) {
    const h = hash01(seed, branchIndex, i)
    const keep =
      h > dropChance ||
      (life.residual && i % keepStride === 0) ||
      i === 0 ||
      i === clipped.length - 2

    if (keep) {
      run.push(clipped[i + 1])
    } else {
      if (run.length >= 2) runs.push(run)
      run = [clipped[i + 1]]
    }
  }
  if (run.length >= 2) runs.push(run)

  if (runs.length === 0 && life.residual && clipped.length >= 2) {
    const step = Math.max(2, Math.floor(clipped.length / 5))
    const trace = []
    for (let i = 0; i < clipped.length; i += step) {
      trace.push(clipped[i])
    }
    const tip = clipped[clipped.length - 1]
    const lastPt = trace[trace.length - 1]
    if (
      !lastPt ||
      lastPt[0] !== tip[0] ||
      lastPt[1] !== tip[1] ||
      lastPt[2] !== tip[2]
    ) {
      trace.push(tip)
    }
    if (trace.length >= 2) runs.push(trace)
  }

  return runs
}

/** Canonical AGE used when walking rest topology (stable while scrubbing). */
export const LSYSTEM_TOPOLOGY_AGE = 0.5
