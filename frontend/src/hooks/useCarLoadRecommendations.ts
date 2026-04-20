import { useEffect, useState } from 'react'

export type CarLoadRecommendation = {
  directionId: '1' | '2'
  directionLabel: string
  carLoads: number[]
  bestCars: number[]
}

type CarLoadResponse = {
  stationId: string
  recommendations: CarLoadRecommendation[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const toString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

const toDirectionId = (value: unknown): '1' | '2' | null =>
  value === '1' || value === '2' ? value : null

const toNumberArray = (value: unknown): number[] | null => {
  if (!Array.isArray(value)) return null
  const numbers = value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
  return numbers.length === value.length ? numbers : null
}

const toRecommendation = (value: unknown): CarLoadRecommendation | null => {
  if (!isRecord(value)) return null
  const directionId = toDirectionId(value.directionId)
  const directionLabel = toString(value.directionLabel)
  const carLoads = toNumberArray(value.carLoads)
  const bestCars = toNumberArray(value.bestCars)

  if (
    !directionId ||
    !directionLabel ||
    !carLoads ||
    !bestCars
  ) {
    return null
  }

  return {
    directionId,
    directionLabel,
    carLoads,
    bestCars
  }
}

const toCarLoadResponse = (value: unknown): CarLoadResponse | null => {
  if (!isRecord(value)) return null
  const stationId = toString(value.stationId)
  if (!stationId || !Array.isArray(value.recommendations)) return null

  return {
    stationId,
    recommendations: value.recommendations
      .map(toRecommendation)
      .filter((item): item is CarLoadRecommendation => Boolean(item))
  }
}

export function useCarLoadRecommendations(stationId: string) {
  const [recommendations, setRecommendations] = useState<CarLoadRecommendation[]>([])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const load = async () => {
      try {
        const response = await fetch(
          `/api/mrt/taipei/car-load?stationId=${encodeURIComponent(stationId)}`,
          { signal: controller.signal }
        )
        if (!response.ok) throw new Error('car load failed')
        const raw: unknown = await response.json()
        const normalized = toCarLoadResponse(raw)
        if (!cancelled) {
          setRecommendations(normalized?.recommendations ?? [])
        }
      } catch {
        if (!cancelled) setRecommendations([])
      }
    }

    setRecommendations([])
    load()
    const poll = setInterval(load, 20000)

    return () => {
      cancelled = true
      controller.abort()
      clearInterval(poll)
    }
  }, [stationId])

  return recommendations
}
