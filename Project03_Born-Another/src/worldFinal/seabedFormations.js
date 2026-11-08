/**
 * World Final — residual life forms: membranes that once lived here, now
 * mostly sunk into the sediment and slowly turning to mineral.
 *
 *   fold     a low, irregular sheet. Its whole outline lies in the sand, so
 *            it reads as emerging from the ground rather than standing on it.
 *   mineral  small rounded grains, only ever placed along a fold's hem.
 *
 * There is no scatter of free-standing crystals, and a wide quiet radius
 * around the organism is left empty. Vertex attributes for the shared
 * shader: aT (0 in the sand → 1 at the raised centre) and aBody (0 film).
 */
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mulberry32 } from './currentField.js'
import { heightAt } from './heightField.js'
import { convexity, groundNormal } from './seabedSprays.js'

export const FORMATION_KINDS = Object.freeze(['fold', 'mineral'])

/** Folds at formationDensity 1; the slider scales this (0–2). */
export const FOLD_BASE_COUNT = 16
/** Grains per fold, all of them on that fold's hem. */
export const MINERALS_PER_FOLD = 5
/** No formation centre closer to the organism than this many body radii. */
export const QUIET_RADIUS = 4

/** Instance budgets per kind at formationDensity 2. */
export const FORMATION_MAX_COUNTS = Object.freeze({
  fold: FOLD_BASE_COUNT * 2,
  mineral: FOLD_BASE_COUNT * 2 * MINERALS_PER_FOLD,
})

/** Sink by a share of the size, so the perimeter stays under the sand. */
const SINK = Object.freeze({ fold: 0.1, mineral: 0.5 })

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * @param cfg normalized World Final config
 * @param anchor organism anchor ({x, z, radius}) or null
 * @returns {{ [kind]: Array<{ x, y, z, normal, yaw, scale, seed }> }}
 */
export function formationSites(cfg, anchor = null) {
  const density = Math.min(2, Math.max(0, cfg.formationDensity ?? 1))
  const rand = mulberry32(cfg.seed * 104729 + 31)
  const R = cfg.basinRadius * 0.95
  const out = Object.fromEntries(FORMATION_KINDS.map((k) => [k, []]))
  const lerp = (lo, hi, t) => lo + (hi - lo) * t

  const quiet = anchor ? anchor.radius * QUIET_RADIUS : 0
  const place = (kind, x, z, scale) => {
    if (out[kind].length >= FORMATION_MAX_COUNTS[kind]) return
    out[kind].push({
      x,
      y: heightAt(x, z, cfg) - SINK[kind] * scale,
      z,
      normal: groundNormal(x, z, cfg),
      yaw: rand() * Math.PI * 2,
      scale,
      seed: rand(),
    })
  }
  const accept = (x, z) => {
    if (anchor && Math.hypot(x - anchor.x, z - anchor.z) < quiet) return false
    return rand() <= 0.2 + 0.8 * smoothstep(-0.3, 0.45, convexity(x, z, cfg))
  }
  const basinPoint = () => {
    for (let guard = 0; guard < 120; guard += 1) {
      const r = R * Math.sqrt(rand())
      const a = rand() * Math.PI * 2
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      if (accept(x, z)) return [x, z]
    }
    return null
  }

  /* Most folds sit in a ring just outside the organism's quiet ground, so a
     view of the organism also shows the landscape they belong to. */
  const ringPoint = () => {
    if (!anchor) return basinPoint()
    for (let guard = 0; guard < 80; guard += 1) {
      const a = rand() * Math.PI * 2
      const d = quiet * 1.3 + rand() * anchor.radius * 9
      const x = anchor.x + Math.cos(a) * d
      const z = anchor.z + Math.sin(a) * d
      if (Math.hypot(x, z) < R && accept(x, z)) return [x, z]
    }
    return basinPoint()
  }

  const folds = Math.round(FOLD_BASE_COUNT * density)
  const around = anchor ? Math.round(folds * 0.7) : 0
  for (let i = 0; i < folds; i += 1) {
    const point = i < around ? ringPoint() : basinPoint()
    if (!point) break
    const [cx, cz] = point
    const scale = lerp(9, 18, rand() ** 1.4)
    place('fold', cx, cz, scale)
    for (let j = 0; j < MINERALS_PER_FOLD; j += 1) {
      const a = rand() * Math.PI * 2
      /* On the hem of the sheet (its radius is about half its scale). */
      const d = scale * lerp(0.28, 0.5, rand())
      place('mineral', cx + Math.cos(a) * d, cz + Math.sin(a) * d, lerp(0.6, 1.3, rand()))
    }
  }
  return out
}

/* --- Prototype geometry ------------------------------------------------- */

function createBuilder() {
  const positions = []
  const aT = []
  const aBody = []
  const indices = []
  return {
    vertex(p, t, body) {
      positions.push(p.x, p.y, p.z)
      aT.push(t)
      aBody.push(body)
      return positions.length / 3 - 1
    },
    /** Grid of (cols+1)×(rows+1) vertices from fn(u, v) → {p, t, body}. */
    grid(cols, rows, fn) {
      const start = positions.length / 3
      for (let j = 0; j <= rows; j += 1) {
        for (let i = 0; i <= cols; i += 1) {
          const { p, t, body } = fn(i / cols, j / rows)
          this.vertex(p, t, body)
        }
      }
      for (let j = 0; j < rows; j += 1) {
        for (let i = 0; i < cols; i += 1) {
          const a = start + j * (cols + 1) + i
          const b = a + cols + 1
          indices.push(a, b, a + 1, a + 1, b, b + 1)
        }
      }
    },
    triangle(a, b, c) {
      indices.push(a, b, c)
    },
    build({ flat = false } = {}) {
      let g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1))
      g.setAttribute('aBody', new THREE.Float32BufferAttribute(aBody, 1))
      g.setIndex(indices)
      if (flat) g = g.toNonIndexed()
      g.computeVertexNormals()
      g.computeBoundingSphere()
      return g
    },
  }
}

/**
 * Low irregular sheet: every point of its outline sits in the sand and only
 * the middle lifts, so the membrane merges into the sediment on all sides.
 * ~1 unit across. aT is 0 on the outline.
 */
export function buildFoldGeometry(seed = 11) {
  const rand = mulberry32(seed)
  const b = createBuilder()
  const SHEETS = 3
  for (let k = 0; k < SHEETS; k += 1) {
    const yaw = rand() * Math.PI * 2
    const c = Math.cos(yaw)
    const s = Math.sin(yaw)
    const length = 0.5 + rand() * 0.5
    const width = 0.2 + rand() * 0.22
    const height = 0.22 + rand() * 0.24
    const ox = (rand() - 0.5) * 0.3
    const oz = (rand() - 0.5) * 0.3
    const ph = rand() * Math.PI * 2
    b.grid(22, 7, (u, v) => {
      const hem = Math.sin(Math.PI * u)
      const along = (u - 0.5) * length
      const lift = Math.sin(Math.PI * v) * height * hem * (0.6 + 0.4 * Math.sin(u * 4.5 + ph))
      const across = (v - 0.2) * width * hem + 0.045 * Math.sin(u * 3.2 + ph) * v
      return {
        p: new THREE.Vector3(ox + along * c - across * s, -0.05 + lift, oz + along * s + across * c),
        t: Math.min(1, lift / Math.max(0.04, height)),
        body: 0,
      }
    })
  }
  return b.build()
}

/**
 * A few small rounded grains (no points, no long axis), meant to be instanced
 * along a fold's hem. ~0.4 across.
 */
export function buildMineralGeometry(seed = 37) {
  const rand = mulberry32(seed)
  const b = createBuilder()
  const GRAINS = 6
  for (let k = 0; k < GRAINS; k += 1) {
    const raw = new THREE.IcosahedronGeometry(1, 0)
    raw.deleteAttribute('normal')
    raw.deleteAttribute('uv')
    const ico = mergeVertices(raw)
    raw.dispose()
    const r = 0.045 + rand() * 0.06
    const squash = 0.45 + rand() * 0.3
    const centre = new THREE.Vector3((rand() - 0.5) * 0.28, r * squash * 0.3, (rand() - 0.5) * 0.28)
    const p = ico.attributes.position
    const v = new THREE.Vector3()
    let start = -1
    for (let i = 0; i < p.count; i += 1) {
      v.fromBufferAttribute(p, i)
      const q = v.clone().multiplyScalar(r)
      q.y *= squash
      const index = b.vertex(q.add(centre), 0.4, 0.6)
      if (start < 0) start = index
    }
    const idx = ico.index
    for (let i = 0; i < idx.count; i += 3) {
      b.triangle(start + idx.getX(i), start + idx.getX(i + 1), start + idx.getX(i + 2))
    }
    ico.dispose()
  }
  return b.build()
}

export const FORMATION_BUILDERS = Object.freeze({
  fold: buildFoldGeometry,
  mineral: buildMineralGeometry,
})
