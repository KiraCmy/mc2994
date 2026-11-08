/**
 * World Final — seabed sprays (M3D): glassy crowns of droplet-tipped
 * tendrils rising from the sediment, half frozen splash, half colony of
 * small translucent creatures. Pure data: where they grow (spraySites) and
 * the one prototype crown they all instance (buildSprayGeometry).
 *
 * Sites are deterministic per terrain seed. They prefer convex ground
 * (dune shoulders and crests), grow in small colonies, and a share is
 * gathered around the organism so the Hero View always has some.
 */
import * as THREE from 'three'
import { mulberry32 } from './currentField.js'
import { heightAt } from './heightField.js'

/** Sites at sprayDensity 1; the slider scales this (0–2). */
export const SPRAY_BASE_COUNT = 380
export const SPRAY_MAX_COUNT = SPRAY_BASE_COUNT * 2

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Height above the mean of four neighbours: > 0 on crests / shoulders. */
export function convexity(x, z, cfg, step = 6) {
  const h = heightAt(x, z, cfg)
  const mean =
    (heightAt(x + step, z, cfg) +
      heightAt(x - step, z, cfg) +
      heightAt(x, z + step, cfg) +
      heightAt(x, z - step, cfg)) /
    4
  return h - mean
}

export function groundNormal(x, z, cfg, step = 1.5) {
  const dx = heightAt(x + step, z, cfg) - heightAt(x - step, z, cfg)
  const dz = heightAt(x, z + step, cfg) - heightAt(x, z - step, cfg)
  return new THREE.Vector3(-dx, 2 * step, -dz).normalize()
}

/**
 * @param cfg normalized World Final config
 * @param anchor organism anchor ({x, z, radius}) or null
 * @returns Array<{ x, y, z, normal, yaw, scale, stretch, seed }>
 */
export function spraySites(cfg, anchor = null) {
  const count = Math.round(SPRAY_BASE_COUNT * Math.min(2, Math.max(0, cfg.sprayDensity ?? 1)))
  const rand = mulberry32(cfg.seed * 7919 + 17)
  const sites = []
  const R = cfg.basinRadius * 0.95

  const place = (x, z, scaleBias = 1) => {
    const n = groundNormal(x, z, cfg)
    /* Mostly small, a few large crowns. */
    const scale = (2.4 + 5 * rand() ** 2.2) * scaleBias
    sites.push({
      x,
      y: heightAt(x, z, cfg) - 0.12 * scale,
      z,
      normal: n,
      yaw: rand() * Math.PI * 2,
      scale,
      stretch: 0.8 + rand() * 0.6,
      seed: rand(),
    })
  }

  /* Colony seeds: rejection-sampled toward convex ground. */
  const colony = (cx, cz, spread, scaleBias) => {
    place(cx, cz, scaleBias)
    const extra = 1 + Math.floor(rand() * 3)
    for (let i = 0; i < extra && sites.length < count; i += 1) {
      const a = rand() * Math.PI * 2
      const d = spread * (0.4 + rand())
      place(cx + Math.cos(a) * d, cz + Math.sin(a) * d, scaleBias * (0.55 + rand() * 0.4))
    }
  }

  /* About a quarter of the sprays gather around the organism's ground. */
  if (anchor) {
    const near = Math.round(count * 0.25)
    let guard = 0
    while (sites.length < near && guard++ < near * 20) {
      const a = rand() * Math.PI * 2
      const d = anchor.radius * (1.2 + rand() * 6)
      const x = anchor.x + Math.cos(a) * d
      const z = anchor.z + Math.sin(a) * d
      if (rand() > 0.25 + 0.75 * smoothstep(-0.25, 0.5, convexity(x, z, cfg))) continue
      colony(x, z, 4, 1)
    }
  }

  let guard = 0
  while (sites.length < count && guard++ < count * 40) {
    const r = R * Math.sqrt(rand())
    const a = rand() * Math.PI * 2
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    if (rand() > 0.15 + 0.85 * smoothstep(-0.25, 0.5, convexity(x, z, cfg))) continue
    colony(x, z, 6, 1.15)
  }
  return sites.slice(0, count)
}

/**
 * One crown in local units (≈1 tall): a thin flaring glass sheet with a wavy
 * rim, and tapered tendrils rising from it that flare and curl over, each
 * topped by a droplet bead; a few beads float just free of their tips.
 * Attributes: aT (0 root → 1 tip, for sway), aBead (1 beads, 0.5 sheet, 0 tendrils).
 */
export function buildSprayGeometry(seed = 3) {
  const rand = mulberry32(seed)
  const positions = []
  const normals = []
  const aT = []
  const aBead = []
  const indices = []
  const SIDES = 4
  const SEGMENTS = 5
  const TENDRILS = 16

  const pushVertex = (p, n, t, bead) => {
    positions.push(p.x, p.y, p.z)
    normals.push(n.x, n.y, n.z)
    aT.push(t)
    aBead.push(bead)
    return positions.length / 3 - 1
  }

  const bead = (center, radius, t) => {
    /* Detail 0: faceted, which reads as a crystal droplet at this size. */
    const ico = new THREE.IcosahedronGeometry(radius, 0)
    const base = positions.length / 3
    const p = ico.attributes.position
    const v = new THREE.Vector3()
    for (let i = 0; i < p.count; i += 1) {
      v.fromBufferAttribute(p, i)
      pushVertex(v.clone().add(center), v.clone().normalize(), t, 1)
    }
    const idx = ico.index
    if (idx) for (let i = 0; i < idx.count; i += 1) indices.push(base + idx.getX(i))
    else for (let i = 0; i < p.count; i += 1) indices.push(base + i)
    ico.dispose()
  }

  /* Splash sheet: a thin, flaring glass skirt with a wavy rim (aBead 0.5). */
  const SKIRT_SIDES = 28
  const SKIRT_ROWS = 4
  const skirtStart = positions.length / 3
  const rimPhase = rand() * 6.28
  for (let s = 0; s <= SKIRT_ROWS; s += 1) {
    const t = s / SKIRT_ROWS
    for (let j = 0; j <= SKIRT_SIDES; j += 1) {
      const a = (j / SKIRT_SIDES) * Math.PI * 2
      const wave = 1 + 0.18 * Math.sin(a * 7 + rimPhase) * t
      const r = (0.06 + 0.36 * t ** 1.4) * wave
      const y = 0.3 * t * (1 + 0.25 * Math.sin(a * 5 + rimPhase) * t)
      const n = new THREE.Vector3(Math.cos(a) * 0.6, -0.8, Math.sin(a) * 0.6).normalize().negate()
      pushVertex(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), n, t * 0.35, 0.5)
    }
  }
  for (let s = 0; s < SKIRT_ROWS; s += 1) {
    for (let j = 0; j < SKIRT_SIDES; j += 1) {
      const a = skirtStart + s * (SKIRT_SIDES + 1) + j
      const b = a + SKIRT_SIDES + 1
      indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }

  for (let k = 0; k < TENDRILS; k += 1) {
    const angle = (k / TENDRILS) * Math.PI * 2 + (rand() - 0.5) * 0.4
    const height = 0.4 + rand() * 0.6
    const spread = 0.25 + rand() * 0.45
    const r0 = 0.16 + rand() * 0.12
    const width = 0.018 + rand() * 0.014
    const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))
    /* Rises out of the sheet's rim, flares, and curls over at the tip. */
    const curve = (t) =>
      new THREE.Vector3()
        .addScaledVector(dir, r0 + spread * t ** 1.3)
        .setY(0.18 + height * t * (1 - 0.35 * t * t))
    const ringStart = positions.length / 3
    for (let s = 0; s <= SEGMENTS; s += 1) {
      const t = s / SEGMENTS
      const c = curve(t)
      const tangent = curve(Math.min(1, t + 0.02)).sub(curve(Math.max(0, t - 0.02))).normalize()
      const side = new THREE.Vector3().crossVectors(tangent, dir).normalize()
      const out = new THREE.Vector3().crossVectors(side, tangent).normalize()
      const radius = width * (1 - 0.65 * t)
      for (let j = 0; j < SIDES; j += 1) {
        const a = (j / SIDES) * Math.PI * 2
        const n = side.clone().multiplyScalar(Math.cos(a)).addScaledVector(out, Math.sin(a))
        pushVertex(c.clone().addScaledVector(n, radius), n, t, 0)
      }
    }
    for (let s = 0; s < SEGMENTS; s += 1) {
      for (let j = 0; j < SIDES; j += 1) {
        const a = ringStart + s * SIDES + j
        const b = ringStart + s * SIDES + ((j + 1) % SIDES)
        indices.push(a, a + SIDES, b, b, a + SIDES, b + SIDES)
      }
    }
    const tip = curve(1)
    const beadR = width * (1.6 + rand() * 1.4)
    bead(tip, beadR, 1)
    if (rand() < 0.35) {
      const free = tip.clone().addScaledVector(dir, 0.05).setY(tip.y + 0.08 + rand() * 0.14)
      bead(free, beadR * 0.6, 1.15)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1))
  geometry.setAttribute('aBead', new THREE.Float32BufferAttribute(aBead, 1))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}
