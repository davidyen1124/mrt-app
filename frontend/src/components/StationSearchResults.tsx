import type { Station } from '@/types/station'

type StationSearchResultsProps = {
  stations: Station[]
  onSelect: (station: Station) => void
  emptyLabel: string
}

export default function StationSearchResults({
  stations,
  onSelect,
  emptyLabel
}: StationSearchResultsProps) {
  if (!stations.length) {
    return (
      <div className="border rounded-lg p-3">
        <div className="py-6 text-center text-gray-500 text-sm">{emptyLabel}</div>
      </div>
    )
  }

  return (
    <div className="border rounded-lg p-3">
      <ul className="divide-y">
        {stations.map((station, index) => (
          <li key={`${station.id}-${index}`}>
            <button
              type="button"
              className="w-full py-2 flex items-center text-left"
              onClick={() => onSelect(station)}
            >
              <span className="text-sm truncate">{station.name_zh}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
