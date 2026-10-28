/**
 * Exp03 Study 01 — Crystal Morphology Lab static plans (A / B / C).
 * Same growth seat + comparable footprint; morphology differs only.
 */
import { exp03Hash01 } from './crystalClusterGeometry.js'
import {
  EXP03_MORPHOLOGY_LAB_ANCHOR,
  EXP03_MORPHOLOGY_LAB_EXTENT,
  EXP03_MORPHOLOGY_MODES,
  normalizeExp03MorphologyMode,
} from './morphologyLabTypes.js'

function normalize3(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / len, v[1] / len, v[2] / len]
}

function orthonormalBasis(axis) {
  const n = normalize3(axis)
  const helper = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const rx = n[1] * helper[2] - n[2] * helper[1]
  const ry = n[2] * helper[0] - n[0] * helper[2]
  const rz = n[0] * helper[1] - n[1] * helper[0]
  const rlen = Math.hypot(rx, ry, rz) || 1
  const right = [rx / rlen, ry / rlen, rz / rlen]
  const fx = n[1] * right[2] - n[2] * right[1]
  const fy = n[2] * right[0] - n[0] * right[2]
  const fz = n[0] * right[1] - n[1] * right[0]
  return { up: n, right, forward: [fx, fy, fz] }
}

function mixAxis(up, right, forward, azimuth, lean) {
  const c = Math.cos(azimuth)
  const s = Math.sin(azimuth)
  return normalize3([
    up[0] + (right[0] * c + forward[0] * s) * lean,
    up[1] + (right[1] * c + forward[1] * s) * lean,
    up[2] + (right[2] * c + forward[2] * s) * lean,
  ])
}

/**
 * A — Faceted Branching: shared trunk + irregular faceted limbs / twigs.
 */
function planFacetedBranching(seed, extent, basis) {
  const { up, right, forward } = basis
  const pieces = []
  const trunkLen = extent * 0.72
  const trunkWidth = trunkLen / 2.4

  pieces.push({
    id: 'branch-trunk',
    role: 'primary',
    kind: 'crystal',
    axis: up,
    length: trunkLen,
    width: trunkWidth,
    depth: trunkWidth * 0.88,
    roll: 0.15,
    profileIndex: 0,
    nest: 0.02,
    radial: 0,
    radialAngle: 0,
    tint: 0.2,
  })

  const branchCount = 5
  for (let i = 0; i < branchCount; i += 1) {
    const u = exp03Hash01(seed, i, 11)
    const v = exp03Hash01(seed, i, 23)
    const w = exp03Hash01(seed, i, 37)
    const azimuth = (i / branchCount) * Math.PI * 2 + (u - 0.5) * 0.9 + 0.4
    const lean = 0.55 + v * 0.7
    const axis = mixAxis(up, right, forward, azimuth, lean)
    const length = extent * (0.38 + w * 0.32)
    const width = length / (2.2 + u * 0.5)
    pieces.push({
      id: `branch-arm-${i}`,
      role: 'primary',
      kind: 'crystal',
      axis,
      length,
      width,
      depth: width * (0.75 + v * 0.25),
      roll: azimuth * 0.3 + u,
      profileIndex: (i + 1) % 4,
      nest: 0.012,
      radial: extent * (0.04 + u * 0.06),
      radialAngle: azimuth,
      attachAlong: 0.22 + v * 0.45,
      tint: 0.25 + u * 0.5,
    })

    /* Twigs off each arm */
    const twigCount = 1 + Math.floor(v * 2)
    for (let t = 0; t < twigCount; t += 1) {
      const tu = exp03Hash01(seed, i, t + 50)
      const tv = exp03Hash01(seed, i, t + 70)
      const twigAz = azimuth + (tu - 0.5) * 1.4
      const twigLean = lean + 0.25 + tv * 0.45
      const twigAxis = mixAxis(up, right, forward, twigAz, twigLean)
      const twigLen = length * (0.35 + tu * 0.35)
      const twigWidth = twigLen / (2.1 + tv * 0.6)
      pieces.push({
        id: `branch-twig-${i}-${t}`,
        role: 'secondary',
        kind: 'crystal',
        axis: twigAxis,
        length: twigLen,
        width: twigWidth,
        depth: twigWidth * 0.85,
        roll: twigAz + tu,
        profileIndex: (i + t + 2) % 4,
        nest: 0.008,
        radial: extent * (0.05 + tu * 0.08),
        radialAngle: twigAz,
        attachAlong: 0.35 + tv * 0.4,
        parentBranch: i,
        tint: 0.45 + tu * 0.4,
      })
    }
  }

  /* Soft shared base tissue */
  for (let i = 0; i < 4; i += 1) {
    const u = exp03Hash01(seed, i + 90, 3)
    const azimuth = (i / 4) * Math.PI * 2 + u * 0.4
    const axis = mixAxis(up, right, forward, azimuth, 1.05 + u * 0.35)
    pieces.push({
      id: `branch-tissue-${i}`,
      role: 'tissue',
      kind: 'tissue',
      axis,
      length: extent * (0.2 + u * 0.12),
      width: extent * (0.28 + u * 0.1),
      depth: extent * 0.06,
      roll: azimuth,
      profileIndex: i % 3,
      nest: 0.004,
      radial: extent * 0.03,
      radialAngle: azimuth,
      tint: 0.12 + u * 0.2,
    })
  }

  return pieces
}

/**
 * B — Crystalline Petals: layered asymmetrical mineralized sheets.
 */
function planCrystallinePetals(seed, extent, basis) {
  const { up, right, forward } = basis
  const pieces = []

  /* Central mineral bud */
  pieces.push({
    id: 'petal-core',
    role: 'primary',
    kind: 'crystal',
    axis: up,
    length: extent * 0.42,
    width: extent * 0.22,
    depth: extent * 0.2,
    roll: 0.2,
    profileIndex: 1,
    nest: 0.018,
    radial: 0,
    radialAngle: 0,
    tint: 0.3,
  })

  const petalCount = 7
  for (let i = 0; i < petalCount; i += 1) {
    const u = exp03Hash01(seed, i, 13)
    const v = exp03Hash01(seed, i, 29)
    const w = exp03Hash01(seed, i, 41)
    const azimuth =
      (i / petalCount) * Math.PI * 2 + (u - 0.5) * 0.7 + seed * 0.01
    const lean = 0.75 + v * 0.85
    const axis = mixAxis(up, right, forward, azimuth, lean)
    const length = extent * (0.48 + w * 0.38)
    const width = length * (0.55 + u * 0.35)
    const depth = length * (0.12 + v * 0.1)
    pieces.push({
      id: `petal-sheet-${i}`,
      role: i < 3 ? 'transition' : 'tissue',
      kind: i < 4 ? 'transition' : 'tissue',
      axis,
      length,
      width,
      depth,
      roll: azimuth * 0.45 + u * 1.2,
      profileIndex: i % 3,
      nest: 0.008 + u * 0.01,
      radial: extent * (0.02 + v * 0.05),
      radialAngle: azimuth,
      layerLift: (i % 3) * 0.012,
      tint: 0.2 + u * 0.55,
    })
  }

  /* Faceted mineral tips on a few petals */
  for (let i = 0; i < 4; i += 1) {
    const u = exp03Hash01(seed, i + 60, 7)
    const v = exp03Hash01(seed, i + 60, 19)
    const azimuth = (i / 4) * Math.PI * 2 + 0.35 + (u - 0.5) * 0.8
    const lean = 0.55 + v * 0.45
    const axis = mixAxis(up, right, forward, azimuth, lean)
    const length = extent * (0.28 + u * 0.22)
    const width = length / (2.3 + v * 0.5)
    pieces.push({
      id: `petal-facet-${i}`,
      role: 'secondary',
      kind: 'crystal',
      axis,
      length,
      width,
      depth: width * 0.8,
      roll: azimuth + u,
      profileIndex: (i + 2) % 4,
      nest: 0.01,
      radial: extent * (0.06 + u * 0.08),
      radialAngle: azimuth,
      attachAlong: 0.4 + v * 0.35,
      tint: 0.4 + u * 0.4,
    })
  }

  return pieces
}

/**
 * C — Mineral Network: connected surface lattice + local protrusions.
 */
function planMineralNetwork(seed, extent, basis) {
  const { up, right, forward } = basis
  const pieces = []
  const nodes = []

  /* Graph nodes on the surface disc */
  const nodeCount = 8
  for (let i = 0; i < nodeCount; i += 1) {
    const u = exp03Hash01(seed, i, 5)
    const v = exp03Hash01(seed, i, 17)
    const azimuth = (i / nodeCount) * Math.PI * 2 + (u - 0.5) * 0.5
    const radius = extent * (0.12 + v * 0.55)
    nodes.push({
      id: i,
      azimuth,
      radius,
      x: Math.cos(azimuth) * radius,
      z: Math.sin(azimuth) * radius,
      lift: extent * (0.02 + u * 0.06),
    })
  }

  /* Hub at center */
  pieces.push({
    id: 'net-hub',
    role: 'primary',
    kind: 'crystal',
    axis: up,
    length: extent * 0.36,
    width: extent * 0.18,
    depth: extent * 0.16,
    roll: 0.1,
    profileIndex: 0,
    nest: 0.016,
    radial: 0,
    radialAngle: 0,
    tint: 0.25,
  })

  /* Node protrusions */
  for (const node of nodes) {
    const u = exp03Hash01(seed, node.id, 31)
    const lean = 0.15 + u * 0.35
    const axis = mixAxis(up, right, forward, node.azimuth, lean)
    const length = extent * (0.2 + u * 0.22)
    const width = length / (2.2 + u * 0.4)
    pieces.push({
      id: `net-node-${node.id}`,
      role: 'secondary',
      kind: 'crystal',
      axis,
      length,
      width,
      depth: width * (0.8 + u * 0.2),
      roll: node.azimuth + u,
      profileIndex: (node.id + 1) % 4,
      nest: 0.008,
      radial: node.radius,
      radialAngle: node.azimuth,
      tint: 0.35 + u * 0.4,
    })
  }

  /* Edges between consecutive nodes + spokes to hub */
  for (let i = 0; i < nodeCount; i += 1) {
    const a = nodes[i]
    const b = nodes[(i + 1) % nodeCount]
    const u = exp03Hash01(seed, i, 47)
    const midAz = Math.atan2(
      (Math.sin(a.azimuth) * a.radius + Math.sin(b.azimuth) * b.radius) * 0.5,
      (Math.cos(a.azimuth) * a.radius + Math.cos(b.azimuth) * b.radius) * 0.5,
    )
    const midR = (a.radius + b.radius) * 0.5
    const dx = b.x - a.x
    const dz = b.z - a.z
    const edgeLen = Math.hypot(dx, dz) || extent * 0.2
    /* Edge lies mostly in the tangent plane, slight outward lift. */
    const edgeAxis = normalize3([
      dx * 0.15 + up[0] * 0.35,
      up[1] * 0.85,
      dz * 0.15 + up[2] * 0.35,
    ])
    const length = edgeLen * (0.85 + u * 0.2)
    const width = length / (2.6 + u * 0.5)
    pieces.push({
      id: `net-edge-${i}`,
      role: 'transition',
      kind: 'crystal',
      axis: edgeAxis,
      length,
      width,
      depth: width * 0.7,
      roll: midAz,
      profileIndex: (i + 2) % 4,
      nest: 0.006,
      radial: midR,
      radialAngle: midAz,
      tint: 0.3 + u * 0.35,
    })

    /* Spoke hub → node */
    const spokeLean = 0.35 + u * 0.4
    const spokeAxis = mixAxis(up, right, forward, a.azimuth, spokeLean)
    const spokeLen = a.radius * (0.7 + u * 0.25)
    const spokeWidth = spokeLen / (2.8 + u * 0.4)
    pieces.push({
      id: `net-spoke-${i}`,
      role: 'secondary',
      kind: 'crystal',
      axis: spokeAxis,
      length: Math.max(extent * 0.12, spokeLen),
      width: Math.max(extent * 0.04, spokeWidth),
      depth: Math.max(extent * 0.035, spokeWidth * 0.75),
      roll: a.azimuth * 0.5,
      profileIndex: i % 4,
      nest: 0.01,
      radial: a.radius * 0.35,
      radialAngle: a.azimuth,
      tint: 0.4 + u * 0.3,
    })
  }

  /* Soft tissue film under the network */
  for (let i = 0; i < 5; i += 1) {
    const u = exp03Hash01(seed, i + 100, 3)
    const azimuth = (i / 5) * Math.PI * 2 + u * 0.5
    const axis = mixAxis(up, right, forward, azimuth, 1.1)
    pieces.push({
      id: `net-tissue-${i}`,
      role: 'tissue',
      kind: 'tissue',
      axis,
      length: extent * (0.18 + u * 0.14),
      width: extent * (0.32 + u * 0.12),
      depth: extent * 0.05,
      roll: azimuth,
      profileIndex: i % 3,
      nest: 0.003,
      radial: extent * (0.04 + u * 0.05),
      radialAngle: azimuth,
      tint: 0.1 + u * 0.2,
    })
  }

  return pieces
}

/**
 * Build a morphology plan for the selected lab mode.
 * @returns {{ mode: string, anchor: object, extent: number, pieces: object[] }}
 */
export function buildMorphologyLabPlan(
  mode,
  seed = 1,
  anchor = EXP03_MORPHOLOGY_LAB_ANCHOR,
) {
  const resolved = normalizeExp03MorphologyMode(mode)
  const direction = normalize3(anchor.direction)
  const extent = EXP03_MORPHOLOGY_LAB_EXTENT * (Number(anchor.scale) || 1)
  const basis = orthonormalBasis(direction)

  let pieces
  if (resolved === EXP03_MORPHOLOGY_MODES.CRYSTALLINE_PETALS) {
    pieces = planCrystallinePetals(seed, extent, basis)
  } else if (resolved === EXP03_MORPHOLOGY_MODES.MINERAL_NETWORK) {
    pieces = planMineralNetwork(seed, extent, basis)
  } else {
    pieces = planFacetedBranching(seed, extent, basis)
  }

  return {
    mode: resolved,
    anchor: { ...anchor, direction },
    extent,
    pieces,
  }
}
