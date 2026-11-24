import * as THREE from 'three'

/**
 * World Final archive sheet: the three callout points as real places on the
 * remains, so the leader lines stay on the same part of the body while it is
 * turned, sinks or is reframed.
 *
 *  - mineral:  one of the body's own crystals (instanced, on the skin);
 *  - membrane: a vertex of the skin, as the shader places it (rest surface
 *              plus the coil and facet offsets);
 *  - core:     the body's centre, where the nucleus sits.
 *
 * Each is chosen for the current view (mineral on the upper left facing the
 * viewer, membrane on the right-hand rim) and kept until it turns to the
 * wrong side or behind the body; then a new one is chosen.
 *
 * `ctx` (written by CrystalBody while its remains are on the sheet):
 *   { group, crystals, geo, coil, facet, center }
 */

const v = new THREE.Vector3()
const c = new THREE.Vector3()
const rel = new THREE.Vector3()

/** The anchor's point in the body group's local space. */
function localPoint(ref, ctx, out) {
  if (ref.kind === 'crystal') {
    const e = ctx.crystals.instanceMatrix.array
    const i = ref.i * 16
    return out.set(e[i + 12], e[i + 13], e[i + 14])
  }
  if (ref.kind === 'vertex') {
    const p = ctx.geo.attributes.position.array
    const co = ctx.geo.attributes.aCoilOffset?.array
    const fo = ctx.geo.attributes.aFacetOffset?.array
    const i = ref.i * 3
    out.set(p[i], p[i + 1], p[i + 2])
    if (co) out.x += co[i] * ctx.coil, out.y += co[i + 1] * ctx.coil, out.z += co[i + 2] * ctx.coil
    if (fo) out.x += fo[i] * ctx.facet, out.y += fo[i + 1] * ctx.facet, out.z += fo[i + 2] * ctx.facet
    return out
  }
  return out.set(ctx.center[0], ctx.center[1], ctx.center[2])
}

/** Where `ref` is relative to the body's centre, in view space, in body radii
 *  (x right, y up, z toward the viewer). */
function viewRel(ref, ctx, camera, radius, out) {
  localPoint(ref, ctx, v).applyMatrix4(ctx.group.matrixWorld).applyMatrix4(camera.matrixWorldInverse)
  localPoint({ kind: 'centre' }, ctx, c).applyMatrix4(ctx.group.matrixWorld).applyMatrix4(camera.matrixWorldInverse)
  return out.copy(v).sub(c).divideScalar(Math.max(1e-4, radius))
}

const SCORE = {
  /* Upper left, facing the viewer. */
  mineral: (p) => -0.7 * p.x + 0.6 * p.y + 1.0 * p.z,
  /* On the right-hand rim, a little above the middle. */
  membrane: (p) => p.x - 0.7 * Math.abs(p.z) - 0.5 * Math.abs(p.y - 0.25),
}

/** Still usable from this view? (Otherwise choose again.) */
const STILL_GOOD = {
  mineral: (p) => p.x < 0.25 && p.z > -0.15,
  membrane: (p) => p.x > 0.35 && p.z > -0.45,
  core: () => true,
}

function pick(id, ctx, camera, radius) {
  let best = null
  let bestScore = -Infinity
  const consider = (ref) => {
    const p = viewRel(ref, ctx, camera, radius, rel)
    const s = SCORE[id](p)
    if (s > bestScore) {
      bestScore = s
      best = ref
    }
  }
  if (id === 'mineral' && ctx.crystals?.count) {
    const e = ctx.crystals.instanceMatrix.array
    for (let i = 0; i < ctx.crystals.count; i++) {
      /* Skip crystals that have not grown (zero scale). */
      const k = i * 16
      if (e[k] * e[k] + e[k + 1] * e[k + 1] + e[k + 2] * e[k + 2] < 1e-8) continue
      consider({ kind: 'crystal', i })
    }
  }
  if (!best && ctx.geo?.attributes?.position) {
    const n = ctx.geo.attributes.position.count
    const step = Math.max(1, Math.ceil(n / 1800))
    for (let i = 0; i < n; i += step) consider({ kind: 'vertex', i })
  }
  return best ?? { kind: 'centre' }
}

const M = new THREE.Matrix4()
const s = new THREE.Vector3()
const MAX_POINTS = 3000

/**
 * The body's box on screen this frame, from its own geometry: the skin's
 * vertices as the shader places them and the crystals' bounding spheres,
 * projected. Exact and steady (no pixel reading). Returns {x0, y0, x1, y1}
 * in the units of `toNdcPx` (ndc x/y → [px, py]), or null.
 */
export function specimenBox(ctx, camera, toNdcPx) {
  if (!ctx?.group || !ctx.geo?.attributes?.position) return null
  ctx.group.updateWorldMatrix(true, false)
  M.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(ctx.group.matrixWorld)
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const add = (x, y) => {
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  const n = ctx.geo.attributes.position.count
  const step = Math.max(1, Math.ceil(n / MAX_POINTS))
  for (let i = 0; i < n; i += step) {
    localPoint({ kind: 'vertex', i }, ctx, v).applyMatrix4(M)
    if (v.z > 1) continue
    const [px, py] = toNdcPx(v.x, v.y)
    add(px, py)
  }
  /* Crystals reach out of the skin: their bounding spheres, projected. */
  const cr = ctx.crystals
  const bs = cr?.geometry?.boundingSphere ?? (cr?.geometry ? (cr.geometry.computeBoundingSphere(), cr.geometry.boundingSphere) : null)
  if (cr?.count && bs) {
    const e = cr.instanceMatrix.array
    const world = new THREE.Matrix4()
    const view = camera.matrixWorldInverse
    for (let i = 0; i < cr.count; i++) {
      const k = i * 16
      const scale = Math.sqrt(Math.max(e[k] * e[k] + e[k + 1] * e[k + 1] + e[k + 2] * e[k + 2], e[k + 4] * e[k + 4] + e[k + 5] * e[k + 5] + e[k + 6] * e[k + 6]))
      if (scale < 1e-4) continue
      world.fromArray(e, k).premultiply(ctx.group.matrixWorld)
      c.copy(bs.center).applyMatrix4(world)
      const groupScale = ctx.group.matrixWorld.getMaxScaleOnAxis()
      const rad = bs.radius * scale * groupScale
      /* Centre in view space, then its extent along the view's x / y. */
      s.copy(c).applyMatrix4(view)
      for (const [dx, dy] of [[rad, 0], [-rad, 0], [0, rad], [0, -rad]]) {
        rel.set(s.x + dx, s.y + dy, s.z).applyMatrix4(camera.projectionMatrix)
        if (rel.z > 1) continue
        const [px, py] = toNdcPx(rel.x, rel.y)
        add(px, py)
      }
    }
  }
  if (!(x1 > x0 && y1 > y0)) return null
  return { x0, y0, x1, y1 }
}

/**
 * Screen positions (px) of the three anchors this frame. `state` keeps the
 * chosen anchors between frames (pass the same object every frame; reset it
 * for a new life). `toScreen(vec3) → [x, y]` projects a world point.
 */
export function specimenAnchors(state, ctx, camera, radius, toScreen, now) {
  if (!ctx?.group) return null
  ctx.group.updateWorldMatrix(true, false)
  const out = {}
  for (const id of ['mineral', 'membrane', 'core']) {
    let ref = state[id]
    if (id === 'core') ref = { kind: 'centre' }
    else if (!ref || (!STILL_GOOD[id](viewRel(ref, ctx, camera, radius, rel)) && now - (state[`${id}At`] ?? -9) > 0.6)) {
      ref = pick(id, ctx, camera, radius)
      state[`${id}At`] = now
    }
    state[id] = ref
    localPoint(ref, ctx, v).applyMatrix4(ctx.group.matrixWorld)
    out[id] = toScreen(v)
  }
  return out
}
