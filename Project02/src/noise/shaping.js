/** Remap v in [-1,1] with a named shaping op and amount in [0,1] (or op-specific). */

export const SHAPE_OPS = [
  { id: 'none', label: 'NONE', paramLabel: 'AMT', min: 0, max: 1, step: 0.01, defaultAmount: 0 },
  { id: 'power', label: 'POWER', paramLabel: 'EXP', min: 0.1, max: 4, step: 0.01, defaultAmount: 1.5 },
  { id: 'bias', label: 'BIAS', paramLabel: 'BIAS', min: 0.05, max: 0.95, step: 0.01, defaultAmount: 0.35 },
  { id: 'gain', label: 'GAIN', paramLabel: 'GAIN', min: 0.05, max: 0.95, step: 0.01, defaultAmount: 0.35 },
  { id: 'clamp', label: 'CLAMP', paramLabel: 'SOFT', min: 0, max: 1, step: 0.01, defaultAmount: 0.55 },
  { id: 'absolute', label: 'ABS', paramLabel: 'MIX', min: 0, max: 1, step: 0.01, defaultAmount: 1 },
  { id: 'smoothstep', label: 'SMOOTHSTEP', paramLabel: 'EDGE', min: 0, max: 1, step: 0.01, defaultAmount: 0.45 },
  { id: 'sine', label: 'SINE', paramLabel: 'FREQ', min: 0.25, max: 8, step: 0.05, defaultAmount: 2 },
]

function clamp01(x) {
  return Math.min(1, Math.max(0, x))
}

function bias(t, b) {
  return Math.pow(t, Math.log(b) / Math.log(0.5))
}

function gain(t, g) {
  if (t < 0.5) return 0.5 * bias(2 * t, 1 - g)
  return 1 - 0.5 * bias(2 - 2 * t, 1 - g)
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0 || 1e-6))
  return t * t * (3 - 2 * t)
}

/** Shape a signed sample in roughly [-1, 1] → [-1, 1]. */
export function shapeValue(v, opId, amount) {
  const x = Math.max(-1, Math.min(1, v))

  switch (opId) {
    case 'power': {
      const exp = amount
      const s = Math.sign(x)
      return s * Math.pow(Math.abs(x), exp)
    }
    case 'bias': {
      const t = (x + 1) * 0.5
      return bias(t, amount) * 2 - 1
    }
    case 'gain': {
      const t = (x + 1) * 0.5
      return gain(t, amount) * 2 - 1
    }
    case 'clamp': {
      const soft = amount
      const lim = 1 - soft * 0.85
      return Math.max(-lim, Math.min(lim, x)) / (lim || 1)
    }
    case 'absolute': {
      const folded = Math.abs(x) * 2 - 1
      return x * (1 - amount) + folded * amount
    }
    case 'smoothstep': {
      const edge = amount * 0.5
      const t = (x + 1) * 0.5
      const s = smoothstep(edge, 1 - edge, t)
      return s * 2 - 1
    }
    case 'sine': {
      return Math.sin(x * Math.PI * amount)
    }
    case 'none':
    default:
      return x
  }
}

export function getShapeOp(id) {
  return SHAPE_OPS.find((op) => op.id === id) ?? SHAPE_OPS[0]
}
