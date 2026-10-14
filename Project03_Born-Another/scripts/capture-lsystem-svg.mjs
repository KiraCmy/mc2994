import { writeFileSync, mkdirSync } from 'fs'
import { spawnSync } from 'child_process'
import { buildLSystemGeometry } from '../src/lsystem/generateLSystem.js'

const OUT = '/Users/kira/PCG/mc2994/docs/assets/image'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
mkdirSync(OUT, { recursive: true })
mkdirSync('/tmp/lsystem-frames', { recursive: true })

function project(branches, width = 1280, height = 800, pad = 80) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const b of branches) {
    for (const p of [b.start, b.end]) {
      // Y-up 3D → screen: x' = x + 0.55z, y' = -y (screen down)
      const x = p.x + p.z * 0.55
      const y = -p.y + p.z * 0.18
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  const bw = Math.max(maxX - minX, 0.01)
  const bh = Math.max(maxY - minY, 0.01)
  const scale = Math.min((width - pad * 2) / bw, (height - pad * 2) / bh)
  const ox = (width - bw * scale) / 2 - minX * scale
  const oy = (height - bh * scale) / 2 - minY * scale
  return { toScreen: (p) => {
    const x = p.x + p.z * 0.55
    const y = -p.y + p.z * 0.18
    return [ox + x * scale, oy + y * scale]
  }, scale }
}

function renderSvg(name, options, caption) {
  const { branches } = buildLSystemGeometry(options)
  const width = 1280
  const height = 800
  const { toScreen, scale } = project(branches, width, height)
  const parts = []
  for (const b of branches) {
    const [x1, y1] = toScreen(b.start)
    const [x2, y2] = toScreen(b.end)
    const sw = Math.max(2.2, ((b.radiusStart + b.radiusEnd) * 0.5) * scale * 2.4)
    parts.push(
      `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="#3a3a3c" stroke-width="${sw.toFixed(2)}" stroke-linecap="round"/>`,
    )
  }
  const html = `<!doctype html><html><body style="margin:0;background:#d8d8d8">
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#d8d8d8"/>
  ${parts.join('\n  ')}
  <text x="28" y="40" fill="#ffffff" font-family="ui-sans-serif,system-ui,sans-serif" font-size="22" font-weight="700" letter-spacing="0.04em">BORN ANOTHER</text>
  <text x="28" y="64" fill="#ffffff" font-family="ui-sans-serif,system-ui,sans-serif" font-size="12" font-weight="500" letter-spacing="0.12em">${caption}</text>
</svg></body></html>`
  const htmlPath = `/tmp/lsystem-frames/${name}.html`
  const pngPath = `/tmp/lsystem-frames/${name}.png`
  const jpgPath = `${OUT}/${name}.jpg`
  writeFileSync(htmlPath, html)
  const r = spawnSync(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--window-size=${width},${height}`,
      `--screenshot=${pngPath}`,
      `file://${htmlPath}`,
    ],
    { encoding: 'utf8' },
  )
  if (r.status !== 0) {
    console.error(r.stderr)
    throw new Error(`chrome failed for ${name}`)
  }
  spawnSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '90', pngPath, '--out', jpgPath])
  console.log('wrote', jpgPath)
}

renderSvg(
  'born-another-lsystem-basic',
  { depth: 2, angle: 26, length: 0.55, branchRotation: 0, randomness: 0, seed: 884731 },
  'L-SYSTEM  ·  STEP 1  ·  DEPTH 2',
)
renderSvg(
  'born-another-lsystem-hierarchy',
  { depth: 4, angle: 28, length: 0.55, branchRotation: 25, randomness: 0, seed: 884731 },
  'L-SYSTEM  ·  STEP 2  ·  DEPTH 4  HIERARCHY',
)
renderSvg(
  'born-another-lsystem-3d-branching',
  { depth: 4, angle: 28, length: 0.55, branchRotation: 90, randomness: 0.25, seed: 884731 },
  'L-SYSTEM  ·  STEP 3  ·  ROT 90  RAND 0.25',
)
