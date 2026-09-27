import { StationCode } from '@/components/Badges'
import { codeOnLine, linesAt, neighbours, stationName, type Station } from '@/data/network'
import { useStrings } from '@/lib/i18n'

/** Platform-sign strip for each line: previous station ◂ [code] ▸ next station. */
export default function AdjacentPlates({ station, onSelect }: { station: Station; onSelect: (station: Station) => void }) {
  const { lang } = useStrings()
  const plates = linesAt(station).map(line => ({ line, code: codeOnLine(station, line)!, ...neighbours(station, line) }))

  const side = (items: Station[], align: 'start' | 'end') =>
    items.length ? (
      <span className={`flex min-w-0 flex-1 flex-col ${align === 'end' ? 'items-end text-right' : 'items-start'}`}>
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className={`flex max-w-full items-center gap-1 rounded-md py-0.5 text-[14px] font-semibold transition hover:text-ink ${align === 'end' ? 'flex-row-reverse' : ''}`}
          >
            <span className="text-[11px] text-ink-3">{align === 'end' ? '▸' : '◂'}</span>
            <span className="truncate">{stationName(item, lang)}</span>
          </button>
        ))}
      </span>
    ) : (
      <span className={`flex-1 text-[12px] font-semibold tracking-[0.08em] text-ink-3 ${align === 'end' ? 'text-right' : ''}`}>
        {lang === 'zh' ? '終點站' : 'TERMINUS'}
      </span>
    )

  return (
    <div className="mt-1 space-y-2">
      {plates.map(({ line, code, prev, next }) => (
        <div
          key={line.id}
          className="relative flex items-center gap-3 overflow-hidden rounded-[12px] bg-surface-2 py-2 pr-3 pl-4 ring-1 ring-hairline"
        >
          <span className="absolute inset-y-0 left-0 w-[5px]" style={{ background: line.color }} />
          {side(prev, 'start')}
          <StationCode code={code} size="sm" />
          {side(next, 'end')}
        </div>
      ))}
    </div>
  )
}
