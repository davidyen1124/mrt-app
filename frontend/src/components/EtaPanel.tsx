import { useEffect, useReducer, useState } from 'react'
import type { Station } from '../types/station'

type EtaItem = {
  routeName?: any
  destinationStationId?: string
  stationName?: any
  estimateTime?: number
  arriveAt?: number
}

type EnrichedEtaItem = EtaItem & { arriveAt: number | null }

type EtaPanelProps = {
  station: Station
}

const renderEta = (item: EnrichedEtaItem) => {
  if (item.arriveAt == null) return (item as any)?.etaLabel ?? (item as any)?.estimateTime ?? '-'
  const remaining = Math.max(0, Math.round((item.arriveAt - Date.now()) / 1000))
  if (remaining === 0) return '進站中'
  const minutes = Math.floor(remaining / 60)
  const seconds = Math.max(0, remaining % 60)
  return minutes === 0 ? `${seconds}秒` : `${minutes}分${seconds}秒`
}

export default function EtaPanel({ station }: EtaPanelProps) {
  const [items, setItems] = useState<EnrichedEtaItem[]>([])
  const [, forceRender] = useReducer((tick: number) => tick + 1, 0)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const response = await fetch(`/api/mrt/taipei/eta?stationId=${encodeURIComponent(station.id)}`)
        const raw = await response.json()
        const data: EtaItem[] = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as any)?.items)
          ? (raw as any).items
          : Array.isArray((raw as any)?.result)
          ? (raw as any).result
          : []
        if (cancelled) return
        const enriched: EnrichedEtaItem[] = (data || []).map((item: any) => ({
          ...item,
          arriveAt: Number.isFinite(item?.arriveAt) ? Number(item.arriveAt) : null
        }))
        setItems(enriched)
      } catch {
        if (!cancelled) setItems([])
      }
    }

    load()
    const poll = setInterval(load, 15000)
    const ticker = setInterval(() => forceRender(), 1000)

    return () => {
      cancelled = true
      clearInterval(poll)
      clearInterval(ticker)
    }
  }, [station.id])

  return (
    <div className="border rounded-lg p-3">
      <div className="font-semibold text-base">{station.name_zh}</div>
      <ul className="mt-2 divide-y">
        {items.map((item, index) => (
          <li key={index} className="py-2 flex items-center justify-between">
            <div className="text-sm truncate">
              {(item as any)?.routeName?.zh || (item as any)?.routeName || '路線'}
              <span className="mx-1">→</span>
              {((item as any)?.stationName?.zh ||
                (item as any)?.stationName ||
                (item as any)?.destinationStationName?.zh ||
                item.destinationStationId) as any}
            </div>
            <div className="text-sm font-medium whitespace-nowrap">{renderEta(item)}</div>
          </li>
        ))}
        {!items.length && <li className="py-6 text-center text-gray-500 text-sm">尚無即時資訊</li>}
      </ul>
    </div>
  )
}
