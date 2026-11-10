/**
 * World Final — places worth finding. Crystal druses and residue gardens
 * scattered in every direction around the clearing (behind the viewer too),
 * near, mid and far, so walking the water turns things up. Deterministic
 * (seeded), pure, no three.js.
 *
 * kinds:
 *   druse  — a crystal cluster with residue around its foot
 *   field  — small crystals strewn over a wider patch, more residue
 *   garden — residue only: pearl drops, frost-flowers, membrane flakes
 *
 * Every other druse is an ember druse (outcrop.style 'ember', see
 * emberCrystals.js): warm translucent columns on a sand mound, with shallow
 * pools and loose shards; the rest stay cool quartz.
 */
import { HABITAT_SEED, habitatRng, holeDistance, OUTCROPS, UNDERWORLD } from './habitatField.js'
import { SPIRE_CLEARING, SPIRES, spireWidth } from './crystalSpires.js'

const BANDS = [
  /* [count, rMin, rMax, scaleMin, scaleMax] */
  [10, 18, 42, 1.0, 2.2],
  [9, 42, 95, 1.8, 3.6],
  [7, 95, 180, 3.0, 6.0],
]

function clear(x, z, placed) {
  const [cx, cz] = SPIRE_CLEARING.centre
  if (Math.hypot(x - cx, z - cz) < SPIRE_CLEARING.radius + 3) return false
  for (const s of SPIRES) if (Math.hypot(x - s.x, z - s.z) < spireWidth(s.height) * 3 + 5) return false
  for (const o of OUTCROPS) if (Math.hypot(x - o.x, z - o.z) < o.spread + 6) return false
  if (holeDistance(x, z) < UNDERWORLD.hole.rim + 4) return false
  for (const p of placed) if (Math.hypot(x - p.x, z - p.z) < p.radius + 10) return false
  return true
}

export function buildExploreSites(seed = HABITAT_SEED + 909) {
  const r = habitatRng(seed)
  const sites = []
  let druses = 0
  for (const [count, rMin, rMax, sMin, sMax] of BANDS) {
    const offset = r() * Math.PI * 2
    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < 12; attempt++) {
        const ang = offset + ((i + (r() - 0.5) * 0.7) / count) * Math.PI * 2
        const rad = rMin + r() * (rMax - rMin)
        const x = Math.cos(ang) * rad
        const z = Math.sin(ang) * rad
        const scale = sMin + r() * (sMax - sMin)
        const pick = r()
        /* Every third place is a garden of residue; the rest crystal. */
        const kind = i % 3 === 2 ? 'garden' : pick < 0.62 ? 'druse' : 'field'
        const spread = kind === 'field' ? scale * 1.6 : scale * 0.55
        const radius = spread * 1.6 + 1.5
        if (!clear(x, z, sites)) continue
        const style = kind === 'druse' && druses++ % 2 === 0 ? 'ember' : 'quartz'
        sites.push({
          id: `site${sites.length}`,
          kind,
          x,
          z,
          radius,
          outcrop:
            kind === 'garden'
              ? null
              : {
                  x,
                  z,
                  count: kind === 'field' ? 6 + Math.floor(r() * 5) : 8 + Math.floor(r() * 7),
                  spread,
                  scale: kind === 'field' ? scale * 0.55 : scale,
                  rosettes: 1.2,
                  style,
                },
          residue: {
            blobs: kind === 'garden' ? 8 + Math.floor(r() * 8) : 2 + Math.floor(r() * 4),
            beadClusters: kind === 'garden' ? 12 + Math.floor(r() * 10) : 5 + Math.floor(r() * 6),
            flakes: kind === 'garden' ? 18 + Math.floor(r() * 14) : 6 + Math.floor(r() * 8),
            size: 0.6 + scale * 0.35,
          },
        })
        break
      }
    }
  }
  return sites
}

export const EXPLORE_SITES = Object.freeze(buildExploreSites())
