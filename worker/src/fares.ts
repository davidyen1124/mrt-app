import faresData from '../../data/taipei_fares.json'
import type { Station } from './network'

type FareMatrix = { stations: string[]; rows: string[] }

export type Fare = { to: string; minutes: number; fare: number; concession: number | null }

const matrix = faresData as unknown as FareMatrix
const indexById = new Map(matrix.stations.map((id, index) => [id, index]))

export function faresFrom(station: Station): Fare[] {
  const index = indexById.get(station.id)
  if (index == null) return []
  const cells = matrix.rows[index]?.split(';') ?? []
  const fares: Fare[] = []
  cells.forEach((cell, column) => {
    if (!cell) return
    const [minutes, fare, concession] = cell.split(',').map(value => (value === '' ? null : Number(value)))
    if (minutes == null || fare == null) return
    fares.push({ to: matrix.stations[column], minutes, fare, concession })
  })
  return fares.sort((a, b) => a.minutes - b.minutes)
}
