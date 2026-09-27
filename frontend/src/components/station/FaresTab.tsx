import { CodeColumn } from '@/components/Badges'
import { SearchIcon } from '@/components/Icons'
import { findStation, searchStations, stationName, type Station } from '@/data/network'
import type { Fare } from '@/hooks/useLiveData'
import type { Polled } from '@/hooks/usePolling'
import { useStrings } from '@/lib/i18n'
import { useMemo, useState } from 'react'

// Codes | name | adult | concession. Shared by the header and every row so the columns always line up.
const FARE_GRID = 'grid grid-cols-[45px_minmax(0,1fr)_56px_64px] items-center gap-x-3'

function Price({ value, className }: { value: number | null; className: string }) {
  return (
    <span className="tabular text-right whitespace-nowrap">
      {value == null ? (
        <span className="text-ink-3">—</span>
      ) : (
        <>
          <span className="mr-0.5 text-[11px] font-semibold text-ink-3">NT$</span>
          <span className={className}>{value}</span>
        </>
      )}
    </span>
  )
}

export default function FaresTab({ fares, onSelect }: { fares: Polled<Fare[]>; onSelect: (station: Station) => void }) {
  const { t, lang } = useStrings()
  const [filter, setFilter] = useState('')

  const rows = useMemo(() => {
    const list = (fares.data ?? []).map(fare => ({ fare, station: findStation(fare.to) })).filter(
      (item): item is { fare: Fare; station: Station } => Boolean(item.station)
    )
    if (!filter.trim()) return list
    const matches = new Set(searchStations(filter).map(station => station.id))
    return list.filter(item => matches.has(item.station.id))
  }, [fares.data, filter])

  if (fares.loading) return <p className="py-10 text-center text-[14px] text-ink-3">{t.loading}</p>
  if (!fares.data?.length) return <p className="py-10 text-center text-[14px] text-ink-3">{t.faresUnavailable}</p>

  return (
    <div>
      <label className="relative mb-2 flex h-10 items-center rounded-[12px] bg-surface-2 ring-1 ring-hairline">
        <SearchIcon size={16} className="pointer-events-none absolute left-3 text-ink-3" />
        <input
          value={filter}
          onChange={event => setFilter(event.target.value)}
          placeholder={t.faresFilter}
          className="h-full w-full bg-transparent pr-3 pl-9 text-[16px] outline-none placeholder:text-ink-3"
          aria-label={t.faresFilter}
        />
      </label>
      <div className={`${FARE_GRID} px-2 pt-1 pb-1.5 text-[12px] font-semibold text-ink-3`}>
        <span className="col-span-2">{t.faresDestination}</span>
        <span className="text-right whitespace-nowrap">{t.fareFull}</span>
        <span className="text-right whitespace-nowrap">{t.fareConcession}</span>
      </div>
      <ul className="-mx-2">
        {rows.map(({ fare, station }) => (
          <li key={station.id}>
            <button
              type="button"
              onClick={() => onSelect(station)}
              className={`${FARE_GRID} min-h-[56px] w-full rounded-[12px] px-2 py-1.5 text-left transition hover:bg-surface-2`}
            >
              <CodeColumn station={station} />
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold">{stationName(station, lang)}</span>
                <span className="tabular block text-[12px] text-ink-3">{t.travelTime(fare.minutes)}</span>
              </span>
              <Price value={fare.fare} className="text-[17px] font-bold text-ink" />
              <Price value={fare.concession} className="text-[15px] font-semibold text-ink-2" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
