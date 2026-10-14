import * as THREE from 'three'
import {
  LSYSTEM_AXIOM,
  LSYSTEM_LENGTH_SCALE,
  LSYSTEM_RADIUS_SCALE,
  LSYSTEM_ROOT_RADIUS,
  LSYSTEM_RULES,
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

/** Signed jitter in [-amount, +amount] from a unit random. */
function jitter(rand, amount) {
  if (amount <= 1e-6) return 0
  return (rand() * 2 - 1) * amount
}

/**
 * Expand an L-system string by rewriting `depth` times.
 * With F → F[+F][-F], each iteration forks every tip into a new hierarchy level.
 */
export function expandLSystem(
  axiom = LSYSTEM_AXIOM,
  rules = LSYSTEM_RULES,
  depth = 3,
) {
  const n = Math.max(0, Math.floor(depth))
  let current = axiom
  for (let i = 0; i < n; i += 1) {
    let next = ''
    for (let c = 0; c < current.length; c += 1) {
      const ch = current[c]
      next += rules[ch] ?? ch
    }
    current = next
  }
  return current
}

/**
 * Turtle-interpret an L-system string into tapered 3D branch segments.
 * On each `[`, rolls around the current heading by Branch Rotation × sibling
 * index so forks leave the plane. Randomness (seeded) jitters yaw and length.
 */
export function turtleBranches(
  source,
  {
    angle = 28,
    length = 0.55,
    branchRotation = 90,
    randomness = 0,
    seed = 1,
    lengthScale = LSYSTEM_LENGTH_SCALE,
    rootRadius = LSYSTEM_ROOT_RADIUS,
    radiusScale = LSYSTEM_RADIUS_SCALE,
  } = {},
) {
  const baseAngle = (angle * Math.PI) / 180
  const twistStep = (branchRotation * Math.PI) / 180
  const rand = mulberry32(Math.floor(seed) || 1)
  const amp = Math.min(1, Math.max(0, randomness))
  const branches = []

  const position = new THREE.Vector3(0, 0, 0)
  const heading = new THREE.Vector3(0, 1, 0)
  const left = new THREE.Vector3(1, 0, 0)
  const up = new THREE.Vector3(0, 0, 1)
  let step = Math.max(0.02, length)
  let nest = 0
  /** How many siblings opened at each nest depth (drives axial roll). */
  const siblingCount = [0]

  const stack = []
  const _q = new THREE.Quaternion()

  function rotateAround(axis, radians) {
    _q.setFromAxisAngle(axis, radians)
    heading.applyQuaternion(_q).normalize()
    left.applyQuaternion(_q).normalize()
    up.applyQuaternion(_q).normalize()
  }

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]
    if (ch === 'F' || ch === 'G') {
      const lenJitter = 1 + jitter(rand, amp * 0.35)
      const drawStep = Math.max(0.01, step * lenJitter)
      const start = position.clone()
      position.addScaledVector(heading, drawStep)
      const radiusStart = rootRadius * Math.pow(radiusScale, nest)
      const radiusEnd = rootRadius * Math.pow(radiusScale, nest + 0.85)
      branches.push({
        start,
        end: position.clone(),
        radiusStart: Math.max(0.004, radiusStart),
        radiusEnd: Math.max(0.003, radiusEnd),
        depth: nest,
      })
    } else if (ch === '+') {
      rotateAround(up, baseAngle * (1 + jitter(rand, amp * 0.45)))
    } else if (ch === '-') {
      rotateAround(up, -baseAngle * (1 + jitter(rand, amp * 0.45)))
    } else if (ch === '&') {
      rotateAround(left, baseAngle * (1 + jitter(rand, amp * 0.45)))
    } else if (ch === '^') {
      rotateAround(left, -baseAngle * (1 + jitter(rand, amp * 0.45)))
    } else if (ch === '\\') {
      rotateAround(heading, baseAngle)
    } else if (ch === '/') {
      rotateAround(heading, -baseAngle)
    } else if (ch === '|') {
      rotateAround(up, Math.PI)
    } else if (ch === '[') {
      stack.push({
        position: position.clone(),
        heading: heading.clone(),
        left: left.clone(),
        up: up.clone(),
        step,
        nest,
      })
      // Roll around the growth axis so this sibling leaves the parent plane.
      const index = siblingCount[nest] ?? 0
      siblingCount[nest] = index + 1
      const twist =
        twistStep * index + jitter(rand, amp * twistStep * 0.35)
      if (Math.abs(twist) > 1e-6) {
        rotateAround(heading, twist)
      }
      step *= lengthScale * (1 + jitter(rand, amp * 0.2))
      nest += 1
      if (siblingCount[nest] == null) siblingCount[nest] = 0
    } else if (ch === ']') {
      const state = stack.pop()
      if (!state) continue
      position.copy(state.position)
      heading.copy(state.heading)
      left.copy(state.left)
      up.copy(state.up)
      step = state.step
      nest = state.nest
    }
  }

  return { branches, count: branches.length }
}

/** Line-segment fallback for tools that only need endpoints. */
export function turtleSegments(source, options) {
  const { branches } = turtleBranches(source, options)
  const positions = new Float32Array(branches.length * 6)
  for (let i = 0; i < branches.length; i += 1) {
    const b = branches[i]
    const o = i * 6
    positions[o] = b.start.x
    positions[o + 1] = b.start.y
    positions[o + 2] = b.start.z
    positions[o + 3] = b.end.x
    positions[o + 4] = b.end.y
    positions[o + 5] = b.end.z
  }
  return { positions, count: branches.length }
}

/**
 * Build branch list from params in one call (expand + turtle).
 */
export function buildLSystemGeometry({
  depth = 3,
  angle = 28,
  length = 0.55,
  branchRotation = 90,
  randomness = 0,
  seed = 1,
  rootRadius = LSYSTEM_ROOT_RADIUS,
  radiusScale = LSYSTEM_RADIUS_SCALE,
  lengthScale = LSYSTEM_LENGTH_SCALE,
  axiom = LSYSTEM_AXIOM,
  rules = LSYSTEM_RULES,
} = {}) {
  const source = expandLSystem(axiom, rules, depth)
  return turtleBranches(source, {
    angle,
    length,
    branchRotation,
    randomness,
    seed,
    rootRadius,
    radiusScale,
    lengthScale,
  })
}
