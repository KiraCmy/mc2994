/**
 * World Final archive sheet: framing the remains (pure; no DOM / three).
 *
 *  - specimenRegion / specimenRadius: where the remains should sit between
 *    the sheet's panels, and how large (responsive to the viewport).
 *  - layoutCallouts: frame, leader lines and label boxes, kept on screen and
 *    off the panels.
 */

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v))
}

/**
 * The free stage between the sheet's panels (px, in the scene's box), with
 * room kept for the callout labels on both sides. `card` (the left column)
 * and `record` (the right panel) are boxes relative to the scene ({left,
 * top, right, bottom}); `bottom` is where the stage must end (px). Any may
 * be null.
 */
export function specimenRegion(width, height, { card = null, record = null, bottom = null, top = 0 } = {}) {
  /* Narrow screens stack the record above the stage (it spans the width). */
  const stacked = Boolean(card && card.right - card.left > width * 0.6)
  const left = card && !stacked ? card.right : width * 0.05
  const right = record ? record.left : width * 0.95
  const free = Math.max(0, right - left)
  const labelRoom = stacked ? 0 : clamp(free * 0.2, 90, 220)
  const y0 = stacked ? Math.max(top, card.bottom + 8) : Math.max(top, card?.top ?? record?.top ?? height * 0.12)
  const y1 = Math.min(height * 0.92, bottom ?? (record ? record.bottom : height * 0.84))
  const x0 = left + labelRoom
  const x1 = Math.max(x0 + 40, right - labelRoom)
  return { x0, y0, x1, y1: Math.max(y0 + 40, y1), cx: (x0 + x1) / 2, cy: (y0 + Math.max(y0 + 40, y1)) / 2, labelRoom }
}

/**
 * Screen radius (px) for the body's sphere: about 58% of what it was when
 * the sheet opened, kept inside the stage. `extent` is how far the
 * silhouette reaches, in body radii (≈1).
 */
export function specimenRadius(region, startRadius, extent = 1, shrink = 0.58) {
  const half = Math.min(region.x1 - region.x0, region.y1 - region.y0) / 2
  const maxR = (half * 0.86) / Math.max(0.4, extent)
  const minR = Math.min(maxR, (half * 0.5) / Math.max(0.4, extent))
  return clamp(startRadius * shrink, minR, maxR)
}

/** Camera distance that shows a sphere of `radius` at `px` screen radius. */
export function distanceForRadius(radius, px, viewHeight, fovDeg) {
  const t = Math.tan(((fovDeg * Math.PI) / 180) / 2)
  return (radius * viewHeight) / (2 * Math.max(1, px) * t)
}

/**
 * Frame and callouts. `box` is the silhouette in px; `anchors` maps id → [x,
 * y] px on the body; `sizes` maps id → {w, h} of each label; `safe` the area
 * labels may use ({left, top, right, bottom}). Returns per callout the
 * polyline points and label position (top-left), all inside `safe`.
 */
export function layoutCallouts(box, anchors, sizes, safe) {
  const w = box.x1 - box.x0
  const h = box.y1 - box.y0
  const gap = 6
  const out = {}
  const place = (id, side, ey) => {
    const size = sizes[id] ?? { w: 160, h: 44 }
    const p = anchors[id]
    let e
    let l
    if (side === 'left') {
      const ex = clamp(box.x0 - Math.max(18, w * 0.13), safe.left + 24, box.x0)
      e = [ex, ey]
      const lx = clamp(ex - Math.max(size.w, 90), safe.left, ex - 24)
      l = [lx, ey]
    } else {
      const ex = clamp(box.x1 + Math.max(18, w * 0.13), box.x1, safe.right - 24)
      e = [ex, ey]
      const lx = clamp(ex + Math.max(size.w, 90), ex + 24, safe.right)
      l = [lx, ey]
    }
    const lineY = clamp(ey, safe.top + size.h + gap, safe.bottom)
    e[1] = lineY
    l[1] = lineY
    const labelX = side === 'left' ? l[0] : e[0]
    const labelW = Math.abs(l[0] - e[0])
    out[id] = { points: [p, e, l], label: { x: labelX, y: lineY - gap - size.h, w: labelW } }
  }
  place('mineral', 'left', box.y0 + h * 0.08)
  place('membrane', 'right', box.y0 + h * 0.22)
  /* Core: from inside the lower right, out past the frame. */
  const coreY = Math.min(box.y0 + h * 0.92, safe.bottom)
  place('core', 'right', coreY)
  /* Keep the two right-hand labels apart. */
  const m = out.membrane
  const k = out.core
  const minGap = (sizes.core?.h ?? 44) + 14
  if (k.label.y - m.points[1][1] < minGap) {
    const ny = Math.min(safe.bottom, m.points[1][1] + minGap + gap)
    k.points[1][1] = ny
    k.points[2][1] = ny
    k.label.y = ny - gap - (sizes.core?.h ?? 44)
  }
  return out
}
