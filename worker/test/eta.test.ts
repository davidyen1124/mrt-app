import { describe, expect, it } from 'vitest'
import { fetchArrivals, normalizeArrivals, parseEstimate } from '../src/eta'
import { faresFrom } from '../src/fares'
import { findStation, linesAt } from '../src/network'

const record = (destinationStationId: string, estimateTime: unknown, extra: Record<string, unknown> = {}) => ({
  stationName: { zh: '', en: '' },
  platform: '',
  secondsAgo: 0,
  estimateTime,
  destinationStationId,
  ...extra
})

const station = (code: string) => {
  const found = findStation(code)
  if (!found) throw new Error(`missing fixture station ${code}`)
  return found
}

describe('parseEstimate', () => {
  it('reads seconds, clock strings and status text', () => {
    expect(parseEstimate(95)).toEqual({ status: 'countdown', seconds: 95, label: null })
    expect(parseEstimate('4:05')).toEqual({ status: 'countdown', seconds: 245, label: null })
    expect(parseEstimate('3分20秒')).toEqual({ status: 'countdown', seconds: 200, label: null })
    expect(parseEstimate('列車進站')).toEqual({ status: 'arriving', seconds: 0, label: '列車進站' })
    expect(parseEstimate('末班已過')).toEqual({ status: 'ended', seconds: null, label: '末班已過' })
    expect(parseEstimate('')).toEqual({ status: 'notice', seconds: null, label: null })
  })
})

describe('normalizeArrivals', () => {
  it('assigns line and direction when routeName is present', () => {
    const arrivals = normalizeArrivals(station('BL12'), [[
      record('BL23', 120, { routeName: { zh: '板南', en: 'Bannan' }, secondsAgo: 5 }),
      record('BL01', '2:00', { routeName: { zh: '板南', en: 'Bannan' } }),
      record('R28', '末班已過', { routeName: { zh: '淡水信義', en: 'Tamsui-Xinyi' } }),
      record('BR09', 30, { routeName: { zh: '淡水信義', en: 'Tamsui-Xinyi' } })
    ]])

    const byDestination = Object.fromEntries(arrivals.map(item => [item.destination.code, item]))
    expect(byDestination.BL23).toMatchObject({ line: 'BL', direction: 'up', seconds: 115, status: 'countdown' })
    expect(byDestination.BL01).toMatchObject({ line: 'BL', direction: 'down', seconds: 120 })
    expect(byDestination.R28).toMatchObject({ line: 'R', direction: 'up', status: 'ended' })
    // 大安 is BR09/R05 — the train is on the Red line heading south.
    expect(byDestination.BR09).toMatchObject({ line: 'R', direction: 'down' })
    expect(byDestination.BR09.destination.name.zh).toBe('大安')
  })

  it('infers the line when routeName is missing', () => {
    // Circular line records arrive without routeName and name 大坪林 by its Green line code.
    const arrivals = normalizeArrivals(station('Y16'), [[record('G04', 300), record('Y20', 60)]])
    expect(arrivals.map(item => [item.destination.code, item.line, item.direction])).toEqual([
      ['G04', 'Y', 'down'],
      ['Y20', 'Y', 'up']
    ])
  })

  it('merges platform groups for combined stations', () => {
    const banqiao = station('Y16')
    expect(banqiao.codes).toEqual(['BL07', 'Y16'])
    const arrivals = normalizeArrivals(banqiao, [
      [record('BL23', 90, { routeName: { zh: '板南' } })],
      [record('Y20', 60), record('Y20', 61)]
    ])
    expect(arrivals).toHaveLength(2)
    expect(arrivals.map(item => item.line)).toEqual(['BL', 'Y'])
  })

  it('resolves branches and forks', () => {
    const beitou = normalizeArrivals(station('R22'), [[record('R22A', 200), record('R28', 100)]])
    expect(beitou.map(item => [item.destination.code, item.line, item.direction])).toEqual([
      ['R28', 'R', 'up'],
      ['R22A', 'RA', 'up']
    ])

    const daqiaotou = normalizeArrivals(station('O12'), [[record('O21', 100), record('O54', 50), record('O01', 20)]])
    expect(daqiaotou.map(item => [item.destination.code, item.direction])).toEqual([
      ['O01', 'down'],
      ['O54', 'up'],
      ['O21', 'up']
    ])
  })

  it('skips trains terminating at the requested station', () => {
    const arrivals = normalizeArrivals(station('BR24'), [[record('BR24', 60), record('BR01', 120)]])
    expect(arrivals.map(item => item.destination.code)).toEqual(['BR01'])
  })
})

describe('fetchArrivals', () => {
  it('queries every code of a merged station', async () => {
    const requested: string[] = []
    const fakeFetch = (async (input: RequestInfo | URL) => {
      requested.push(String(input))
      return new Response(JSON.stringify([record('Y20', 60)]))
    }) as typeof fetch

    const payload = await fetchArrivals(station('BL07'), 'https://example.test/eta?stationId=', fakeFetch)
    expect(requested).toEqual(['https://example.test/eta?stationId=BL07', 'https://example.test/eta?stationId=Y16'])
    expect(payload.stationId).toBe('BL07')
    expect(payload.arrivals).toHaveLength(1)
  })
})

describe('network data', () => {
  it('includes the Xinyi line extension and branch lines', () => {
    expect(station('R01').name.zh).toBe('廣慈/奉天宮')
    expect(linesAt(station('R22')).map(line => line.id)).toEqual(['R', 'RA'])
  })

  it('serves fares between physical stations', () => {
    const fares = faresFrom(station('BL12'))
    const xinsheng = fares.find(item => item.to === station('BL14').id)
    expect(xinsheng).toMatchObject({ fare: 20, concession: 8 })
    expect(fares.some(item => item.to === station('R10').id)).toBe(false)
  })
})
