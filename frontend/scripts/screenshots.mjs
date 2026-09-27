#!/usr/bin/env node
// Captures README screenshots from a running instance (default: the local Worker on :8787).
//
//   node scripts/screenshots.mjs [baseUrl] [outDir]
//
// Uses the locally installed Chrome. Screens are taken at iPhone 15 Pro size (393×852 @3x) plus one desktop view.

import { chromium, devices } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const base = process.argv[2] ?? 'http://localhost:8787'
const out = resolve(process.argv[3] ?? '../docs/screenshots')
const only = process.env.SHOTS?.split(',')

const phone = { ...devices['iPhone 15 Pro'], locale: 'zh-TW', timezoneId: 'Asia/Taipei' }
delete phone.defaultBrowserType

const SHOTS = [
  { name: 'home', path: '/', setup: async () => {} },
  { name: 'home-lines', path: '/', setup: async page => tapGrabber(page, 1) },
  { name: 'station', path: '/station/R10', setup: async () => {} },
  { name: 'station-full', path: '/station/O07', setup: async page => tapGrabber(page, 1) },
  { name: 'fares', path: '/station/BL14/fares', setup: async () => {} },
  { name: 'timetable', path: '/station/R01/times', setup: async () => {} },
  { name: 'line', path: '/line/BR', setup: async () => {} },
  { name: 'search', path: '/', setup: async page => {
    await page.getByPlaceholder('搜尋車站、站號或英文站名').fill('忠孝')
    await page.keyboard.press('Escape').catch(() => {})
    await page.getByPlaceholder('搜尋車站、站號或英文站名').fill('忠孝')
  } },
  { name: 'station-dark', path: '/station/BL12', scheme: 'dark', setup: async () => {} },
  { name: 'line-dark', path: '/line/O', scheme: 'dark', setup: async () => {} },
  { name: 'desktop', path: '/station/R10', desktop: true, setup: async () => {} },
  { name: 'desktop-dark', path: '/line/R', desktop: true, scheme: 'dark', setup: async () => {} }
]

async function tapGrabber(page, times) {
  for (let i = 0; i < times; i += 1) {
    const grabber = page.locator('section[aria-label="panel"] > div').first()
    const box = await grabber.boundingBox()
    if (box) await page.mouse.click(box.x + box.width / 2, box.y + 8)
    await page.waitForTimeout(700)
  }
}

async function settle(page) {
  await page.waitForFunction(() => document.querySelector('.maplibregl-canvas'))
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(2500)
}

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' })
await mkdir(out, { recursive: true })

for (const shot of SHOTS) {
  if (only && !only.includes(shot.name)) continue
  const context = await browser.newContext(
    shot.desktop
      ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'zh-TW', timezoneId: 'Asia/Taipei', colorScheme: shot.scheme ?? 'light' }
      : { ...phone, colorScheme: shot.scheme ?? 'light' }
  )
  await context.addInitScript(() => localStorage.setItem('mrt:lang', 'zh'))
  const page = await context.newPage()
  await page.goto(`${base}${shot.path}`)
  await settle(page)
  await shot.setup(page)
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${out}/${shot.name}.png` })
  console.log(`captured ${shot.name}`)
  await context.close()
}

await browser.close()
