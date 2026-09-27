import { LineMark, StationCode } from '@/components/Badges'
import { ChevronLeft, CloseIcon } from '@/components/Icons'
import {
  branchesOf,
  codeOnLine,
  findLine,
  findStation,
  isTransfer,
  lineName,
  stationName,
  terminalsToward,
  type Line,
  type Station
} from '@/data/network'
import { useStrings } from '@/lib/i18n'

export function LineHeader({ line, onBack, onClose }: { line: Line; onBack: () => void; onClose: () => void }) {
  const { t, lang } = useStrings()
  const first = findStation(line.stations[0])!
  const ends = terminalsToward(first, line, 'up')
  const parent = findLine(line.branchOf)
  return (
    <div className="flex items-center gap-3 pt-1">
      <button type="button" onClick={onBack} className="-ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface-2" aria-label="back">
        <ChevronLeft size={22} />
      </button>
      <LineMark line={line} size="lg" />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[21px] leading-tight font-extrabold tracking-[0.01em]">{lineName(line, lang)}</h1>
        <p className="truncate text-[13px] text-ink-3">
          {parent ? `${lineName(parent, lang)} · ` : ''}
          {stationName(first, lang)} ↔ {ends.map(end => stationName(end, lang)).join(' / ')} · {t.stationsCount(line.stations.length)}
        </p>
      </div>
      <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2" aria-label={t.close}>
        <CloseIcon size={17} strokeWidth={2.4} />
      </button>
    </div>
  )
}

function StripRow({ station, line, position, junction, onSelect }: {
  station: Station
  line: Line
  position: 'first' | 'middle' | 'last' | 'only'
  junction?: boolean
  onSelect: (station: Station) => void
}) {
  const { lang } = useStrings()
  const own = codeOnLine(station, line)!
  const others = station.codes.filter(code => code !== own)
  const transfer = isTransfer(station)
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(station)}
        className={`group flex min-h-[58px] w-full items-center gap-3 rounded-[12px] pr-2 text-left transition hover:bg-surface-2 active:bg-surface-3 ${junction ? 'opacity-60' : ''}`}
      >
        <span className="relative flex w-9 shrink-0 self-stretch items-center justify-center">
          <span
            className="absolute left-1/2 w-[5px] -translate-x-1/2"
            style={{
              background: line.color,
              top: position === 'first' || position === 'only' ? '50%' : 0,
              bottom: position === 'last' || position === 'only' ? '50%' : 0
            }}
          />
          <span
            className="relative rounded-full bg-surface"
            style={
              transfer
                ? { width: 17, height: 17, border: '3.5px solid var(--ink)' }
                : { width: 14, height: 14, border: `3.5px solid ${line.color}` }
            }
          />
        </span>
        <span className="min-w-0 flex-1 py-2">
          <span className="block truncate text-[16px] font-semibold">{stationName(station, lang)}</span>
          <span className="block truncate text-[12px] text-ink-3">{lang === 'en' ? station.name.zh : station.name.en}</span>
        </span>
        {others.length ? (
          <span className="flex shrink-0 items-center gap-[3px]">
            {others.map(code => (
              <StationCode key={code} code={code} size="sm" filled={false} />
            ))}
          </span>
        ) : null}
        <StationCode code={own} size="sm" />
      </button>
    </li>
  )
}

export default function LinePanel({ line, onSelectStation, onSelectLine }: { line: Line; onSelectStation: (station: Station) => void; onSelectLine: (line: Line) => void }) {
  const { t, lang } = useStrings()
  const branches = branchesOf(line)

  return (
    <div className="pb-4">
      {line.segments.map((segment, index) => {
        const members = segment.map(code => findStation(code)!).filter(Boolean)
        const junction = index > 0 ? members[0] : null
        const branchEnd = members[members.length - 1]
        return (
          <section key={segment.join()} className={index > 0 ? 'mt-5' : 'mt-1'}>
            {junction ? (
              <h2 className="mb-1 px-1 text-[13px] font-bold tracking-[0.04em] text-ink-3">
                {lang === 'zh' ? `${stationName(branchEnd, lang)}${t.branch}` : `${stationName(branchEnd, lang)} ${t.branch}`}
              </h2>
            ) : null}
            <ol>
              {members.map((station, row) => (
                <StripRow
                  key={station.id}
                  station={station}
                  line={line}
                  junction={Boolean(junction) && row === 0}
                  position={members.length === 1 ? 'only' : row === 0 ? 'first' : row === members.length - 1 ? 'last' : 'middle'}
                  onSelect={onSelectStation}
                />
              ))}
            </ol>
          </section>
        )
      })}

      {branches.length ? (
        <div className="mt-5 flex flex-wrap gap-2 px-1">
          {branches.map(branch => (
            <button
              key={branch.id}
              type="button"
              onClick={() => onSelectLine(branch)}
              className="flex h-9 items-center gap-2 rounded-full bg-surface-2 py-1 pr-3.5 pl-1 ring-1 ring-hairline"
            >
              <LineMark line={branch} size="md" />
              <span className="text-[13.5px] font-semibold">{lineName(branch, lang)}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
