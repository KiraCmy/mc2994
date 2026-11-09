/*
 * Ammonite plate geometry (pure): lateral view from a logarithmic spiral —
 * involute whorls, sinuous ribs branching toward the venter, the aperture —
 * plus a median section with septa. Used by AmmonitePlate.jsx.
 */
const TAU = Math.PI * 2
const WHORLS = 4.1
const EXPANSION = 2.05 /* whorl height ratio per turn */
const B = Math.log(EXPANSION) / TAU

function spiral(cx, cy, R, thetaMax) {
  const a = R / Math.exp(B * thetaMax)
  const r = (th) => a * Math.exp(B * th)
  const at = (th, rr = r(th)) => [cx + Math.cos(-th + 2.2) * rr, cy + Math.sin(-th + 2.2) * rr]
  return { r, at }
}

function pathOf(points) {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')
}

export function buildPlate() {
  const cx = 196
  const cy = 196
  const thetaMax = WHORLS * TAU
  const { r, at } = spiral(cx, cy, 148, thetaMax)
  const outline = []
  for (let th = 0.6; th <= thetaMax; th += 0.04) outline.push(at(th))
  const seam = []
  for (let th = TAU + 0.6; th <= thetaMax; th += 0.04) seam.push(at(th, r(th - TAU) * 1.0))
  /* Ribs: from the seam of the previous whorl out to the venter, bowing
     forward; every second rib splits two thirds of the way out. */
  const ribs = []
  for (let th = TAU * 1.4; th <= thetaMax - 0.05; th += TAU / (22 + (th / TAU) * 3)) {
    const inner = r(th - TAU) * 1.02
    const outer = r(th) * 0.985
    const pts = []
    for (let s = 0; s <= 1.0001; s += 0.1) {
      const rr = inner + (outer - inner) * s
      const bow = Math.sin(s * Math.PI) * 0.09 - s * 0.05
      pts.push(at(th + bow, rr))
    }
    ribs.push(pathOf(pts))
    if (Math.round(th * 10) % 2 === 0 && th > TAU * 2.2) {
      const branch = []
      for (let s = 0.62; s <= 1.0001; s += 0.08) {
        const rr = inner + (outer - inner) * s
        branch.push(at(th + 0.07 + (s - 0.62) * 0.1, rr))
      }
      ribs.push(pathOf(branch))
    }
  }
  const aperture = pathOf([at(thetaMax), at(thetaMax, r(thetaMax - TAU))])
  /* Median section inset: chambers separated by septa along the spiral. */
  const sx = 330
  const sy = 330
  const sec = spiral(sx, sy, 46, 3.2 * TAU)
  const secOutline = []
  for (let th = 0.5; th <= 3.2 * TAU; th += 0.05) secOutline.push(sec.at(th))
  const septa = []
  for (let th = TAU * 0.9; th <= 3.2 * TAU - 0.9; th += 0.42) {
    septa.push(pathOf([sec.at(th, sec.r(th - TAU) * 1.02), sec.at(th - 0.18, sec.r(th) * 0.98)]))
  }
  const venter = at(thetaMax - 1.1)
  const umb = at(TAU * 1.2)
  const ribAt = at(thetaMax - 2.4, r(thetaMax - 2.4) * 0.8)
  const ap = at(thetaMax, r(thetaMax) * 0.96)
  return { outline: pathOf(outline), seam: pathOf(seam), ribs, aperture, secOutline: pathOf(secOutline), septa, venter, umb, ribAt, ap, cx, cy }
}


/** The same plate as an SVG string (previews / exports). */
export function plateSvgString() {
  const p = buildPlate()
  const label = (from, to, text, anchor = 'start') =>
    `<g class="exp07-plate__label"><path d="M${from[0].toFixed(1)} ${from[1].toFixed(1)}L${to[0]} ${to[1]}"/><circle cx="${from[0].toFixed(1)}" cy="${from[1].toFixed(1)}" r="1.6"/><text x="${to[0] + (anchor === 'start' ? 4 : -4)}" y="${to[1] + 3}" text-anchor="${anchor}">${text}</text></g>`
  return `<svg class="exp07-plate" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="400" class="exp07-plate__ground"/><g><path d="${p.outline}" class="exp07-plate__outline"/><path d="${p.seam}" class="exp07-plate__seam"/>${p.ribs.map((d) => `<path d="${d}" class="exp07-plate__rib"/>`).join('')}<path d="${p.aperture}" class="exp07-plate__outline"/></g><g><path d="${p.secOutline}" class="exp07-plate__seam"/>${p.septa.map((d) => `<path d="${d}" class="exp07-plate__septum"/>`).join('')}<text x="326" y="392" text-anchor="middle">SECTION · CHAMBERS</text></g>${label(p.umb, [28, 300], 'UMBILICUS')}${label(p.venter, [372, 64], 'VENTER', 'end')}${label(p.ribAt, [28, 48], 'RIBS')}${label(p.ap, [372, 238], 'APERTURE', 'end')}<g class="exp07-plate__scale"><path d="M58 374H138"/><path d="M58 370V378M98 371V377M138 370V378"/><text x="58" y="392">5 CM</text></g><text x="24" y="22" class="exp07-plate__title">PL. VII — AMMONOIDEA · LATERAL VIEW</text></svg>`
}
