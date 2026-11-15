export function underworldClusters(seed = HABITAT_SEED + 515) {
  const r = habitatRng(seed)
  const { centre, radius, hole } = UNDERWORLD
  const niches = remainNiches(40)
  const sites = []
  const patches = []
  const lilac = []
  const ember = []
  const beads = []
  const clearOfHoleAndRemains = (x, z) =>
    holeDistance(x, z) > hole.r + 2.2 && !niches.some(([nx, , nz]) => Math.hypot(nx - x, nz - z) < 2.6)

  /* Whether (x, z) can hold a druse of this kind (room, wall slope). */
  const fits = (kind, x, z) => {
    const room = clearance(x, z)
    if (kind === 'floor') return room >= 2.2 ? room : 0
    if (kind === 'hang') return room >= 3.2 ? room : 0
    /* Where the vault sweeps down steeply: a wall. */
    if (room < 0.5 || room > 3) return 0
    const nrm = fieldNormal(underworldCeiling, x, z, true)
    return Math.abs(nrm[1]) > 0.75 ? 0 : room
  }

  /* 1 · Patches: where the rock was mineral enough to grow anything. Crystals
     come in colonies, not evenly spread: a few rich patches, bare rock
     between them. Each patch mostly keeps to one kind of crystal. */
  const seedPatches = (kind, want, gap) => {
    for (let tries = 0, n = 0; tries < want * 120 && n < want; tries++) {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * radius * 0.95
      const x = centre.x + Math.cos(a) * d
      const z = centre.z + Math.sin(a) * d
      if (!fits(kind, x, z) || !clearOfHoleAndRemains(x, z)) continue
      if (patches.some((p) => Math.hypot(p.x - x, p.z - z) < gap)) continue
      const t = r()
      patches.push({ x, z, kind, style: t < 0.46 ? 'lilac' : t < 0.92 ? 'ember' : 'mixed', spread: kind === 'floor' ? 1.4 + r() * 1.6 : 1 + r() * 1.1 })
      n++
    }
  }
  seedPatches('floor', 13, 4.6)
  seedPatches('wall', 9, 4)
  seedPatches('hang', 5, 4.5)

  /* 2 · Druses inside each patch: a heart druse and smaller ones packed
     around it (denser toward the middle). */
  for (const patch of patches) {
    const want = patch.kind === 'floor' ? 3 + Math.floor(r() * 4) : patch.kind === 'wall' ? 2 + Math.floor(r() * 3) : 2 + Math.floor(r() * 2)
    let heart = null
    for (let tries = 0, n = 0; tries < want * 30 && n < want; tries++) {
      const first = n === 0
      const a = r() * Math.PI * 2
      const d = first ? 0 : (0.35 + Math.pow(r(), 0.8)) * patch.spread
      const x = patch.x + Math.cos(a) * d
      const z = patch.z + Math.sin(a) * d
      const room = fits(patch.kind, x, z)
      if (!room || !clearOfHoleAndRemains(x, z)) continue
      if (sites.some((s) => Math.hypot(s.x - x, s.z - z) < (first ? 1.6 : 0.85))) continue
      const site = { x, z, kind: patch.kind, room, heart: first, style: patch.style === 'mixed' ? (r() < 0.5 ? 'lilac' : 'ember') : r() < 0.88 ? patch.style : patch.style === 'lilac' ? 'ember' : 'lilac' }
      if (first) heart = site
      sites.push(site)
      n++
    }
    patch.heart = heart
  }

  /* 3 · Each druse: one dominant crystal and many companions growing from a
     shared base. They splay outward the further they stand from the middle,
     and shorten toward the rim, so the druse reads as one fan. */
  for (const site of sites) {
    const style = site.style
    const onCeiling = site.kind !== 'floor'
    const surf = onCeiling ? underworldCeiling : underworldFloor
    const n = fieldNormal(surf, site.x, site.z, onCeiling)
    const base =
      site.kind === 'floor'
        ? Math.min(site.room * 0.38, 0.55 + Math.pow(r(), 1.3) * 1.4)
        : site.kind === 'wall'
          ? 0.4 + r() * 0.65
          : Math.min(site.room * 0.28, 0.45 + r() * 0.75)
    const S = base * (site.heart ? 1.15 : 0.55 + r() * 0.35)
    const count = site.kind === 'floor' ? 9 + Math.floor(r() * 9) : site.kind === 'wall' ? 7 + Math.floor(r() * 5) : 6 + Math.floor(r() * 5)
    const reach = S * (site.kind === 'wall' ? 0.42 : 0.55)
    const fan = r() * Math.PI * 2
    for (let i = 0; i < count; i++) {
      const main = i === 0
      const tall = i < 4
      const ang = r() * Math.PI * 2
      const u = main ? 0 : Math.pow(r(), tall ? 1.4 : 0.75)
      const rad = u * reach
      const x = site.x + Math.cos(ang) * rad
      const z = site.z + Math.sin(ang) * rad
      const rim = 1 - 0.5 * u
      const h = S * rim * (main ? 1 : tall ? 0.55 + r() * 0.35 : 0.14 + Math.pow(r(), 1.4) * 0.45)
      const lean = main ? 0.05 + r() * 0.08 : 0.1 + u * (tall ? 0.45 : 0.85) + r() * 0.15
      const axis = tilt(n, lean, main ? fan : ang + (r() - 0.5) * 0.5)
      const ground = [x, surf(x, z), z]
      const sink = h * (main || tall ? 0.12 : 0.22)
      const p = [ground[0] - axis[0] * sink, ground[1] - axis[1] * sink, ground[2] - axis[2] * sink]
      if (style === 'lilac') {
        lilac.push({ x: p[0], y: p[1], z: p[2], axis, spin: r() * Math.PI, height: h, width: h * (0.26 + r() * 0.12), phantom: h > S * 0.55 })
      } else {
        const t = r()
        const habit = tall ? (t < 0.55 ? 'long' : t < 0.85 ? 'stout' : 'tapered') : t < 0.3 ? 'long' : t < 0.55 ? 'stout' : t < 0.8 ? 'tapered' : 'broken'
        const ratio = { long: 0.17, stout: 0.3, tapered: 0.2, broken: 0.24 }[habit] * (0.8 + r() * 0.45)
        ember.push({ x: p[0], y: p[1], z: p[2], axis, spin: r() * Math.PI * 2, height: h, width: h * ratio, depth: 0.75 + r() * 0.35, tint: r(), habit })
      }
    }
    /* Frost beads where floor druses meet the sand. */
    if (site.kind === 'floor') {
      const k = 5 + Math.floor(r() * 7)
      for (let b = 0; b < k; b++) {
        const ang = r() * Math.PI * 2
        const rad = S * (0.35 + r() * 0.8)
        const x = site.x + Math.cos(ang) * rad
        const z = site.z + Math.sin(ang) * rad
        const size = 0.03 + r() * 0.05
        beads.push({ x, y: underworldFloor(x, z) + size * 0.3, z, size })
      }
    }
  }

  /* 4 · Strays: single crystals and broken pieces shed around the floor
     patches (thinning out with distance), and a few far from any. */
  const floorPatches = patches.filter((p) => p.kind === 'floor')
  for (let i = 0, tries = 0; i < 70 && tries < 2400; tries++) {
    let x
    let z
    let style
    if (floorPatches.length && i < 58) {
      const p = floorPatches[Math.floor(r() * floorPatches.length)]
      const a = r() * Math.PI * 2
      const d = p.spread * (1.1 + Math.pow(r(), 1.8) * 2.4)
      x = p.x + Math.cos(a) * d
      z = p.z + Math.sin(a) * d
      style = p.style === 'mixed' ? (r() < 0.5 ? 'lilac' : 'ember') : p.style
    } else {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * radius * 0.95
      x = centre.x + Math.cos(a) * d
      z = centre.z + Math.sin(a) * d
      style = r() < 0.5 ? 'lilac' : 'ember'
    }
    const room = clearance(x, z)
    if (room < 1.4 || holeDistance(x, z) < hole.r + 1.8) continue
    if (niches.some(([nx, , nz]) => Math.hypot(nx - x, nz - z) < 2.2)) continue
    const n = fieldNormal(underworldFloor, x, z, false)
    const h = Math.min(room * 0.3, 0.14 + Math.pow(r(), 1.8) * 0.45)
    const lying = r() < 0.35
    const axis = tilt(n, lying ? 1.25 + r() * 0.25 : 0.2 + r() * 0.6, r() * Math.PI * 2)
    const sink = h * (lying ? 0.05 : 0.2)
    const y = underworldFloor(x, z)
    const p = [x - axis[0] * sink, y - axis[1] * sink, z - axis[2] * sink]
    if (style === 'lilac') lilac.push({ x: p[0], y: p[1], z: p[2], axis, spin: r() * Math.PI, height: h, width: h * (0.28 + r() * 0.1), phantom: false })
    else {
      const habit = r() < 0.5 ? 'long' : r() < 0.5 ? 'stout' : 'broken'
      ember.push({ x: p[0], y: p[1], z: p[2], axis, spin: r() * Math.PI * 2, height: h, width: h * 0.24, depth: 0.8 + r() * 0.3, tint: r(), habit })
    }
    i++
  }
  return { lilac, ember, beads, sites, patches }
}
