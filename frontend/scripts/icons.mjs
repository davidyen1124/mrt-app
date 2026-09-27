#!/usr/bin/env node
// Builds every icon and the social preview card in public/ from the source art in art/.
//
//   node scripts/icons.mjs
//
// art/icon.png – 1024×1024 full-bleed app icon (generated with the Codex imagegen skill)
// art/og.png   – landscape social card art (generated with the Codex imagegen skill), centre-cropped to 1200×630
//
// Rendering goes through the local Chrome so resizing matches what browsers do.

import { chromium } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pub = join(root, 'public')
const art = async name => `data:image/png;base64,${(await readFile(join(root, 'art', name))).toString('base64')}`

const iconSrc = await art('icon.png')
const ogSrc = await art('og.png')

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' })

/**
 * Renders the icon at `size`. `rounded` clips to the app-icon radius with a transparent outside; `inset` shrinks
 * the art onto the icon's ink background (maskable icons must keep content inside the central 80% circle).
 */
async function renderIcon(size, { rounded, inset = 1 }) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  const art = Math.round(size * inset)
  await page.setContent(
    `<html><body style="margin:0;background:transparent">
      <div style="width:${size}px;height:${size}px;display:grid;place-items:center;background:${inset < 1 ? '#111418' : 'transparent'};${rounded ? `border-radius:${Math.round(size * 0.225)}px;overflow:hidden;` : ''}">
        <img src="${iconSrc}" style="display:block;width:${art}px;height:${art}px">
      </div>
    </body></html>`
  )
  await page.waitForFunction(() => document.images[0].complete)
  const buffer = await page.screenshot({ omitBackground: rounded })
  await page.close()
  return buffer
}

// ICO container holding PNG frames (supported by every current browser).
function ico(frames) {
  const header = Buffer.alloc(6 + frames.length * 16)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(frames.length, 4)
  let offset = header.length
  frames.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16
    header.writeUInt8(size >= 256 ? 0 : size, entry)
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1)
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(png.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += png.length
  })
  return Buffer.concat([header, ...frames.map(frame => frame.png)])
}

const outputs = {
  'icon-512.png': await renderIcon(512, { rounded: true }),
  'icon-192.png': await renderIcon(192, { rounded: true }),
  'favicon-32.png': await renderIcon(32, { rounded: true }),
  'favicon-16.png': await renderIcon(16, { rounded: true }),
  // Platforms that apply their own mask get the full-bleed square.
  'icon-maskable-512.png': await renderIcon(512, { rounded: false, inset: 0.8 }),
  'apple-touch-icon.png': await renderIcon(180, { rounded: false })
}
outputs['favicon.ico'] = ico([
  { size: 16, png: outputs['favicon-16.png'] },
  { size: 32, png: outputs['favicon-32.png'] },
  { size: 48, png: await renderIcon(48, { rounded: true }) }
])

const og = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await og.setContent(
  `<html><body style="margin:0">
    <img src="${ogSrc}" style="display:block;width:1200px;height:630px;object-fit:cover;object-position:center">
  </body></html>`
)
await og.waitForFunction(() => document.images[0].complete)
outputs['og.png'] = await og.screenshot()

await browser.close()
for (const [name, buffer] of Object.entries(outputs)) await writeFile(join(pub, name), buffer)
console.log(`wrote ${Object.keys(outputs).join(', ')} to public/`)
