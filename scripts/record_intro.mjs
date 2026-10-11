import { chromium } from 'playwright'
import fs from 'node:fs'; import path from 'node:path'
const OUT = path.resolve('data/cache/demo'); fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } } })
const page = await ctx.newPage()
await page.goto('file://' + path.resolve('scripts/intro.html'), { waitUntil: 'networkidle' })
await page.waitForTimeout(4200)
await page.close(); const f = await (await page.video()).path(); await ctx.close(); await browser.close()
fs.renameSync(f, path.join(OUT, 'intro.webm')); console.log('intro saved')
