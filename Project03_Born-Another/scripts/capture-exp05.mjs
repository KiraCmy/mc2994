/**
 * Capture Exp05 Final Form Lab screenshots for progress docs.
 * Usage: node scripts/capture-exp05.mjs
 */
import { chromium } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../../docs/assets/image')
const base = process.env.EXP05_URL || 'http://127.0.0.1:5173/#playground'

const shots = [
  {
    name: 'born-another-playground-exp05-life-explore.jpg',
    label: 'Full composition default',
    after: async () => {},
  },
  {
    name: 'born-another-playground-exp05-morph-high.jpg',
    label: 'Morphology High preset',
    after: async (page) => {
      const high = page.getByRole('button', { name: 'High', exact: true })
      if (await high.count()) await high.first().click()
      await page.waitForTimeout(1200)
    },
  },
  {
    name: 'born-another-playground-exp05-body-only.jpg',
    label: 'Body Only composition',
    after: async (page) => {
      const medium = page.getByRole('button', { name: 'Medium', exact: true })
      if (await medium.count()) await medium.first().click()
      await page.waitForTimeout(400)
      const bodyOnly = page.getByRole('button', { name: 'Body Only', exact: true })
      if (await bodyOnly.count()) await bodyOnly.first().click()
      await page.waitForTimeout(1200)
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
await page.waitForTimeout(2500)

/* Open lab panel if collapsed */
const labToggle = page.getByRole('button', { name: /Lab Parameters/i })
if (await labToggle.count()) {
  const expanded = await labToggle.getAttribute('aria-expanded')
  if (expanded !== 'true') await labToggle.click()
  await page.waitForTimeout(400)
}

for (const shot of shots) {
  await shot.after(page)
  const dest = path.join(outDir, shot.name)
  await page.screenshot({ path: dest, type: 'jpeg', quality: 82 })
  console.log('wrote', dest, `(${shot.label})`)
}

await browser.close()
console.log('done')
