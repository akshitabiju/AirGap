// Records the AirGap demo from the live site as a silent 1920x1080 video with deadline-based timing:
// every segment ends at the script's timestamp no matter how long the clicks take.
// Usage: node scripts/record_demo.mjs [url]   -> data/cache/demo/raw.webm + timing.json
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const URL = (process.argv[2] || 'https://main.d3cvwqcst393r5.amplifyapp.com/') + '?static=1'
const OUT = path.resolve('data/cache/demo')
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Script timeline (seconds after the hero is on screen)
const T = { hero: 0, hoverHot: 8, myair: 20, hours: 48, hindi: 62, map: 67, play: 71, unc: 82, gap: 85, pm: 90, zoom: 92, acc: 107, place: 140, method: 157, close: 169, end: 178 }

const recStart = Date.now()
// Real Chrome, headed, so MapLibre's WebGL uses the GPU (headless shell software-renders and drifts badly).
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1920,1080', '--window-position=0,0', '--hide-scrollbars'] })
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1,
  recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
  geolocation: { latitude: 19.3149, longitude: 84.7941 }, permissions: ['geolocation'],
  locale: 'en-IN', timezoneId: 'Asia/Kolkata',
})
await ctx.addInitScript(() => {
  addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div')
    c.style.cssText = 'position:fixed;z-index:2147483647;width:22px;height:22px;border-radius:50%;background:rgba(94,234,212,0.35);border:2px solid #fff;box-shadow:0 0 12px rgba(0,0,0,.6);pointer-events:none;transform:translate(-50%,-50%);left:-100px;top:-100px'
    document.body.appendChild(c)
    addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px' }, true)
    addEventListener('mousedown', () => { c.style.transform = 'translate(-50%,-50%) scale(.6)' }, true)
    addEventListener('mouseup', () => { c.style.transform = 'translate(-50%,-50%)' }, true)
  })
})
const page = await ctx.newPage()
ctx.on('page', async (p) => { if (p !== page) { await sleep(1200); await p.close().catch(() => {}) } })

let T0 = 0
const now = () => (Date.now() - T0) / 1000
const log = (m) => console.log(`${now().toFixed(1).padStart(6)}s  ${m}`)
const until = async (sec) => { const ms = T0 + sec * 1000 - Date.now(); if (ms > 0) await sleep(ms); else if (ms < -1500) log(`  (overran by ${(-ms / 1000).toFixed(1)}s)`) }
async function box(sel) { const el = page.locator(sel).first(); try { await el.evaluate((n) => n.scrollIntoView({ block: 'center' })); } catch { return null } await sleep(350); return el.boundingBox() }
async function hover(sel, fx = 0.5, fy = 0.5) { const b = await box(sel); if (!b) { log(`!! not found ${sel}`); return null } const x = b.x + b.width * fx, y = b.y + b.height * fy; await page.mouse.move(x, y, { steps: 8 }); return { x, y } }
async function click(sel) { const p = await hover(sel); if (p) { await sleep(150); await page.mouse.click(p.x, p.y) } }
async function wheel(px, ms) { const n = Math.max(1, Math.round(ms / 60)); for (let i = 0; i < n; i++) { await page.mouse.wheel(0, px / n); await sleep(60) } }

// ---------- load ----------
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('h1', { timeout: 30000 })
await page.waitForFunction(() => !!document.querySelector('button[aria-label*="µg/m³"]'), null, { timeout: 30000 }).catch(() => {})
await sleep(800)
T0 = Date.now()
fs.writeFileSync(path.join(OUT, 'timing.json'), JSON.stringify({ trimStart: (T0 - recStart) / 1000, T }, null, 2))
await page.mouse.move(960, 560)
log('hero')

// ---------- 0:00 hero ----------
await until(T.hoverHot)
await hover('button[aria-label*="µg/m³"]'); await sleep(2500)
await page.mouse.move(900, 980, { steps: 10 })

// ---------- 0:20 my air ----------
await until(T.myair); log('my air')
await click('button:has-text("Check your air")'); await sleep(1500)
await click('#my-air button:has-text("Use my location")'); await sleep(2000)
await click('#my-air button:has-text("Child at home")'); await sleep(600)
await hover('#my-air .card', 0.5, 0.25)

// ---------- 0:48 hours / share / forecast ----------
await until(T.hours); log('best hours')
await hover('#my-air .card .flex.h-14'); await sleep(1500)
await click('#my-air button:has-text("Tomorrow")'); await sleep(2200)
await click('#my-air button:has-text("Today")'); await sleep(1500)
await click('#my-air button:has-text("WhatsApp")'); await sleep(1800); await page.bringToFront()
await hover('#my-air .grid-cols-4')

// ---------- 1:02 hindi flash ----------
await until(T.hindi); log('hindi')
await click('#my-air button[aria-label="Switch language"]'); await sleep(2200)
await click('#my-air button[aria-label="Switch language"]')

// ---------- 1:07 map ----------
await until(T.map); log('map')
await click('#my-air button:has-text("Show on the map")')
await until(T.play); await click('button[aria-label="Play 92 days"]')
await until(T.unc); await click('button:has-text("Uncertainty")')
await until(T.gap); await click('button:has-text("Monitor gap")')
await until(T.pm); await click('button:has-text("PM2.5")')
await until(T.zoom)
{
  const b = await page.locator('.maplibregl-canvas').first().boundingBox()
  if (b) {
    const x = b.x + b.width * 0.66, y = b.y + b.height * 0.60
    await page.mouse.move(x, y, { steps: 10 })
    for (let i = 0; i < 9; i++) { await page.mouse.wheel(0, -300); await sleep(300) }
    await sleep(2000); await page.mouse.move(x + 35, y - 25, { steps: 8 })
  }
}

// ---------- 1:47 accuracy ----------
await until(T.acc); log('accuracy')
await click('header nav a:has-text("Accuracy")'); await sleep(4500)
await wheel(750, 6000); await sleep(2000)
await wheel(900, 7000); await sleep(1500)
await wheel(700, 5000)

// ---------- 2:20 placement ----------
await until(T.place); log('placement')
await click('header nav a:has-text("Next 20")'); await sleep(3000)
for (let i = 1; i <= 3; i++) { await hover(`main ol li:nth-child(${i}) button`); await sleep(2000) }

// ---------- 2:37 method ----------
await until(T.method); log('method')
await click('header nav a:has-text("Method")'); await sleep(2000)
await wheel(500, 4000); await hover('aside .card')

// ---------- 2:49 close ----------
await until(T.close); log('close')
await click('header nav a:has-text("Map")'); await sleep(1000)
await page.mouse.move(960, 620, { steps: 20 })
await until(T.end); log('end')

await page.close()
const file = await (await page.video()).path()
await ctx.close(); await browser.close()
fs.renameSync(file, path.join(OUT, 'raw.webm'))
console.log('saved raw.webm')
