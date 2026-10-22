/**
 * Live AGE for GPU uniforms during Animate.
 * React state may update less often; shaders read this every frame.
 */
export const ageClock = { current: 0 }

export function syncAgeClock(age) {
  ageClock.current = Math.min(1, Math.max(0, Number(age) || 0))
}
