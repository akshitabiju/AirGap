// Capture the demo states as 1920x1080 PNGs from the live site (headless; screenshots are reliable where video wasn't).
// Usage: node scripts/shots.mjs  -> data/cache/demo/shots/<name>.png
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const URL = 'https://main.d3cvwqcst393r5.amplifyapp.com/?static=1'
const OUT = path.resolve('data/cache/demo/shots'); fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, geolocation: { latitude: 19.3149, longitude: 84.7941 }, permissions: ['geolocation'], locale: 'en-IN', timezoneId: 'Asia/Kolkata' })
// freeze CSS animations so screenshots are crisp; keep layout
await ctx.addInitScript(() => { addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '*,*::before,*::after{animation-duration:0.001s!important;transition-duration:0.001s!important} [data-reveal]{opacity:1!important;transform:none!important}'; document.head.appendChild(st) }) })
const page = await ctx.newPage()
const have = (name) => fs.existsSync(path.join(OUT, `${name}.png`))
const shot = async (name) => { if (have(name)) { console.log('skip', name); return } await page.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log('shot', name) }
const click = async (sel) => { const el = page.locator(sel).first(); await el.evaluate((n) => n.scrollIntoView({ block: 'center' })).catch(() => {}); await sleep(300); await el.click({ timeout: 15000, force: true }) }
const hover = async (sel) => { const el = page.locator(sel).first(); await el.evaluate((n) => n.scrollIntoView({ block: 'center' })).catch(() => {}); await sleep(300); await el.hover({ timeout: 15000, force: true }) }
const waitMap = async () => { await page.waitForFunction(() => !document.querySelector('.animate-spin'), null, { timeout: 120000 }).catch(() => console.log('map wait timeout')); await sleep(2500) }

await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('button[aria-label*="µg/m³"]', { timeout: 60000 }).catch(() => {})
await sleep(2500)
await page.evaluate(() => window.scrollTo(0, 0)); await sleep(500)
await shot('hero')
await hover('button[aria-label*="µg/m³"]'); await sleep(800); await shot('hero_hot')

// My Air
await click('button:has-text("Check your air")'); await sleep(1200)
await click('#my-air button:has-text("Use my location")'); await sleep(2500)
await click('#my-air button:has-text("Child at home")'); await sleep(800)
await page.evaluate(() => document.querySelector('#my-air').scrollIntoView({ block: 'start' })); await sleep(600)
await shot('myair')
await page.evaluate(() => { const c = document.querySelector('#my-air .card'); c && c.scrollIntoView({ block: 'start' }) }); await sleep(500); await shot('myair_card')
await click('#my-air button:has-text("Tomorrow")'); await sleep(600); await click('#my-air button:has-text("Today")'); await sleep(400)
await page.evaluate(() => { const n = document.querySelector('#my-air .flex.h-14'); n && n.scrollIntoView({ block: 'center' }) }); await sleep(500); await shot('hours')
await click('#my-air button[aria-label="Switch language"]'); await sleep(900)
await page.evaluate(() => document.querySelector('#my-air').scrollIntoView({ block: 'start' })); await sleep(500); await shot('hindi')
await click('#my-air button[aria-label="Switch language"]'); await sleep(500)

// Map
await click('#my-air button:has-text("Show on the map")'); await sleep(1500); await waitMap()
await page.evaluate(() => { const s = document.querySelector('.maplibregl-canvas').closest('section'); window.scrollTo(0, s.getBoundingClientRect().top + window.scrollY - 70) }); await sleep(800)
// zoom out to the whole country first
for (let i = 0; i < 3; i++) { await page.locator('.maplibregl-ctrl-zoom-out').first().click({ force: true }).catch(() => {}); await sleep(900) }
await sleep(4000)
// scrub the timeline to mid-September for a "playing" frame
await page.evaluate(() => { const r = document.querySelector('input[type=range]'); if (r) { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(r, Math.round(Number(r.max) * 0.72)); r.dispatchEvent(new Event('input', { bubbles: true })) } }); await sleep(1500)
await shot('map')
await page.evaluate(() => { const r = document.querySelector('input[type=range]'); if (r) { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(r, Number(r.max) - 3); r.dispatchEvent(new Event('input', { bubbles: true })) } }); await sleep(800)
await click('button:has-text("Monitor gap")'); await sleep(1800); await shot('map_gap')
await click('button:has-text("PM2.5")'); await sleep(800)
// zoom into the pinned district (map centre) at street level via wheel
{
  const b = await page.locator('.maplibregl-canvas').first().boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  for (let i = 0; i < 14; i++) { await page.mouse.wheel(0, -240); await sleep(250) }
  await sleep(9000)
}
await shot('map_zoom')

// Accuracy
await page.goto('https://main.d3cvwqcst393r5.amplifyapp.com/accuracy', { waitUntil: 'domcontentloaded' }); await page.waitForSelector('table', { timeout: 60000 }).catch(() => {}); await sleep(2500)
await page.evaluate(() => window.scrollTo(0, 0)); await sleep(400); await shot('accuracy')
await page.evaluate(() => { const t = document.querySelector('figure'); t && t.scrollIntoView({ block: 'start' }) }); await sleep(600); await shot('accuracy_table')

// Placement
await page.goto('https://main.d3cvwqcst393r5.amplifyapp.com/placement', { waitUntil: 'domcontentloaded' }); await page.waitForSelector('main ol li', { timeout: 60000 }).catch(() => {}); await waitMap()
await page.evaluate(() => window.scrollTo(0, 0)); await hover('main ol li:nth-child(1) button'); await sleep(1200); await shot('placement')

// Method
await page.goto('https://main.d3cvwqcst393r5.amplifyapp.com/method', { waitUntil: 'domcontentloaded' }); await sleep(2500)
await page.evaluate(() => window.scrollTo(0, 0)); await sleep(400); await shot('method')

await browser.close(); console.log('done')
