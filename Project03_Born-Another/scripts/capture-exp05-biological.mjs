/**
 * Capture Exp05 Biological Membrane screenshots for progress docs.
 * Usage: node scripts/capture-exp05-biological.mjs
 */
import { chromium } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../../docs/assets/image')
const base = process.env.EXP05_URL || 'http://127.0.0.1:5173/#playground'

async function openLab(page) {
  const labToggle = page.getByRole('button', { name: /Lab Parameters/i })
  if (await labToggle.count()) {
    const expanded = await labToggle.getAttribute('aria-expanded')
    if (expanded !== 'true') await labToggle.click()
    await page.waitForTimeout(400)
  }
}

async function clickMaterial(page, label) {
  const btn = page.getByRole('button', { name: label, exact: true })
  if (await btn.count()) await btn.first().click()
  await page.waitForTimeout(1400)
}

const shots = [
  {
    name: 'born-another-playground-exp05-biological-membrane.jpg',
    label: 'Biological Membrane (default)',
    after: async (page) => {
      await clickMaterial(page, 'Biological Membrane')
    },
  },
  {
    name: 'born-another-playground-exp05-pearlescent-ab.jpg',
    label: 'Pearlescent Membrane A/B',
    after: async (page) => {
      await clickMaterial(page, 'Pearlescent Membrane')
    },
  },
]

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
})

page.setDefaultTimeout(60000)
await page.goto(base, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

const exp05Tab = page.getByRole('tab', { name: /Experiment 05/i })
await exp05Tab.click()
await page.waitForTimeout(2800)
await openLab(page)

for (const shot of shots) {
  await shot.after(page)
  const dest = path.join(outDir, shot.name)
  await page.screenshot({ path: dest, type: 'jpeg', quality: 82 })
  console.log('wrote', dest, `(${shot.label})`)
}

await browser.close()
console.log('done')
