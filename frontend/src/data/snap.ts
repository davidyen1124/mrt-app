/**
 * Station coordinates in the feed mark the station building, not the track, so dots drawn from them float
 * beside the line geometry. These helpers move a station onto its line(s) for display:
 * - one line: the closest point on that line;
 * - a transfer: where the two lines cross near the station (or the midpoint of both projections when the
 *   lines do not cross there, e.g. two termini side by side).
 * Pure functions with no imports so they can be exercised on their own.
 */

export type LngLat = [number, number]
export type LineParts = LngLat[][]

const KX = 111320 * Math.cos((25.05 * Math.PI) / 180)
const KY = 110540
const toXY = ([lng, lat]: LngLat): [number, number] => [lng * KX, lat * KY]
const toLngLat = ([x, y]: [number, number]): LngLat => [x / KX, y / KY]

/** Transfers only snap to a crossing this close to the recorded position (古亭 has one 400 m away). */
const MAX_CROSSING_METERS = 200
/** Beyond this the geometry is probably wrong for the station; keep the recorded position. */
const MAX_SNAP_METERS = 400

function closestOnSegment(p: [number, number], a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared)) : 0
  const point: [number, number] = [a[0] + t * dx, a[1] + t * dy]
  return { point, distance: Math.hypot(p[0] - point[0], p[1] - point[1]) }
}

function project(p: [number, number], parts: LineParts) {
  let best = { point: p, distance: Number.POSITIVE_INFINITY }
  for (const part of parts) {
    for (let index = 1; index < part.length; index += 1) {
      const candidate = closestOnSegment(p, toXY(part[index - 1]), toXY(part[index]))
      if (candidate.distance < best.distance) best = candidate
    }
  }
  return best
}

function intersect(a1: [number, number], a2: [number, number], b1: [number, number], b2: [number, number]): [number, number] | null {
  const d = (a2[0] - a1[0]) * (b2[1] - b1[1]) - (a2[1] - a1[1]) * (b2[0] - b1[0])
  if (Math.abs(d) < 1e-9) return null
  const t = ((b1[0] - a1[0]) * (b2[1] - b1[1]) - (b1[1] - a1[1]) * (b2[0] - b1[0])) / d
  const u = ((b1[0] - a1[0]) * (a2[1] - a1[1]) - (b1[1] - a1[1]) * (a2[0] - a1[0])) / d
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return [a1[0] + t * (a2[0] - a1[0]), a1[1] + t * (a2[1] - a1[1])]
}

function crossingNear(p: [number, number], first: LineParts, second: LineParts): [number, number] | null {
  const near = (parts: LineParts) =>
    parts.flatMap(part =>
      part.slice(1).flatMap((point, index) => {
        const a = toXY(part[index])
        const b = toXY(point)
        return closestOnSegment(p, a, b).distance <= MAX_CROSSING_METERS ? [[a, b] as const] : []
      })
    )
  let best: [number, number] | null = null
  let bestDistance = MAX_CROSSING_METERS
  for (const [a1, a2] of near(first)) {
    for (const [b1, b2] of near(second)) {
      const hit = intersect(a1, a2, b1, b2)
      if (!hit) continue
      const distance = Math.hypot(hit[0] - p[0], hit[1] - p[1])
      if (distance < bestDistance) {
        best = hit
        bestDistance = distance
      }
    }
  }
  return best
}

export function snapToLines(position: LngLat, lines: LineParts[]): LngLat {
  const p = toXY(position)
  const usable = lines.filter(parts => parts.length)
  if (!usable.length) return position

  if (usable.length >= 2) {
    const crossing = crossingNear(p, usable[0], usable[1])
    if (crossing) return toLngLat(crossing)
  }

  const projections = usable.map(parts => project(p, parts)).filter(item => item.distance <= MAX_SNAP_METERS)
  if (!projections.length) return position
  const x = projections.reduce((sum, item) => sum + item.point[0], 0) / projections.length
  const y = projections.reduce((sum, item) => sum + item.point[1], 0) / projections.length
  return toLngLat([x, y])
}
