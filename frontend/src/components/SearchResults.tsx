import StationRow from '@/components/StationRow'
import type { Station } from '@/data/network'
import { useStrings } from '@/lib/i18n'

export default function SearchResults({ results, query, onSelect }: { results: Station[]; query: string; onSelect: (station: Station) => void }) {
  const { t } = useStrings()
  if (!query.trim()) {
    return <p className="px-2 pt-6 text-center text-[14px] text-ink-3">{t.searchHint}</p>
  }
  if (!results.length) {
    return (
      <div className="px-2 pt-10 text-center">
        <p className="text-[15px] font-semibold">{t.searchNoResults}</p>
        <p className="mt-1 text-[13px] text-ink-3">{t.searchHint}</p>
      </div>
    )
  }
  return (
    <ul className="-mx-2 pt-1">
      {results.map(station => (
        <li key={station.id} className="animate-rise">
          <StationRow station={station} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  )
}
