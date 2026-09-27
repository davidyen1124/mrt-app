#!/usr/bin/env node
// Rebuilds data/taipei_lines.geo.json from OpenStreetMap route relations via the Overpass API.
//
//   node scripts/refresh-geometry.mjs
//
// Each line uses one direction of its OSM route relation. Member ways are stitched end to end and
// simplified (Douglas-Peucker, ~4 m) so the whole network stays around 20 KB.
// Geometry © OpenStreetMap contributors, ODbL 1.0.

import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const TOLERANCE_METERS = 4
const RELATIONS = [
  { line: 'BR', relation: 447449 },
  { line: 'R', relation: 5378981 },
  { line: 'RA', relation: 2665129 },
  { line: 'G', relation: 4250357 },
  { line: 'GA', relation: 4250381 },
  { line: 'O', relation: 4250355 },
  { line: 'O', relation: 4250354 },
  { line: 'BL', relation: 199038 },
  { line: 'Y', relation: 3322093 }
]

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const metersBetween = ([lngA, latA], [lngB, latB]) => {
  const kx = 111320 * Math.cos((((latA + latB) / 2) * Math.PI) / 180)
  return Math.hypot((lngA - lngB) * kx, (latA - latB) * 110540)
}

function stitch(ways) {
  const segments = []
  let current = null
  for (const way of ways) {
    const points = way.geometry.map(({ lon, lat }) => [lon, lat])
    if (!current) {
      current = points
      continue
    }
    const head = current[0]
    const tail = current[current.length - 1]
    const options = [
      { gap: metersBetween(tail, points[0]), join: () => current.concat(points.slice(1)) },
      { gap: metersBetween(tail, points[points.length - 1]), join: () => current.concat(points.reverse().slice(1)) },
      { gap: metersBetween(head, points[points.length - 1]), join: () => points.concat(current.slice(1)) },
      { gap: metersBetween(head, points[0]), join: () => points.reverse().concat(current.slice(1)) }
    ]
    const best = options.reduce((a, b) => (b.gap < a.gap ? b : a))
    if (best.gap < 30) {
      current = best.join()
    } else {
      segments.push(current)
      current = points
    }
  }
  if (current) segments.push(current)
  return segments
}

function simplify(points, tolerance) {
  if (points.length < 3) return points
  const [first, last] = [points[0], points[points.length - 1]]
  const kx = 111320 * Math.cos((first[1] * Math.PI) / 180)
  const ky = 110540
  const [ax, ay, bx, by] = [first[0] * kx, first[1] * ky, last[0] * kx, last[1] * ky]
  const dx = bx - ax
  const dy = by - ay
  let maxDistance = 0
  let maxIndex = 0
  for (let index = 1; index < points.length - 1; index += 1) {
    const px = points[index][0] * kx
    const py = points[index][1] * ky
    const lengthSquared = dx * dx + dy * dy
    const t = lengthSquared ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared)) : 0
    const distance = Math.hypot(px - ax - t * dx, py - ay - t * dy)
    if (distance > maxDistance) {
      maxDistance = distance
      maxIndex = index
    }
  }
  if (maxDistance <= tolerance) return [first, last]
  return simplify(points.slice(0, maxIndex + 1), tolerance).slice(0, -1).concat(simplify(points.slice(maxIndex), tolerance))
}

async function main() {
  const ids = RELATIONS.map(item => item.relation).join(',')
  const query = `[out:json][timeout:240];relation(id:${ids});out geom;`
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': 'mrt-app geometry refresh (+https://github.com/davidyen1124/mrt-app)'
    },
    body: new URLSearchParams({ data: query })
  })
  if (!response.ok) throw new Error(`Overpass responded ${response.status}`)
  const { elements } = await response.json()

  const features = RELATIONS.map(({ line, relation }) => {
    const element = elements.find(item => item.id === relation)
    if (!element) throw new Error(`relation ${relation} missing from Overpass response`)
    const ways = element.members.filter(member => member.type === 'way' && member.geometry)
    const segments = stitch(ways).map(segment =>
      simplify(segment, TOLERANCE_METERS).map(([lng, lat]) => [Number(lng.toFixed(5)), Number(lat.toFixed(5))])
    )
    return {
      type: 'Feature',
      properties: { line, relation },
      geometry: segments.length === 1
        ? { type: 'LineString', coordinates: segments[0] }
        : { type: 'MultiLineString', coordinates: segments }
    }
  })

  const collection = {
    type: 'FeatureCollection',
    attribution: '© OpenStreetMap contributors (ODbL 1.0)',
    generatedAt: new Date().toISOString(),
    features
  }
  await writeFile(join(root, 'data', 'taipei_lines.geo.json'), `${JSON.stringify(collection)}\n`)
  const points = features.reduce((sum, feature) => sum + JSON.stringify(feature.geometry.coordinates).split('],[').length, 0)
  console.log(`wrote ${features.length} line features (${points} points)`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
