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
    return <div className="py-6 text-center text-gray-500 text-sm">{emptyLabel}</div>
  }

  return (
    <ul className="divide-y">
      {stations.map((station, index) => (
        <li key={`${station.id}-${index}`}>
          <button
            type="button"
            className="w-full py-2 flex items-center justify-between text-left"
            onClick={() => onSelect(station)}
          >
            <div>
              <div className="text-base">{station.name_zh}</div>
            </div>
            <div className="text-sm text-blue-600 whitespace-nowrap">查看</div>
          </button>
        </li>
      ))}
    </ul>
  )
}
