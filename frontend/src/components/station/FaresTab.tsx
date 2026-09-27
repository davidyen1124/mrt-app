import { StationCodes } from '@/components/Badges'
import { SearchIcon } from '@/components/Icons'
import { findStation, searchStations, stationName, type Station } from '@/data/network'
import type { Fare } from '@/hooks/useLiveData'
import type { Polled } from '@/hooks/usePolling'
import { useStrings } from '@/lib/i18n'
import { useMemo, useState } from 'react'

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
      <div className="flex justify-end gap-6 px-2 pb-1 text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
        <span>{t.fareFull}</span>
        <span className="w-9 text-right">{t.fareConcession}</span>
      </div>
      <ul className="-mx-2">
        {rows.map(({ fare, station }) => (
          <li key={station.id}>
            <button
              type="button"
              onClick={() => onSelect(station)}
              className="flex min-h-[54px] w-full items-center gap-3 rounded-[12px] px-2 py-1.5 text-left transition hover:bg-surface-2"
            >
              <StationCodes station={station} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{stationName(station, lang)}</span>
                <span className="tabular block text-[12px] text-ink-3">{t.travelTime(fare.minutes)}</span>
              </span>
              <span className="tabular text-[17px] font-bold">
                <span className="mr-0.5 text-[11px] font-semibold text-ink-3">NT$</span>
                {fare.fare}
              </span>
              <span className="tabular w-9 text-right text-[13px] font-semibold text-ink-3">{fare.concession ?? '—'}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
