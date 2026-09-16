/**
 * Hydraulic raindrop erosion with a steady rain curtain + surface flow.
 *
 * ~55% of drops form a continuous falling column (constant speed, even spacing).
 * The rest flow downhill for sediment transport after landing.
 */

const PHASE_FALLING = 0
const PHASE_FLOWING = 1

const INERTIA = 0.58
const CAPACITY = 5.5
const EROSION = 0.55
const DEPOSITION = 0.32
const FLOW_GRAVITY = 2.2
/** Constant fall speed — no accel bursts that make rain look uneven. */
const FALL_SPEED = 2.15
const DROP_EVAPORATION = 0.008
const EROSION_RADIUS = 2.6
const MIN_SLOPE = 0.006
const INIT_WATER = 1
const INIT_SPEED = 0.55
/** Surface life for flow drops (shorter → steadier recycle into the sky). */
const MAX_FLOW_TIME = 4.2
const MIN_WATER = 0.035
const FLOW_CELLS_PER_SEC = 7.5
const HEIGHT_SMOOTH = 12
const SKY_TOP = 2.35
const SKY_BOTTOM = 1.15
const IMPACT_WATER = 0.06
const TRAIL_WATER = 0.36
const WATER_RADIUS = 1.8
/** Share of particles that stay in the falling rain curtain. */
const RAIN_FRACTION = 0.55

function cellGradient(terrain, u, v, invRes) {
  const eps = invRes
  const hL = terrain.sample(u - eps, v)
  const hR = terrain.sample(u + eps, v)
  const hD = terrain.sample(u, v - eps)
  const hU = terrain.sample(u, v + eps)
  return {
    gx: (hR - hL) * 0.5,
    gy: (hU - hD) * 0.5,
  }
}

export function createRaindropSystem() {
  let posX = null
  let posY = null
  let heightY = null
  let fallVel = null
  let dirX = null
  let dirY = null
  let speed = null
  let water = null
  let sediment = null
  let age = null
  let phase = null
  /** 1 = rain-curtain drop (respawn immediately on impact). */
  let isRain = null
  let count = 0
  let rainSlots = 0
  let active = false
  let skyBase = 1.6

  const skyCeiling = () => skyBase * SKY_TOP
  const skyFloor = () => skyBase * SKY_BOTTOM
  const skyDepth = () => Math.max(0.4, skyCeiling() - skyFloor())

  const spawnFalling = (i, evenly = true) => {
    posX[i] = Math.random()
    posY[i] = Math.random()
    const a = Math.random() * Math.PI * 2
    dirX[i] = Math.cos(a)
    dirY[i] = Math.sin(a)
    speed[i] = INIT_SPEED
    water[i] = INIT_WATER
    sediment[i] = 0
    age[i] = 0
    phase[i] = PHASE_FALLING
    fallVel[i] = FALL_SPEED

    if (evenly && rainSlots > 0 && isRain[i]) {
      // Even vertical spacing → constant impact rate
      const lane = i % rainSlots
      const t = (lane + 0.5) / rainSlots
      heightY[i] = skyCeiling() - t * skyDepth()
    } else if (evenly && count > 0) {
      const t = (i + 0.5) / count
      heightY[i] = skyCeiling() - t * skyDepth()
    } else {
      heightY[i] = skyCeiling()
    }
  }

  const seed = (n) => {
    const size = Math.max(0, Math.floor(n))
    if (size === 0) {
      posX = null
      posY = null
      heightY = null
      fallVel = null
      dirX = null
      dirY = null
      speed = null
      water = null
      sediment = null
      age = null
      phase = null
      isRain = null
      count = 0
      rainSlots = 0
      return
    }
    posX = new Float32Array(size)
    posY = new Float32Array(size)
    heightY = new Float32Array(size)
    fallVel = new Float32Array(size)
    dirX = new Float32Array(size)
    dirY = new Float32Array(size)
    speed = new Float32Array(size)
    water = new Float32Array(size)
    sediment = new Float32Array(size)
    age = new Float32Array(size)
    phase = new Uint8Array(size)
    isRain = new Uint8Array(size)
    count = size
    rainSlots = Math.max(1, Math.floor(size * RAIN_FRACTION))
    for (let i = 0; i < size; i++) {
      isRain[i] = i < rainSlots ? 1 : 0
      spawnFalling(i, true)
    }
  }

  const recycleFromSky = (i, erosionTerrain) => {
    let changed = false
    if (sediment[i] > 1e-6 && phase[i] === PHASE_FLOWING) {
      erosionTerrain.applyBrush(posX[i], posY[i], sediment[i], EROSION_RADIUS * 0.7)
      changed = true
    }
    if (phase[i] === PHASE_FLOWING && water[i] > 0.05) {
      erosionTerrain.addWater(posX[i], posY[i], water[i] * 0.02, WATER_RADIUS)
      changed = true
    }
    // Return to the top of the column (keeps rain continuous, not bursty)
    spawnFalling(i, false)
    heightY[i] = skyCeiling()
    fallVel[i] = FALL_SPEED
    return changed
  }

  return {
    ensureCount(n) {
      const want = Math.max(0, Math.floor(n))
      if (count !== want || (want > 0 && !posX)) seed(want)
    },

    start(n, displaceHint = 1) {
      skyBase = Math.max(0.9, displaceHint * 1.35 + 0.55)
      seed(Math.max(0, Math.floor(n)))
      active = count > 0
    },

    clear() {
      seed(0)
      active = false
    },

    reset() {
      if (!posX) return
      for (let i = 0; i < count; i++) spawnFalling(i, true)
    },

    isActive() {
      return active && count > 0
    },

    step(dt, erosionTerrain, erosionRate = 1) {
      if (!active || !posX || !erosionTerrain?.isReady() || count === 0) return false

      const stepDt = Math.min(0.05, Math.max(0.001, dt))
      const res = erosionTerrain.getResolution()
      const invCell = 1 / Math.max(1, res - 1)
      const rate = Math.max(0.2, Math.min(3, erosionRate))
      const kErode = EROSION * (0.55 + rate * 0.65)
      const kDeposit = DEPOSITION * (0.5 + rate * 0.35)
      const kCapacity = CAPACITY * (0.75 + rate * 0.4)
      const displace = Math.max(0.35, erosionTerrain.getDisplace())
      skyBase = Math.max(skyBase, displace * 1.35 + 0.55)

      const heightLerp = 1 - Math.exp(-HEIGHT_SMOOTH * stepDt)
      let changed = false

      if (erosionTerrain.stepWater(stepDt)) changed = true

      for (let i = 0; i < count; i++) {
        if (phase[i] === PHASE_FALLING) {
          // Constant-speed fall — steady rain, no accel pulses
          fallVel[i] = FALL_SPEED
          heightY[i] -= FALL_SPEED * stepDt

          const surface = erosionTerrain.sample(posX[i], posY[i])
          if (heightY[i] <= surface + 0.02) {
            heightY[i] = surface + 0.02
            erosionTerrain.addWater(posX[i], posY[i], IMPACT_WATER, WATER_RADIUS)
            changed = true

            if (isRain[i]) {
              // Rain-curtain drop: splash and return to sky immediately
              spawnFalling(i, false)
              heightY[i] = skyCeiling()
              fallVel[i] = FALL_SPEED
              continue
            }

            phase[i] = PHASE_FLOWING
            fallVel[i] = 0
            speed[i] = INIT_SPEED
            water[i] = INIT_WATER
            sediment[i] = 0
            age[i] = 0
            const { gx, gy } = cellGradient(erosionTerrain, posX[i], posY[i], invCell)
            const glen = Math.hypot(gx, gy)
            if (glen > 1e-6) {
              dirX[i] = -gx / glen
              dirY[i] = -gy / glen
            }
          }
          continue
        }

        // —— Surface flow (erosion workers only) ——
        age[i] += stepDt
        if (water[i] < MIN_WATER || age[i] >= MAX_FLOW_TIME) {
          if (recycleFromSky(i, erosionTerrain)) changed = true
          continue
        }

        const u = posX[i]
        const v = posY[i]
        const h0 = erosionTerrain.sample(u, v)
        const { gx, gy } = cellGradient(erosionTerrain, u, v, invCell)

        let dx = dirX[i] * INERTIA - gx * (1 - INERTIA)
        let dy = dirY[i] * INERTIA - gy * (1 - INERTIA)
        let len = Math.hypot(dx, dy)
        if (len < 1e-8) {
          dx = dirX[i]
          dy = dirY[i]
          len = Math.hypot(dx, dy) || 1
        }
        dx /= len
        dy /= len
        dirX[i] = dx
        dirY[i] = dy

        const spd = Math.max(0.05, speed[i])
        const travel = spd * FLOW_CELLS_PER_SEC * invCell * stepDt
        const nx = u + dx * travel
        const ny = v + dy * travel

        if (nx < 0 || nx > 1 || ny < 0 || ny > 1) {
          if (recycleFromSky(i, erosionTerrain)) changed = true
          continue
        }

        const h1 = erosionTerrain.sample(nx, ny)
        const descent = h0 - h1
        let sed = sediment[i]
        let w = water[i]
        let nextSpd = spd

        const slopeTerm = Math.max(descent, MIN_SLOPE)
        const capacity = Math.max(0, slopeTerm * nextSpd * w * kCapacity)
        const dtScale = stepDt * 28

        if (descent < 0) {
          const excess = sed > capacity ? (sed - capacity) * kDeposit : 0
          const amount = Math.min(sed, (-descent * 0.55 + excess) * dtScale)
          if (amount > 1e-7) {
            erosionTerrain.applyBrush(u, v, amount, EROSION_RADIUS)
            sed -= amount
            changed = true
          }
          nextSpd *= Math.exp(-2.4 * stepDt)
          const gLen = Math.hypot(gx, gy)
          if (gLen > 1e-6) {
            const ngx = gx / gLen
            const ngy = gy / gLen
            const into = dx * ngx + dy * ngy
            if (into > 0) {
              dx -= ngx * into
              dy -= ngy * into
              const dLen = Math.hypot(dx, dy) || 1
              dirX[i] = dx / dLen
              dirY[i] = dy / dLen
            }
          }
          if (sed < 1e-5 && nextSpd < 0.05) {
            if (recycleFromSky(i, erosionTerrain)) changed = true
            continue
          }
        } else if (sed > capacity) {
          const amount = (sed - capacity) * kDeposit * dtScale
          if (amount > 1e-7) {
            erosionTerrain.applyBrush(u, v, amount, EROSION_RADIUS)
            sed -= amount
            changed = true
          }
        } else {
          const room = capacity - sed
          const want = room * kErode * dtScale
          const maxCarve = Math.max(0, descent) * 1.15 + slopeTerm * 0.05 * dtScale
          const take = Math.min(want, maxCarve)
          if (take > 1e-7) {
            const carved = -erosionTerrain.applyBrush(u, v, -take, EROSION_RADIUS)
            if (carved > 1e-8) {
              sed += carved
              changed = true
            }
          }
        }

        const trail = TRAIL_WATER * stepDt * (0.35 + Math.min(1.2, spd))
        if (trail > 1e-6) {
          erosionTerrain.addWater(nx, ny, trail, WATER_RADIUS * 0.85)
          changed = true
        }

        const gained = Math.max(0, descent) * FLOW_GRAVITY
        nextSpd = Math.sqrt(Math.max(0, nextSpd * nextSpd + gained))
        nextSpd = Math.min(nextSpd, 2.8) * Math.exp(-0.1 * stepDt)

        w *= Math.exp(-DROP_EVAPORATION * 6 * stepDt)
        sediment[i] = Math.max(0, sed)
        speed[i] = nextSpd
        water[i] = w
        posX[i] = nx
        posY[i] = ny

        const surfaceWater = erosionTerrain.sampleWater(nx, ny)
        const targetH = erosionTerrain.sample(nx, ny) + 0.02 + Math.min(0.08, surfaceWater * 0.35)
        heightY[i] += (targetH - heightY[i]) * heightLerp
      }

      if (changed) erosionTerrain.markDirty()
      return changed
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

    getHeightY() {
      return heightY
    },

    getPhase() {
      return phase
    },

    PHASE_FALLING,
    PHASE_FLOWING,
  }
}
