import { LineMark } from '@/components/Badges'
import { ChevronRight, GithubIcon, PinIcon, StarIcon, WalkIcon } from '@/components/Icons'
import StationRow from '@/components/StationRow'
import {
  branchesOf,
  findStation,
  lineName,
  mainLines,
  nearestStations,
  networkMeta,
  stationName,
  terminalsToward,
  type Line,
  type Station
} from '@/data/network'
import type { GeoState } from '@/hooks/useGeolocation'
import { useStrings } from '@/lib/i18n'
import type { ReactNode } from 'react'

type HomePanelProps = {
  geo: GeoState
  favorites: string[]
  onLocate: () => void
  onSelectStation: (station: Station) => void
  onSelectLine: (line: Line) => void
}

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mt-6 first:mt-2">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-[13px] font-bold tracking-[0.06em] text-ink-3 uppercase">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function LineChips({ onSelectLine }: { onSelectLine: (line: Line) => void }) {
  const { lang } = useStrings()
  return (
    <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4" data-no-drag>
      {mainLines.map(line => (
        <button
          key={line.id}
          type="button"
          onClick={() => onSelectLine(line)}
          className="flex h-9 shrink-0 items-center gap-2 rounded-full bg-surface-2 py-1 pr-3.5 pl-1 ring-1 ring-hairline transition active:scale-[0.97]"
        >
          <LineMark line={line} size="md" />
          <span className="text-[13.5px] font-semibold whitespace-nowrap">{lineName(line, lang)}</span>
        </button>
      ))}
    </div>
  )
}

const formatDistance = (meters: number, lang: 'zh' | 'en') =>
  meters < 1000 ? `${Math.round(meters / 10) * 10} ${lang === 'zh' ? '公尺' : 'm'}` : `${(meters / 1000).toFixed(1)} ${lang === 'zh' ? '公里' : 'km'}`

export default function HomePanel({ geo, favorites, onLocate, onSelectStation, onSelectLine }: HomePanelProps) {
  const { t, lang } = useStrings()
  const favoriteStations = favorites.map(id => findStation(id)).filter((item): item is Station => Boolean(item))
  const updated = new Intl.DateTimeFormat(lang === 'zh' ? 'zh-TW' : 'en-GB', { dateStyle: 'medium', timeZone: 'Asia/Taipei' }).format(
    new Date(networkMeta.generatedAt)
  )

  return (
    <div className="pb-4">
      <Section title={t.nearby}>
        {geo.status === 'ready' ? (
          <ul className="-mx-2">
            {nearestStations(geo).map(({ station, meters }) => (
              <li key={station.id}>
                <StationRow
                  station={station}
                  onSelect={onSelectStation}
                  meta={
                    <span className="inline-flex items-center gap-1">
                      <WalkIcon size={13} />
                      {formatDistance(meters, lang)} · {t.walk(Math.max(1, Math.round((meters * 1.3) / 80)))}
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <button
            type="button"
            onClick={onLocate}
            disabled={geo.status === 'locating'}
            className="flex w-full items-center gap-3 rounded-[var(--radius-card)] bg-surface-2 p-3.5 text-left ring-1 ring-hairline transition active:scale-[0.99]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#2f7cf6]/12 text-[#2f7cf6]">
              <PinIcon size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">
                {geo.status === 'locating' ? t.nearbyLocating : t.nearbyCta}
              </span>
              {geo.status === 'denied' ? <span className="block text-[12.5px] text-ink-3">{t.nearbyDenied}</span> : null}
            </span>
            <ChevronRight size={16} className="text-ink-3" />
          </button>
        )}
      </Section>

      <Section title={t.favorites}>
        {favoriteStations.length ? (
          <ul className="-mx-2">
            {favoriteStations.map(station => (
              <li key={station.id}>
                <StationRow station={station} onSelect={onSelectStation} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-ink/15 p-3.5 text-[13.5px] text-ink-3">
            <StarIcon size={18} />
            {t.favoritesEmpty}
          </div>
        )}
      </Section>

      <Section title={t.lines}>
        <ul className="overflow-hidden rounded-[var(--radius-card)] bg-surface-2 ring-1 ring-hairline">
          {mainLines.flatMap(line => [line, ...branchesOf(line)]).map(line => {
            const first = findStation(line.stations[0])!
            const ends = terminalsToward(first, line, 'up')
            return (
              <li key={line.id} className="border-b border-hairline last:border-0">
                <button
                  type="button"
                  onClick={() => onSelectLine(line)}
                  className={`flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-surface-3/60 ${line.branchOf ? 'pl-8' : ''}`}
                >
                  <LineMark line={line} size={line.branchOf ? 'sm' : 'md'} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate font-semibold ${line.branchOf ? 'text-[14px]' : 'text-[15.5px]'}`}>
                      {lineName(line, lang)}
                    </span>
                    <span className="block truncate text-[12.5px] text-ink-3">
                      {stationName(first, lang)} ↔ {ends.map(end => stationName(end, lang)).join(' / ')}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-[12.5px] text-ink-3">{t.stationsCount(line.stations.length)}</span>
                  <ChevronRight size={16} className="shrink-0 text-ink-3" />
                </button>
              </li>
            )
          })}
        </ul>
      </Section>

      <footer className="mt-8 space-y-2 px-1 text-[11.5px] leading-relaxed text-ink-3">
        <p>{t.disclaimer}</p>
        <p>{t.sources}</p>
        <p className="flex items-center justify-between">
          <span>{t.dataUpdated(updated)}</span>
          <a
            href="https://github.com/davidyen1124/mrt-app"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-ink-2"
          >
            <GithubIcon size={14} /> GitHub
          </a>
        </p>
      </footer>
    </div>
  )
}
