#!/usr/bin/env node
// Generates the app icons and the Open Graph card in public/ from the SVG mark and the real line geometry.
//
//   node scripts/icons.mjs

import { chromium } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pub = join(root, 'public')
const network = JSON.parse(await readFile(join(root, '../data/taipei_network.json'), 'utf8'))
const geometry = JSON.parse(await readFile(join(root, '../data/taipei_lines.geo.json'), 'utf8'))

// Keep in sync with src/components/Logo.tsx.
const mark = ({ rounded = true, inset = 0 } = {}) => {
  const scale = (64 - inset * 2) / 64
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" ${rounded ? 'rx="15"' : ''} fill="#111418"/>
  <g transform="translate(${inset} ${inset}) scale(${scale})">
    <path d="M-4 44 C 14 44, 20 32, 32 32 S 50 20, 68 20" stroke="#0070BD" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M22 -4 C 22 14, 32 20, 32 32 S 42 50, 42 68" stroke="#E3002C" stroke-width="8" fill="none" stroke-linecap="round"/>
    <circle cx="32" cy="32" r="9.5" fill="#fff" stroke="#111418" stroke-width="4"/>
  </g>
</svg>`
}

function networkSvg(width, height, pad) {
  const all = geometry.features.flatMap(feature =>
    feature.geometry.type === 'LineString' ? feature.geometry.coordinates : feature.geometry.coordinates.flat()
  )
  const lngs = all.map(point => point[0])
  const lats = all.map(point => point[1])
  const [minX, maxX, minY, maxY] = [Math.min(...lngs), Math.max(...lngs), Math.min(...lats), Math.max(...lats)]
  const kx = Math.cos((((minY + maxY) / 2) * Math.PI) / 180)
  const scale = Math.min((width - pad * 2) / ((maxX - minX) * kx), (height - pad * 2) / (maxY - minY))
  const offsetX = (width - (maxX - minX) * kx * scale) / 2
  const offsetY = (height - (maxY - minY) * scale) / 2
  const project = ([lng, lat]) => [offsetX + (lng - minX) * kx * scale, offsetY + (maxY - lat) * scale]
  const colorOf = id => network.lines.find(line => line.id === id)?.color ?? '#999'
  const paths = geometry.features
    .map(feature => {
      const parts = feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.coordinates
      return parts
        .map(part => `<path d="M${part.map(point => project(point).map(value => value.toFixed(1)).join(' ')).join(' L')}" stroke="${colorOf(feature.properties.line)}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)
        .join('')
    })
    .join('')
  const dots = network.stations
    .map(station => {
      const [x, y] = project([station.lng, station.lat])
      const transfer = station.codes.length > 1
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${transfer ? 6.5 : 4}" fill="${transfer ? '#fff' : '#111418'}" stroke="${transfer ? '#111418' : '#fff'}" stroke-width="${transfer ? 3 : 2}"/>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${paths}${dots}</svg>`
}

const ogHtml = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;700;800&display=swap" rel="stylesheet">
<style>
  body{margin:0;width:1200px;height:630px;background:#111418;font-family:Inter,-apple-system,"PingFang TC",sans-serif;color:#f6f2e7;overflow:hidden;position:relative}
  .map{position:absolute;right:-20px;top:-10px}
  .copy{position:absolute;left:72px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;width:520px}
  .mark{width:96px;height:96px;border-radius:24px;box-shadow:0 0 0 2px rgb(255 255 255 / .08)}
  h1{font-size:76px;line-height:1;margin:36px 0 10px;font-weight:800;letter-spacing:.04em}
  .en{font-size:22px;letter-spacing:.32em;text-transform:uppercase;color:#8e96a1;font-weight:700}
  p{font-size:26px;line-height:1.5;color:#c9ccd1;margin:34px 0 0;font-weight:500}
  .chips{display:flex;gap:10px;margin-top:34px}
  .chip{height:40px;min-width:40px;padding:0 8px;border-radius:10px;display:grid;place-items:center;font-weight:800;font-size:18px}
</style></head><body>
<div class="map">${networkSvg(720, 650, 40)}</div>
<div class="copy">
  <img class="mark" src="data:image/svg+xml;base64,${Buffer.from(mark()).toString('base64')}">
  <h1>北捷即時</h1>
  <div class="en">Taipei Metro Live</div>
  <p>即時到站 · 車廂擁擠度 · 首末班車 · 票價<br>Live arrivals, crowding, fares.</p>
  <div class="chips">${network.lines
    .filter(line => !line.branchOf)
    .map(line => `<span class="chip" style="background:${line.color};color:${line.onColor}">${line.code}</span>`)
    .join('')}</div>
</div>
</body></html>`

// Minimal ICO container wrapping a PNG (supported by every current browser).
const ico = png => {
  const header = Buffer.alloc(22)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  header.writeUInt8(32, 6)
  header.writeUInt8(32, 7)
  header.writeUInt16LE(1, 10)
  header.writeUInt16LE(32, 12)
  header.writeUInt32LE(png.length, 14)
  header.writeUInt32LE(22, 18)
  return Buffer.concat([header, png])
}

await writeFile(join(pub, 'icon.svg'), `${mark()}\n`)

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' })
const render = async (svg, size, file, { transparent = true } = {}) => {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(`<html><body style="margin:0;background:transparent"><img style="width:${size}px;height:${size}px;display:block" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`)
  const buffer = await page.screenshot({ omitBackground: transparent })
  await page.close()
  if (file) await writeFile(join(pub, file), buffer)
  return buffer
}

await render(mark(), 192, 'icon-192.png')
await render(mark(), 512, 'icon-512.png')
await render(mark({ rounded: false, inset: 8 }), 512, 'icon-maskable-512.png', { transparent: false })
await render(mark({ rounded: false }), 180, 'apple-touch-icon.png', { transparent: false })
await render(mark(), 32, 'favicon-32.png')
await writeFile(join(pub, 'favicon.ico'), ico(await render(mark(), 32)))

const og = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await og.setContent(ogHtml, { waitUntil: 'networkidle' })
await og.screenshot({ path: join(pub, 'og.png') })
await browser.close()
console.log('icons and og.png written to public/')
