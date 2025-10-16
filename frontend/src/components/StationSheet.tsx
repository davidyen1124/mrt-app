import EtaPanel from '@/components/EtaPanel'
import StationSearchInput from '@/components/StationSearchInput'
import StationSearchResults from '@/components/StationSearchResults'
import type { Station } from '@/types/station'

export type SheetMode = 'idle' | 'search' | 'station'

type StationSheetProps = {
  expanded: boolean
  sheetHeightPx: number
  query: string
  onQueryChange: (value: string) => void
  onClearQuery: () => void
  mode: SheetMode
  selected: Station | null
  results: Station[]
  onStationSelect: (station: Station) => void
}

export default function StationSheet({
  expanded,
  sheetHeightPx,
  query,
  onQueryChange,
  onClearQuery,
  mode,
  selected,
  results,
  onStationSelect
}: StationSheetProps) {
  const contentClassName = expanded
    ? 'flex flex-1 flex-col gap-3 px-4 py-3 overflow-hidden'
    : 'px-4 py-3'

  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-none">
      <div
        className="pointer-events-auto mx-auto w-full max-w-xl rounded-t-2xl bg-white shadow-[0_-8px_24px_rgba(0,0,0,.08)] flex flex-col"
        style={{
          height: `${sheetHeightPx}px`,
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
          paddingTop: expanded ? '12px' : '8px',
          transition: 'height .25s ease'
        }}
      >
        <div className={contentClassName}>
          <StationSearchInput
            placeholder="搜尋「忠孝新生」"
            value={query}
            onChange={onQueryChange}
            onClear={onClearQuery}
          />
          {expanded && (
            <div className="flex-1 overflow-y-auto">
              {mode === 'station' && selected && <EtaPanel station={selected} />}
              {mode === 'search' && (
                <StationSearchResults
                  stations={results}
                  onSelect={onStationSelect}
                  emptyLabel="沒有符合的站點"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
