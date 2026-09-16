/**
 * Working height field + surface water for Hydraulic Erosion.
 * Copied from the shared noiseMap.height on START — never writes back to noise.
 */
export function createErosionTerrain() {
  let resolution = 0
  let heights = null
  let water = null
  let waterScratch = null
  let displace = 1
  let ready = false
  let revision = 0

  const sampleScalar = (field, u, v) => {
    if (!field || resolution < 2) return 0
    const res = resolution
    const x = Math.min(1, Math.max(0, u)) * (res - 1)
    const y = Math.min(1, Math.max(0, v)) * (res - 1)
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const x1 = Math.min(res - 1, x0 + 1)
    const y1 = Math.min(res - 1, y0 + 1)
    const tx = x - x0
    const ty = y - y0
    const a = field[y0 * res + x0]
    const b = field[y0 * res + x1]
    const c = field[y1 * res + x0]
    const d = field[y1 * res + x1]
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty
  }

  const brushOnto = (field, u, v, delta, radiusCells, { clampZero = false, maxCell = Infinity } = {}) => {
    if (!field || resolution < 2 || !Number.isFinite(delta) || delta === 0) return 0

    const res = resolution
    const cx = Math.min(1, Math.max(0, u)) * (res - 1)
    const cy = Math.min(1, Math.max(0, v)) * (res - 1)
    const radius = Math.max(1, radiusCells)
    const r2 = radius * radius

    const i0 = Math.max(0, Math.floor(cx - radius))
    const i1 = Math.min(res - 1, Math.ceil(cx + radius))
    const j0 = Math.max(0, Math.floor(cy - radius))
    const j1 = Math.min(res - 1, Math.ceil(cy + radius))

    let weightSum = 0
    const cells = []
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const dx = i - cx
        const dy = j - cy
        const d2 = dx * dx + dy * dy
        if (d2 > r2) continue
        const w = 1 - Math.sqrt(d2) / radius
        if (w <= 0) continue
        cells.push(j * res + i, w)
        weightSum += w
      }
    }
    if (weightSum < 1e-8) return 0

    let applied = 0
    if (delta < 0) {
      const want = -delta
      for (let c = 0; c < cells.length; c += 2) {
        const idx = cells[c]
        const share = (cells[c + 1] / weightSum) * want
        const take = Math.min(field[idx], share)
        field[idx] -= take
        if (clampZero && field[idx] < 0) field[idx] = 0
        applied -= take
      }
    } else {
      for (let c = 0; c < cells.length; c += 2) {
        const idx = cells[c]
        const add = (cells[c + 1] / weightSum) * delta
        const next = Math.min(maxCell, field[idx] + add)
        applied += next - field[idx]
        field[idx] = next
      }
    }
    return applied
  }

  return {
    isReady() {
      return ready && heights != null
    },

    getResolution() {
      return resolution
    },

    getHeights() {
      return heights
    },

    getWater() {
      return water
    },

    getDisplace() {
      return displace
    },

    getRevision() {
      return revision
    },

    copyFromNoiseMap(noiseMap, displaceAmt = 1) {
      if (!noiseMap?.height) {
        this.clear()
        return false
      }

      const res = noiseMap.resolution
      const src = noiseMap.height
      const nextH = new Float32Array(res * res)
      const nextW = new Float32Array(res * res)
      for (let k = 0; k < nextH.length; k++) {
        nextH[k] = src[k] * displaceAmt
      }

      resolution = res
      heights = nextH
      water = nextW
      waterScratch = new Float32Array(res * res)
      displace = displaceAmt
      ready = true
      revision += 1
      return true
    },

    clear() {
      resolution = 0
      heights = null
      water = null
      waterScratch = null
      displace = 1
      ready = false
      revision += 1
    },

    sample(u, v) {
      return sampleScalar(heights, u, v)
    },

    sampleWater(u, v) {
      return sampleScalar(water, u, v)
    },

    /**
     * Soft circular brush on terrain height.
     * delta < 0 erodes, delta > 0 deposits.
     */
    applyBrush(u, v, delta, radiusCells = 2) {
      return brushOnto(heights, u, v, delta, radiusCells, { clampZero: true })
    },

    applyDelta(u, v, delta) {
      return this.applyBrush(u, v, delta, 1.25)
    },

    /** Add surface water (accumulates in pools / trails). Cap keeps valleys from flooding. */
    addWater(u, v, amount, radiusCells = 1.8) {
      if (!water || amount <= 0) return 0
      return brushOnto(water, u, v, amount, radiusCells, { maxCell: 0.38 })
    },

    /**
     * Evaporation + ground absorption + downhill drainage.
     * Valleys soak slowly so pools linger, then fade.
     */
    stepWater(dt) {
      if (!water || !heights || resolution < 2) return false

      const stepDt = Math.min(0.05, Math.max(0, dt))
      const res = resolution
      // Slow surface evaporation (~30s half-life)
      const evaporate = 1 - Math.exp(-0.023 * stepDt)
      // Gentle ground infiltration — still drains valleys, but over many seconds
      const soakBase = 0.012
      let dirty = false

      for (let k = 0; k < water.length; k++) {
        if (water[k] <= 1e-6) {
          if (water[k] !== 0) {
            water[k] = 0
            dirty = true
          }
          continue
        }
        const before = water[k]
        // Mild extra soak for deeper pools (soil contact), kept low so water lingers
        const soak = (soakBase + before * 0.05) * stepDt
        water[k] = Math.max(0, before * (1 - evaporate) - soak)
        if (water[k] !== before) dirty = true
      }

      // Mild drainage toward lower terrain neighbors (pools in channels)
      if (!waterScratch || waterScratch.length !== water.length) {
        waterScratch = new Float32Array(water.length)
      }
      const next = waterScratch
      next.set(water)
      const flowRate = Math.min(0.35, 1.6 * stepDt)

      for (let j = 1; j < res - 1; j++) {
        for (let i = 1; i < res - 1; i++) {
          const idx = j * res + i
          const w0 = water[idx]
          if (w0 < 1e-5) continue

          const h0 = heights[idx]
          let best = -1
          let bestDrop = 0
          const nIdx = [idx - 1, idx + 1, idx - res, idx + res]
          for (let n = 0; n < 4; n++) {
            const drop = h0 + w0 * 0.12 - (heights[nIdx[n]] + water[nIdx[n]] * 0.12)
            if (drop > bestDrop) {
              bestDrop = drop
              best = nIdx[n]
            }
          }
          if (best >= 0 && bestDrop > 1e-5) {
            const move = Math.min(w0 * flowRate, bestDrop * 0.35)
            next[idx] -= move
            next[best] += move
            dirty = true
          }
        }
      }

      if (dirty) {
        for (let k = 0; k < next.length; k++) {
          const capped = next[k] > 0.38 ? 0.38 : next[k]
          water[k] = capped < 0 ? 0 : capped
        }
      }

      return dirty
    },

    markDirty() {
      revision += 1
    },
  }
}
