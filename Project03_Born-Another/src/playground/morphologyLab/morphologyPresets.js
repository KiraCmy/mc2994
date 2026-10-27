/**
 * Rest-shape radius fields for Morphology Lab (Playground Exp 04).
 * Output is organism rest radius along a unit direction — same contract as
 * worldGeometry makeField().radiusAt. Life deform + growth sites stay radial.
 */

export const MORPHOLOGY_IDS = ['flattened', 'spiral', 'segmented']

export const MORPHOLOGY_PRESETS = {
  flattened: {
    id: 'flattened',
    label: 'Flattened',
    description: 'Ellipsoid disc — wide XZ, compressed Y.',
    defaults: {
      radius: 2.05,
      flatten: 0.62,
      rim: 0.12,
    },
  },
  spiral: {
    id: 'spiral',
    label: 'Spiral',
    description: 'Twisted radial bulge around Y — helical silhouette cue.',
    defaults: {
      radius: 2.0,
      turns: 2.4,
      bulge: 0.28,
      taper: 0.1,
    },
  },
  segmented: {
    id: 'segmented',
    label: 'Segmented',
    description: 'Linked lobes along Y — soft segmented body.',
    defaults: {
      radius: 1.92,
      segments: 4,
      lobe: 0.22,
      waist: 0.08,
    },
  },
}

export const DEFAULT_MORPHOLOGY_PARAMS = {
  flattened: { ...MORPHOLOGY_PRESETS.flattened.defaults },
  spiral: { ...MORPHOLOGY_PRESETS.spiral.defaults },
  segmented: { ...MORPHOLOGY_PRESETS.segmented.defaults },
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/** Ellipsoid radius for unit direction (x,y,z). */
function ellipsoidRadius(dx, dy, dz, rx, ry, rz) {
  const sx = dx / Math.max(1e-6, rx)
  const sy = dy / Math.max(1e-6, ry)
  const sz = dz / Math.max(1e-6, rz)
  const denom = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1
  return 1 / denom
}

/**
 * @param {'flattened'|'spiral'|'segmented'} morphologyId
 * @param {Record<string, number>} params
 * @returns {(direction: {x:number,y:number,z:number}|number[]) => number}
 */
export function createMorphologyRadiusAt(morphologyId, params = {}) {
  const preset = MORPHOLOGY_PRESETS[morphologyId] ?? MORPHOLOGY_PRESETS.flattened
  const p = { ...preset.defaults, ...params }

  if (preset.id === 'flattened') {
    const flatten = clamp(p.flatten, 0.05, 0.92)
    const rx = p.radius * (1 + p.rim * 0.35)
    const rz = p.radius * (1 + p.rim * 0.25)
    const ry = p.radius * (1 - flatten)
    return (direction) => {
      const dx = direction.x ?? direction[0] ?? 0
      const dy = direction.y ?? direction[1] ?? 0
      const dz = direction.z ?? direction[2] ?? 0
      const len = Math.hypot(dx, dy, dz) || 1
      return ellipsoidRadius(dx / len, dy / len, dz / len, rx, ry, rz)
    }
  }

  if (preset.id === 'spiral') {
    const turns = clamp(p.turns, 0.5, 5)
    const bulge = clamp(p.bulge, 0, 0.55)
    const taper = clamp(p.taper, 0, 0.45)
    return (direction) => {
      const dx = direction.x ?? direction[0] ?? 0
      const dy = direction.y ?? direction[1] ?? 0
      const dz = direction.z ?? direction[2] ?? 0
      const len = Math.hypot(dx, dy, dz) || 1
      const x = dx / len
      const y = dy / len
      const z = dz / len
      const theta = Math.atan2(x, z)
      const helix = Math.sin(theta * turns + y * Math.PI * turns * 0.35)
      const polar = Math.sqrt(Math.max(0, 1 - y * y))
      return (
        p.radius *
        (1 + bulge * helix * (0.35 + 0.65 * polar) - taper * y * y)
      )
    }
  }

  /* segmented */
  const segments = Math.max(2, Math.round(p.segments))
  const lobe = clamp(p.lobe, 0, 0.5)
  const waist = clamp(p.waist, 0, 0.35)
  return (direction) => {
    const dx = direction.x ?? direction[0] ?? 0
    const dy = direction.y ?? direction[1] ?? 0
    const dz = direction.z ?? direction[2] ?? 0
    const len = Math.hypot(dx, dy, dz) || 1
    const x = dx / len
    const y = dy / len
    const z = dz / len
    const t = (y + 1) * 0.5 * segments
    const wave = Math.cos(t * Math.PI * 2)
    const ring = Math.sqrt(Math.max(0, x * x + z * z))
    return (
      p.radius *
      (1 + lobe * wave - waist * (1 - ring) * (1 - Math.abs(wave)))
    )
  }
}
