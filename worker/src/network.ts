import networkData from '../../data/taipei_network.json'

export type LocalizedName = { zh: string; en: string }

export type Line = {
  id: string
  code: string
  name: LocalizedName
  color: string
  onColor: string
  branchOf?: string
  stations: string[]
  segments: string[][]
}

export type Station = {
  id: string
  codes: string[]
  name: LocalizedName
  lat: number
  lng: number
  lines: string[]
}

export type Network = {
  meta: { generatedAt: string; source: string; overrides: string[]; stationCount: number }
  lines: Line[]
  stations: Station[]
}

export const network = networkData as unknown as Network

const stationByCode = new Map<string, Station>()
for (const station of network.stations) {
  for (const code of station.codes) stationByCode.set(code, station)
}

export const findStation = (code: string): Station | undefined =>
  stationByCode.get(code.trim().toUpperCase())

/** Lines whose station list touches this station, including branch lines through a shared station. */
export const linesAt = (station: Station): Line[] =>
  network.lines.filter(line => line.stations.some(code => station.codes.includes(code)))

export const codeOnLine = (station: Station, line: Line): string | undefined =>
  station.codes.find(code => line.stations.includes(code))
