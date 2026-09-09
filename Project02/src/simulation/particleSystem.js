import { sampleField } from '../noise/generateNoiseMap.js'

function wrap01(v) {
  return v - Math.floor(v)
}

/**
 * Shared particle buffers (TypedArrays). Used by 2D canvas and 3D Points.
 * Not React state — owned by App via a stable ref.
 */
export function createParticleSystem() {
  let posX = null
  let posY = null
  let initX = null
  let initY = null
  let count = 0

  const seed = (n) => {
    const size = Math.max(1, Math.floor(n))
    posX = new Float32Array(size)
    posY = new Float32Array(size)
    initX = new Float32Array(size)
    initY = new Float32Array(size)
    for (let i = 0; i < size; i++) {
      const px = Math.random()
      const py = Math.random()
      posX[i] = px
      posY[i] = py
      initX[i] = px
      initY[i] = py
    }
    count = size
  }

  return {
    ensureCount(n) {
      const want = Math.max(1, Math.floor(n))
      if (!posX || count !== want) seed(want)
    },

    reset() {
      if (!posX || !initX) return
      for (let i = 0; i < count; i++) {
        posX[i] = initX[i]
        posY[i] = initY[i]
      }
    },

    step(dt, noiseMap, speed = 1) {
      if (!noiseMap || !posX) return
      const res = noiseMap.resolution
      const scale = 0.08 * Math.max(0, speed)
      for (let i = 0; i < count; i++) {
        const u = posX[i]
        const v = posY[i]
        const cx = sampleField(noiseMap.vx, res, u, v)
        const cy = sampleField(noiseMap.vy, res, u, v)
        posX[i] = wrap01(u + cx * scale * dt)
        posY[i] = wrap01(v + cy * scale * dt)
      }
    },

    getCount() {
      return count
    },

    getPosX() {
      return posX
    },

    getPosY() {
      return posY
    },
  }
}

/** Height at UV from the shared noise map (matches 3D World height field). */
export function sampleHeight(noiseMap, u, v, displace) {
  if (!noiseMap) return 0
  const res = noiseMap.resolution
  const m = sampleField(noiseMap.mag, res, u, v)
  const pot = sampleField(noiseMap.potential, res, u, v)
  return (m * 0.65 + ((pot + 1) * 0.5) * 0.35) * displace
}
