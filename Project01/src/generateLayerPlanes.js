/**
 * Procedural descriptors for a stack of translucent rectangular planes.
 * Pure data — no Three.js / React. Scene code maps these into meshes.
 */

function clamp01(value) {
  return Math.min(1, Math.max(0, value))
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '')
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : normalized

  const int = Number.parseInt(full, 16)
  return {
    r: ((int >> 16) & 255) / 255,
    g: ((int >> 8) & 255) / 255,
    b: (int & 255) / 255,
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function mixHex(startHex, endHex, t) {
  const a = hexToRgb(startHex)
  const b = hexToRgb(endHex)
  const r = Math.round(lerp(a.r, b.r, t) * 255)
  const g = Math.round(lerp(a.g, b.g, t) * 255)
  const bl = Math.round(lerp(a.b, b.b, t) * 255)
  return `#${[r, g, bl].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

/**
 * @param {object} params
 * @param {number} params.layerCount
 * @param {number} params.layerSpacing
 * @param {number} params.scaleProgression  // -1..1 — shrink / grow across the sequence
 * @param {string} params.startColor
 * @param {string} params.endColor
 * @param {number} params.opacity
 * @param {number} [params.baseWidth]
 * @param {number} [params.baseHeight]
 * @param {number} [params.lateralOffset]   // diagonal step per layer (x)
 */
export function generateLayerPlanes({
  layerCount,
  layerSpacing,
  scaleProgression,
  startColor,
  endColor,
  opacity,
  baseWidth = 2.2,
  baseHeight = 2.2,
  lateralOffset = 0.22,
}) {
  const count = Math.max(1, Math.round(layerCount))
  const mid = (count - 1) / 2
  const layers = []

  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1)
    // Centered around 1: negative progression shrinks toward the front, positive grows.
    const scale = 1 + (t - 0.5) * 2 * scaleProgression
    const safeScale = Math.max(0.15, scale)
    const offset = i - mid

    layers.push({
      id: i,
      position: [offset * lateralOffset, 0, offset * layerSpacing],
      width: baseWidth * safeScale,
      height: baseHeight * safeScale,
      color: mixHex(startColor, endColor, clamp01(t)),
      opacity,
      renderOrder: i,
    })
  }

  return layers
}

export const DEFAULT_LAYER_PARAMS = {
  layerCount: 14,
  layerSpacing: 0.14,
  scaleProgression: 0.12,
  startColor: '#6a7585',
  endColor: '#d4727a',
  opacity: 0.38,
}
