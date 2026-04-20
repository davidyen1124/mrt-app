import { useCarLoadRecommendations, type CarLoadRecommendation } from '@/hooks/useCarLoadRecommendations'
import { useNow } from '@/hooks/useNow'
import type { Station } from '@/types/station'
import { useEffect, useState } from 'react'

type LocalizedText = string | Record<string, string | null | undefined>

type EtaItem = {
  routeName?: LocalizedText
  stationName?: LocalizedText
  destinationStationName?: LocalizedText
  destinationStationId?: string
  etaLabel?: string
  estimateTime?: string | number
  arriveAt: number | null
}

type EtaPanelProps = {
  station: Station
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isLocalizedMap = (value: unknown): value is Record<string, string | null | undefined> =>
  isRecord(value) && Object.values(value).every(entry => entry == null || typeof entry === 'string')

const toLocalizedText = (value: unknown): LocalizedText | undefined => {
  if (typeof value === 'string') return value
  if (isLocalizedMap(value)) return value
  return undefined
}

const extractEtaEntries = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value
  }
  if (isRecord(value)) {
    const candidateKeys = ['items', 'result'] as const
    for (const key of candidateKeys) {
      if (key in value) {
        const nested = extractEtaEntries(value[key])
        if (nested.length > 0) return nested
      }
    }
  }
  return []
}

const toEtaItem = (entry: unknown): EtaItem | null => {
  if (!isRecord(entry)) return null

  const normalizeTimestamp = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const parsed = Number.parseInt(value, 10)
      return Number.isFinite(parsed) ? parsed : null
    }
    return null
  }

  const normalizeEstimateTime = (value: unknown): string | number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed) return trimmed
    }
    return undefined
  }

  const normalizeId = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      return trimmed ? trimmed : undefined
    }
    return undefined
  }

  return {
    routeName: toLocalizedText(entry.routeName),
    stationName: toLocalizedText(entry.stationName),
    destinationStationName: toLocalizedText(entry.destinationStationName),
    destinationStationId: normalizeId(entry.destinationStationId),
    etaLabel: typeof entry.etaLabel === 'string' ? entry.etaLabel : undefined,
    estimateTime: normalizeEstimateTime(entry.estimateTime),
    arriveAt: normalizeTimestamp(entry.arriveAt)
  }
}

const toEtaItems = (value: unknown): EtaItem[] =>
  extractEtaEntries(value).reduce<EtaItem[]>((acc, entry) => {
    const normalized = toEtaItem(entry)
    if (normalized) acc.push(normalized)
    return acc
  }, [])

const resolveLabel = (value?: LocalizedText): string | undefined => {
  if (!value) return undefined
  if (typeof value === 'string') return value
  const zh = value.zh
  if (typeof zh === 'string' && zh.trim()) return zh.trim()
  for (const label of Object.values(value)) {
    if (typeof label === 'string' && label.trim()) return label.trim()
  }
  return undefined
}

const renderEta = (item: EtaItem, now: number) => {
  if (item.arriveAt == null) {
    if (item.etaLabel && item.etaLabel.trim()) return item.etaLabel.trim()
    if (item.estimateTime != null) return String(item.estimateTime)
    return '-'
  }
  const remaining = Math.max(0, Math.round((item.arriveAt - now) / 1000))
  if (remaining === 0) return '進站中'
  const minutes = Math.floor(remaining / 60)
  const seconds = Math.max(0, remaining % 60)
  return minutes === 0 ? `${seconds}秒` : `${minutes}分${seconds}秒`
}

const loadTone = (level: number) => {
  if (level <= 1) return 'bg-emerald-500'
  if (level === 2) return 'bg-amber-400'
  return 'bg-rose-500'
}

const normalizeDirectionText = (value: string) =>
  value
    .replace(/\s+/g, '')
    .replace(/臺/g, '台')
    .replace(/^往/, '')
    .replace(/方向$/, '')
    .replace(/站$/, '')
    .replace(/[／/]/g, '')

const etaDestinationLabel = (item: EtaItem) =>
  resolveLabel(item.stationName) ??
  resolveLabel(item.destinationStationName) ??
  item.destinationStationId ??
  ''

const matchCarLoadRecommendation = (
  item: EtaItem,
  recommendations: CarLoadRecommendation[]
): CarLoadRecommendation | undefined => {
  const destinationLabels = [
    resolveLabel(item.stationName),
    resolveLabel(item.destinationStationName),
    item.destinationStationId
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normalizeDirectionText)

  if (destinationLabels.length === 0) return undefined

  return recommendations.find(recommendation => {
    const direction = normalizeDirectionText(recommendation.directionLabel)
    return destinationLabels.some(destination => {
      if (!destination) return false
      return direction.includes(destination) || destination.includes(direction)
    })
  })
}

function CarLoadBlocks({ recommendation }: { recommendation: CarLoadRecommendation }) {
  return (
    <div className="mt-2 grid grid-cols-6 gap-1">
      {recommendation.carLoads.map((level, index) => {
        const car = index + 1
        const isBest = recommendation.bestCars.includes(car)
        return (
          <div
            key={car}
            className={`flex h-7 items-center justify-center rounded-md text-xs font-semibold text-white ${loadTone(level)} ${
              isBest ? 'ring-2 ring-emerald-900 ring-offset-1' : ''
            }`}
            aria-label={`${car} 車廂負載 ${level}`}
          >
            {car}
          </div>
        )
      })}
    </div>
  )
}

export default function EtaPanel({ station }: EtaPanelProps) {
  const [items, setItems] = useState<EtaItem[]>([])
  const carLoadRecommendations = useCarLoadRecommendations(station.id)
  const now = useNow()

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const response = await fetch(`/api/mrt/taipei/eta?stationId=${encodeURIComponent(station.id)}`)
        const raw: unknown = await response.json()
        const data = toEtaItems(raw)
        if (cancelled) return
        setItems(data)
      } catch {
        if (!cancelled) setItems([])
      }
    }

    load()
    const poll = setInterval(load, 15000)

    return () => {
      cancelled = true
      clearInterval(poll)
    }
  }, [station.id])

  return (
    <div className="border rounded-lg p-3">
      <div className="font-semibold text-base">{station.name_zh}</div>
      <ul className="mt-2 divide-y">
        {items.map((item, index) => {
          const carLoad = matchCarLoadRecommendation(item, carLoadRecommendations)
          return (
            <li key={index} className="py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 truncate text-sm">
                  {resolveLabel(item.routeName) ?? '路線'}
                  <span className="mx-1">→</span>
                  {etaDestinationLabel(item)}
                </div>
                <div className="shrink-0 text-sm font-medium whitespace-nowrap">{renderEta(item, now)}</div>
              </div>
              {carLoad && <CarLoadBlocks recommendation={carLoad} />}
            </li>
          )
        })}
        {!items.length && (
          <li className="py-6 text-center text-sm text-gray-500">
            尚無即時資訊
          </li>
        )}
      </ul>
    </div>
  )
}
