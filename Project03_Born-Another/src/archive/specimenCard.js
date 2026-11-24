/**
 * The Life Archive specimen card: one portrait (4:5) plate per kept life,
 * drawn on a canvas so the card on screen and the exported PNG are the same
 * picture (same fonts — the page's own Anybody — same marks, same grain).
 *
 *   drawSpecimenCard(ctx, width, data, assets) — draws the whole card.
 *   cardData(entry, number)                     — what the card says (real record).
 *   loadCardAssets(entry)                       — its pictures and fonts.
 *   exportSpecimenCard(entry, number)           — a high-resolution PNG download.
 *
 * The design space is 800 × 1000; everything is drawn in it and scaled.
 */
import { finalCondition, lastWords, lifeSpan, lifeStages } from './archiveText.js'
import { anatomyCallouts } from '../playground/finalHabitat/revealRecord.js'

export const CARD_W = 800
export const CARD_H = 1000

const FONT = 'Anybody, sans-serif'
const INK = '#f1eef8'
const SOFT = 'rgba(236, 232, 244, 0.78)'
const FAINT = 'rgba(236, 232, 244, 0.5)'
const HAIR = 'rgba(236, 232, 244, 0.26)'
const LINE = 'rgba(236, 232, 244, 0.72)'

const SPECIES_OF_FOSSIL = { ammonite: 'spiral', dickinsonia: 'segmented', trilobite: 'trilobite' }

/* ------------------------------------------------------------------ data */

/** Everything the card states, from the archive record (no invented values). */
export function cardData(entry, number) {
  const env = entry?.environment ?? {}
  const level = Number(entry?.crystallization ?? 0)
  const digits = String(number ?? '').replace(/\D/g, '')
  const species = entry?.species ?? SPECIES_OF_FOSSIL[entry?.fossilId] ?? 'spiral'
  const saved = entry?.savedAt ? new Date(entry.savedAt) : null
  return {
    no: digits ? digits.padStart(4, '0') : '—',
    name: entry?.name ?? 'Unknown life',
    latin: entry?.latin || entry?.name || '—',
    lifespan: lifeSpan(entry?.lived),
    env: {
      temperature: Number(env.temperature ?? 0),
      moisture: Number(env.moisture ?? 0),
      turbulence: Number(env.turbulence ?? 0),
    },
    condition: finalCondition(level),
    stages: lifeStages(entry),
    last: lastWords(entry),
    callouts: anatomyCallouts({ species, env, level }),
    kept: saved && !Number.isNaN(saved.getTime()) ? saved : null,
    seed: entry?.seed ?? null,
    generation: entry?.generation ?? null,
    fossilId: entry?.fossilId ?? 'ammonite',
  }
}

/* ------------------------------------------------------------ silhouette */

/**
 * The remains' silhouette in a cut-out picture: bounding box and three
 * points on the body (for the callouts), in 0..1 of the picture. `alpha` is
 * one alpha value per pixel of a size×size sample. Null when empty.
 */
export function pictureSilhouette(alpha, size, threshold = 90) {
  let x0 = size
  let y0 = size
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (alpha[y * size + x] < threshold) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  if (x1 < x0 || y1 < y0) return null
  const c = (size - 1) / 2
  const nearest = (fx, fy, inset) => {
    const tx = x0 + fx * (x1 - x0)
    const ty = y0 + fy * (y1 - y0)
    let bx = Math.round(c)
    let by = Math.round(c)
    let bd = Infinity
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (alpha[y * size + x] < threshold) continue
        const d = (x - tx) ** 2 + (y - ty) ** 2
        if (d < bd) {
          bd = d
          bx = x
          by = y
        }
      }
    }
    return [(bx + (c - bx) * inset + 0.5) / size, (by + (c - by) * inset + 0.5) / size]
  }
  return {
    box: { x0: x0 / size, y0: y0 / size, x1: (x1 + 1) / size, y1: (y1 + 1) / size },
    anchors: { mineral: nearest(0.22, 0.2, 0.08), membrane: nearest(0.98, 0.45, 0.08), core: nearest(0.56, 0.6, 0) },
  }
}

/* ---------------------------------------------------------------- assets */

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null)
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

const PLATE_STYLE = `
.exp07-plate__ground{fill:none}
.exp07-plate__outline{fill:rgba(236,228,240,0.06);stroke:#ece6f2;stroke-width:1.3}
.exp07-plate__seam{fill:none;stroke:rgba(236,230,242,0.75);stroke-width:0.9}
.exp07-plate__rib{fill:none;stroke:rgba(236,230,242,0.55);stroke-width:0.7;stroke-linecap:round}
.exp07-plate__septum{fill:none;stroke:rgba(236,230,242,0.55);stroke-width:0.6}
.exp07-plate text{display:none}
.exp07-plate__label,.exp07-plate__scale{display:none}`

/** The drawn fossil plate (FossilPlate) as a picture for the canvas. */
async function loadPlate(fossilId) {
  try {
    const [{ renderToStaticMarkup }, { createElement }, { default: FossilPlate }] = await Promise.all([
      import('react-dom/server'),
      import('react'),
      import('../playground/finalHabitat/FossilPlate.jsx'),
    ])
    let svg = renderToStaticMarkup(createElement(FossilPlate, { id: fossilId }))
    svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"')
    svg = svg.replace(/(<svg[^>]*>)/, `$1<style>${PLATE_STYLE}</style>`)
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    const img = await loadImage(url)
    URL.revokeObjectURL(url)
    return img
  } catch {
    return null
  }
}

function silhouetteOf(img) {
  if (!img) return null
  try {
    const n = 128
    const c = document.createElement('canvas')
    c.width = c.height = n
    const g = c.getContext('2d', { willReadFrequently: true })
    g.drawImage(img, 0, 0, n, n)
    const px = g.getImageData(0, 0, n, n).data
    const alpha = new Uint8ClampedArray(n * n)
    for (let i = 0; i < n * n; i++) alpha[i] = px[i * 4 + 3]
    return pictureSilhouette(alpha, n)
  } catch {
    return null
  }
}

/** Pictures (remains, stages, plate), their silhouette, and the fonts used. */
export async function loadCardAssets(entry) {
  const stages = lifeStages(entry)
  const urls = [...new Set([entry?.image, ...stages.map((s) => s.image)].filter(Boolean))]
  const [images, plate] = await Promise.all([
    Promise.all(urls.map((u) => loadImage(u).then((img) => [u, img]))),
    loadPlate(entry?.fossilId ?? 'ammonite'),
    loadFonts(),
  ])
  const byUrl = new Map(images)
  const remains = entry?.image ? byUrl.get(entry.image) ?? null : null
  return { byUrl, remains, plate, silhouette: silhouetteOf(remains) }
}

async function loadFonts() {
  if (typeof document === 'undefined' || !document.fonts?.load) return
  try {
    await Promise.all(
      ['300 20px Anybody', '400 20px Anybody', '500 20px Anybody', '600 20px Anybody', 'italic 300 20px Anybody', 'italic 400 20px Anybody'].map((f) =>
        document.fonts.load(f),
      ),
    )
  } catch {
    /* Fall back to whatever is available. */
  }
}

/* --------------------------------------------------------------- drawing */

function setFont(ctx, { size, weight = 400, italic = false }) {
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${FONT}`
}

const canSpace = typeof CanvasRenderingContext2D !== 'undefined' && 'letterSpacing' in CanvasRenderingContext2D.prototype

/** Width of a run of text with letter spacing (em). */
function measure(ctx, str, spacing, size) {
  if (canSpace) {
    ctx.letterSpacing = `${spacing * size}px`
    const w = ctx.measureText(str).width
    ctx.letterSpacing = '0px'
    return w - (str.length ? spacing * size : 0)
  }
  return ctx.measureText(str).width + Math.max(0, str.length - 1) * spacing * size
}

/** Text with letter spacing (em) and alignment; returns its width. */
function text(ctx, str, x, y, { size, weight = 400, italic = false, spacing = 0, color = INK, align = 'left', upper = false } = {}) {
  const s = upper ? String(str).toUpperCase() : String(str)
  setFont(ctx, { size, weight, italic })
  ctx.fillStyle = color
  ctx.textBaseline = 'alphabetic'
  const w = measure(ctx, s, spacing, size)
  let left = x
  if (align === 'right') left = x - w
  else if (align === 'center') left = x - w / 2
  if (!spacing) {
    ctx.textAlign = 'left'
    ctx.fillText(s, left, y)
  } else if (canSpace) {
    ctx.textAlign = 'left'
    ctx.letterSpacing = `${spacing * size}px`
    ctx.fillText(s, left, y)
    ctx.letterSpacing = '0px'
  } else {
    ctx.textAlign = 'left'
    let cx = left
    for (const ch of s) {
      ctx.fillText(ch, cx, y)
      cx += ctx.measureText(ch).width + spacing * size
    }
  }
  return w
}

function hline(ctx, x0, x1, y, color = HAIR, width = 0.8) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(x0, y)
  ctx.lineTo(x1, y)
  ctx.stroke()
}

function vline(ctx, x, y0, y1, color = HAIR, width = 0.8) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(x, y0)
  ctx.lineTo(x, y1)
  ctx.stroke()
}

/** Split text into at most `max` lines of `width`, with an ellipsis if cut. */
function wrap(ctx, str, width, max) {
  const words = String(str).split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width <= width || !line) line = next
    else {
      lines.push(line)
      line = w
    }
  }
  if (line) lines.push(line)
  if (lines.length > max) {
    const kept = lines.slice(0, max)
    let last = kept[max - 1]
    while (last.length > 1 && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1)
    kept[max - 1] = `${last.trimEnd()}…`
    return kept
  }
  /* A single word wider than the line: shorten it. */
  return lines.map((l) => {
    if (ctx.measureText(l).width <= width) return l
    let s = l
    while (s.length > 1 && ctx.measureText(`${s}…`).width > width) s = s.slice(0, -1)
    return `${s}…`
  })
}

let grainTile = null
function grain() {
  if (grainTile || typeof document === 'undefined') return grainTile
  const n = 160
  const c = document.createElement('canvas')
  c.width = c.height = n
  const g = c.getContext('2d')
  const img = g.createImageData(n, n)
  /* Deterministic noise (same grain on screen and in the export). */
  let s = 1234567
  for (let i = 0; i < n * n; i++) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0
    const v = s >>> 24
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  }
  g.putImageData(img, 0, 0)
  grainTile = c
  return c
}

function drawContain(ctx, img, cx, cy, size) {
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  const k = size / Math.max(w, h)
  ctx.drawImage(img, cx - (w * k) / 2, cy - (h * k) / 2, w * k, h * k)
}

/** Card background: deep blue-violet, a glow behind the remains, smoke, grain. */
function drawGround(ctx) {
  ctx.fillStyle = '#15131f'
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  let g = ctx.createRadialGradient(400, 262, 10, 400, 262, 380)
  g.addColorStop(0, 'rgba(126, 100, 206, 0.42)')
  g.addColorStop(0.45, 'rgba(84, 66, 150, 0.18)')
  g.addColorStop(1, 'rgba(20, 18, 32, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  g = ctx.createLinearGradient(0, 0, 0, CARD_H)
  g.addColorStop(0, 'rgba(255, 255, 255, 0.02)')
  g.addColorStop(0.5, 'rgba(0, 0, 0, 0)')
  g.addColorStop(1, 'rgba(6, 6, 12, 0.35)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  /* Smoke: soft violet threads drifting around the remains. */
  ctx.save()
  ctx.filter = 'blur(2.5px)'
  ctx.lineCap = 'round'
  const threads = [
    [70, 300, 220, 170, 330, 380, 500, 250, 0.16],
    [130, 420, 260, 300, 520, 420, 730, 260, 0.12],
    [500, 110, 610, 190, 640, 120, 760, 210, 0.14],
    [250, 120, 330, 60, 470, 150, 560, 90, 0.1],
    [560, 380, 620, 320, 690, 400, 770, 340, 0.12],
  ]
  for (const [x0, y0, c1x, c1y, c2x, c2y, x1, y1, a] of threads) {
    ctx.strokeStyle = `rgba(190, 166, 255, ${a})`
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x1, y1)
    ctx.stroke()
  }
  ctx.restore()
  const tile = grain()
  if (tile) {
    ctx.save()
    ctx.globalAlpha = 0.06
    ctx.globalCompositeOperation = 'overlay'
    ctx.fillStyle = ctx.createPattern(tile, 'repeat')
    ctx.fillRect(0, 0, CARD_W, CARD_H)
    ctx.restore()
  }
}

function drawFrame(ctx) {
  ctx.strokeStyle = 'rgba(236, 232, 244, 0.4)'
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, CARD_W - 1, CARD_H - 1)
  ctx.strokeStyle = 'rgba(236, 232, 244, 0.55)'
  ctx.lineWidth = 0.9
  const i = 16
  const l = 12
  for (const [x, y, dx, dy] of [
    [i, i, 1, 1],
    [CARD_W - i, i, -1, 1],
    [i, CARD_H - i, 1, -1],
    [CARD_W - i, CARD_H - i, -1, -1],
  ]) {
    ctx.beginPath()
    ctx.moveTo(x + dx * l, y)
    ctx.lineTo(x, y)
    ctx.lineTo(x, y + dy * l)
    ctx.stroke()
  }
}

/** The remains, their frame and the three marked parts. */
function drawFigure(ctx, data, assets) {
  const cx = 400
  const cy = 262
  const S = 300
  /* Halo behind the body. */
  const halo = ctx.createRadialGradient(cx, cy, 20, cx, cy, 220)
  halo.addColorStop(0, 'rgba(178, 150, 255, 0.34)')
  halo.addColorStop(1, 'rgba(178, 150, 255, 0)')
  ctx.fillStyle = halo
  ctx.fillRect(cx - 230, cy - 230, 460, 460)

  const sil = assets?.silhouette
  const box = sil
    ? { x0: cx - S / 2 + sil.box.x0 * S, y0: cy - S / 2 + sil.box.y0 * S, x1: cx - S / 2 + sil.box.x1 * S, y1: cy - S / 2 + sil.box.y1 * S }
    : { x0: cx - S * 0.4, y0: cy - S * 0.4, x1: cx + S * 0.4, y1: cy + S * 0.4 }
  const pad = 12
  box.x0 -= pad
  box.y0 -= pad
  box.x1 += pad
  box.y1 += pad

  if (assets?.remains) {
    ctx.save()
    ctx.shadowColor = 'rgba(180, 152, 255, 0.55)'
    ctx.shadowBlur = 34
    drawContain(ctx, assets.remains, cx, cy, S)
    ctx.restore()
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.globalAlpha = 0.18
    drawContain(ctx, assets.remains, cx, cy, S)
    ctx.restore()
  } else if (assets?.plate) {
    ctx.save()
    ctx.globalAlpha = 0.85
    drawContain(ctx, assets.plate, cx, cy, S * 0.86)
    ctx.restore()
  }

  /* Frame with handles. */
  ctx.strokeStyle = LINE
  ctx.lineWidth = 0.8
  ctx.strokeRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0)
  ctx.fillStyle = INK
  const mx = (box.x0 + box.x1) / 2
  const my = (box.y0 + box.y1) / 2
  for (const [x, y] of [
    [box.x0, box.y0], [mx, box.y0], [box.x1, box.y0], [box.x1, my],
    [box.x1, box.y1], [mx, box.y1], [box.x0, box.y1], [box.x0, my],
  ]) ctx.fillRect(x - 2.6, y - 2.6, 5.2, 5.2)

  /* Callouts: real points on the body when the picture has an outline. */
  const fallback = { mineral: [0.3, 0.28], membrane: [0.86, 0.46], core: [0.56, 0.62] }
  const at = (id) => {
    const a = sil?.anchors?.[id] ?? fallback[id]
    return [cx - S / 2 + a[0] * S, cy - S / 2 + a[1] * S]
  }
  const byId = Object.fromEntries(data.callouts.map((c) => [c.id, c]))
  /* Title and description lines sit above the rule; returns their width. */
  const label = (c, x, ruleY) => {
    const lines = c.lines.map((l) => l.toUpperCase())
    setFont(ctx, { size: 9.5, weight: 400 })
    const lw = Math.max(...lines.map((l) => measure(ctx, l, 0.04, 9.5)))
    setFont(ctx, { size: 16, weight: 600 })
    const tw = measure(ctx, c.title.toUpperCase(), 0.01, 16)
    lines.forEach((l, i) => text(ctx, l, x, ruleY - 8 - (lines.length - 1 - i) * 13, { size: 9.5, weight: 400, spacing: 0.04, color: SOFT }))
    text(ctx, c.title, x, ruleY - 8 - lines.length * 13 - 6, { size: 16, weight: 600, spacing: 0.01, upper: true })
    return Math.max(lw, tw)
  }
  const leader = (pts) => {
    ctx.strokeStyle = LINE
    ctx.lineWidth = 0.8
    ctx.beginPath()
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.stroke()
    const [px, py] = pts[0]
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(px, py, 3, 0, Math.PI * 2)
    ctx.fill()
    const [ex, ey] = pts[pts.length - 1]
    ctx.beginPath()
    ctx.arc(ex, ey, 1.8, 0, Math.PI * 2)
    ctx.fill()
  }
  if (byId.mineral) {
    const ruleY = 172
    const w = label(byId.mineral, 48, ruleY)
    const end = Math.min(box.x0 - 14, 48 + w + 18)
    leader([at('mineral'), [end, ruleY], [48, ruleY]])
  }
  if (byId.membrane) {
    const ruleY = 258
    const x = Math.max(box.x1 + 30, 586)
    const w = label(byId.membrane, x, ruleY)
    leader([at('membrane'), [x - 12, ruleY], [Math.min(752, x + w), ruleY]])
  }
  if (byId.core) {
    const ruleY = Math.min(432, Math.max(box.y1 + 6, 392))
    const x = Math.max(box.x1 + 30, 586)
    const w = label(byId.core, x, ruleY)
    leader([at('core'), [x - 12, ruleY], [Math.min(752, x + w), ruleY]])
  }

  /* Scale bar. */
  text(ctx, '2 mm', 52, 426, { size: 10, weight: 400, color: SOFT })
  hline(ctx, 52, 104, 436, SOFT, 0.8)
  vline(ctx, 52, 432, 440, SOFT, 0.8)
  vline(ctx, 104, 432, 440, SOFT, 0.8)
}

/** Name, number, record rows, timeline, last words, foot. */
function drawRecord(ctx, data, assets) {
  const L = 48
  const R = 752
  hline(ctx, L, R, 456)

  /* Name: big and bold, shrunk only if it would not fit. */
  let size = 62
  setFont(ctx, { size, weight: 600 })
  while (size > 30 && measure(ctx, data.name.toUpperCase(), -0.01, size) > 500) {
    size -= 2
    setFont(ctx, { size, weight: 600 })
  }
  const nameGrad = ctx.createLinearGradient(0, 470, 0, 520)
  nameGrad.addColorStop(0, '#ffffff')
  nameGrad.addColorStop(1, '#d9d0f0')
  text(ctx, data.name, L - 2, 516, { size, weight: 600, spacing: -0.01, color: nameGrad, upper: true })
  text(ctx, 'A life that could have been.', L, 546, { size: 20, weight: 300, italic: true, color: SOFT })

  /* The number and the plate below it share one left edge. */
  const NUM_X = 604
  vline(ctx, NUM_X - 26, 456, 562)
  text(ctx, 'No.', NUM_X, 490, { size: 11, weight: 500, spacing: 0.3, color: SOFT, upper: true })
  text(ctx, data.no, NUM_X - 2, 538, { size: 46, weight: 500, spacing: 0.02 })
  hline(ctx, L, R, 562)

  /* Record rows. */
  const rows = [
    ['Species', data.latin],
    ['Lifespan', data.lifespan],
    ['Environment', `T ${data.env.temperature.toFixed(2)}   M ${data.env.moisture.toFixed(2)}   Turb ${data.env.turbulence.toFixed(2)}`],
    ['Final condition', data.condition],
  ]
  rows.forEach(([k, v], i) => {
    const y = 592 + i * 26
    text(ctx, k, L, y, { size: 11, weight: 500, spacing: 0.16, upper: true })
    text(ctx, v, 226, y, { size: 13, weight: 300, italic: true, spacing: 0.04, color: SOFT, upper: true })
  })
  /* The drawn plate of the creature it was identified as. */
  const px0 = NUM_X
  const py0 = 576
  const pw = R - NUM_X
  const ph = 100
  ctx.strokeStyle = 'rgba(236, 232, 244, 0.42)'
  ctx.lineWidth = 0.8
  ctx.strokeRect(px0, py0, pw, ph)
  ctx.fillStyle = INK
  for (const [x, y] of [[px0, py0], [px0 + pw, py0], [px0, py0 + ph], [px0 + pw, py0 + ph]]) ctx.fillRect(x - 1.6, y - 1.6, 3.2, 3.2)
  if (assets?.plate) {
    ctx.save()
    ctx.globalAlpha = 0.9
    drawContain(ctx, assets.plate, px0 + pw / 2, py0 + ph / 2, ph * 0.92)
    ctx.restore()
  }
  hline(ctx, L, R, 690)

  /* Life timeline. */
  text(ctx, 'Life timeline', L, 716, { size: 11, weight: 500, spacing: 0.2, upper: true })
  const cols = [132, 300, 480, 664]
  data.stages.forEach((s, i) => {
    const x = cols[i]
    const img = s.image ? assets?.byUrl?.get(s.image) : null
    const size = 66 * (s.scale ?? 1)
    if (img) {
      ctx.save()
      ctx.shadowColor = 'rgba(180, 152, 255, 0.5)'
      ctx.shadowBlur = 14
      drawContain(ctx, img, x, 756, size)
      ctx.restore()
    } else {
      ctx.strokeStyle = HAIR
      ctx.setLineDash([2, 3])
      ctx.beginPath()
      ctx.arc(x, 756, size * 0.32, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }
    text(ctx, s.label, x, 800, { size: 10.5, weight: 500, spacing: 0.12, align: 'center', upper: true })
    text(ctx, s.t == null ? '—' : clock(s.t), x, 817, { size: 11, weight: 300, spacing: 0.06, align: 'center', color: SOFT })
    if (i < cols.length - 1) {
      const ax = (x + cols[i + 1]) / 2
      ctx.strokeStyle = SOFT
      ctx.lineWidth = 0.9
      ctx.beginPath()
      ctx.moveTo(ax - 9, 756)
      ctx.lineTo(ax + 9, 756)
      ctx.moveTo(ax + 4, 752)
      ctx.lineTo(ax + 9, 756)
      ctx.lineTo(ax + 4, 760)
      ctx.stroke()
    }
  })
  hline(ctx, L, R, 834)

  /* Last words, in the archive's italic. */
  const last = data.last
  const quote = last ? `“${last.text}”` : 'no words'
  let qSize = last ? 30 : 28
  setFont(ctx, { size: qSize, weight: 300, italic: true })
  let lines = wrap(ctx, quote, R - 226, 2)
  if (lines.length > 1) {
    qSize = 24
    setFont(ctx, { size: qSize, weight: 300, italic: true })
    lines = wrap(ctx, quote, R - 226, 2)
  }
  const mid = 877
  const lh = qSize * 1.15
  const firstY = mid + qSize * 0.35 - ((lines.length - 1) * lh) / 2
  text(ctx, `Last words  /`, L, mid + 4, { size: 11, weight: 500, spacing: 0.2, upper: true })
  if (last) text(ctx, clock(last.t), L, mid + 22, { size: 10, weight: 300, spacing: 0.08, color: FAINT })
  lines.forEach((l, i) => text(ctx, l, 226, firstY + i * lh, { size: qSize, weight: 300, italic: true, color: last ? INK : FAINT }))
  hline(ctx, L, R, 920)

  /* Foot: when it was kept, and which life it was. */
  const kept = data.kept ? data.kept.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  text(ctx, `Kept ${kept}`, L, 956, { size: 9.5, weight: 500, spacing: 0.22, color: FAINT, upper: true })
  const ident = [data.seed != null ? `Seed ${data.seed}` : null, data.generation != null ? `Gen ${data.generation}` : null].filter(Boolean).join('  ·  ')
  text(ctx, ident || 'Born Another', R, 956, { size: 9.5, weight: 500, spacing: 0.22, color: FAINT, align: 'right', upper: true })
}

function clock(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Draws the card at `width` px wide (height = width × 5/4). */
export function drawSpecimenCard(ctx, width, data, assets) {
  const k = width / CARD_W
  ctx.save()
  ctx.setTransform(k, 0, 0, k, 0, 0)
  ctx.clearRect(0, 0, CARD_W, CARD_H)
  drawGround(ctx)
  /* Header. */
  text(ctx, 'Born Another', 48, 52, { size: 15, weight: 400, spacing: 0.46, upper: true })
  text(ctx, 'Life Archive', 48, 72, { size: 10, weight: 400, spacing: 0.5, color: SOFT, upper: true })
  text(ctx, `Archive card   /   ${data.no}`, 752, 56, { size: 11, weight: 400, spacing: 0.12, color: SOFT, align: 'right', upper: true })
  drawFigure(ctx, data, assets)
  drawRecord(ctx, data, assets)
  drawFrame(ctx)
  ctx.restore()
}

/* ---------------------------------------------------------------- export */

/** The card alone as a PNG, `width` px wide (default 2000 × 2500). */
export async function specimenCardBlob(entry, number, width = 2000) {
  const assets = await loadCardAssets(entry)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = Math.round((width * CARD_H) / CARD_W)
  const ctx = canvas.getContext('2d')
  drawSpecimenCard(ctx, width, cardData(entry, number), assets)
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
}

/** Downloads the card as `born-another-<name>-<no>.png`. */
export async function exportSpecimenCard(entry, number) {
  const blob = await specimenCardBlob(entry, number)
  if (!blob) return false
  const data = cardData(entry, number)
  const slug = String(data.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'life'
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `born-another-${slug}-${data.no}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return true
}
