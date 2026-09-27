import { LineMark, StationCode } from '@/components/Badges'
import CarLoadStrip from '@/components/station/CarLoadStrip'
import {
  codeOnLine,
  findStation,
  isTerminus,
  lineName,
  linesAt,
  stationName,
  terminalsToward,
  type Direction,
  type Line,
  type Station
} from '@/data/network'
import type { Arrival, CarLoad } from '@/hooks/useLiveData'
import { useNow } from '@/hooks/useNow'
import type { Polled } from '@/hooks/usePolling'
import { useStrings } from '@/lib/i18n'
import { countdown } from '@/lib/time'

type ArrivalsBoardProps = {
  station: Station
  arrivals: Polled<Arrival[]>
  carLoads: CarLoad[]
}

const DIRECTIONS: Direction[] = ['down', 'up']

/** Which way a timetable destination lies from this station along a line. */
export function directionOf(station: Station, line: Line, destinationCode: string): Direction | null {
  const here = codeOnLine(station, line)
  const destination = findStation(destinationCode)
  const there = destination?.codes.find(code => line.stations.includes(code)) ?? destinationCode
  if (!here || !line.stations.includes(there)) return null
  return line.stations.indexOf(there) > line.stations.indexOf(here) ? 'up' : 'down'
}

function Countdown({ arrival, now }: { arrival: Arrival; now: number }) {
  const { t } = useStrings()
  if (arrival.status === 'ended' || arrival.status === 'notice' || arrival.arriveAt == null) {
    return <span className="text-[13px] font-semibold text-board-dim">{arrival.label ?? '—'}</span>
  }
  const value = arrival.status === 'arriving' ? ({ kind: 'arriving' } as const) : countdown(arrival.arriveAt, now)
  if (value.kind === 'arriving') {
    return (
      <span className="flex items-center gap-1.5 text-[17px] font-extrabold text-amber-ink">
        <span className="animate-live h-2 w-2 rounded-full bg-amber-ink" />
        {t.arriving}
      </span>
    )
  }
  if (value.kind === 'minutes') {
    return (
      <span className="tabular flex items-baseline gap-1 text-board-ink">
        <span className="text-[30px] leading-none font-bold tracking-[-0.02em]">{value.minutes}</span>
        <span className="text-[13px] font-semibold text-board-dim">{t.minutesUnit}</span>
      </span>
    )
  }
  return (
    <span className={`tabular text-[30px] leading-none font-bold tracking-[-0.02em] ${value.kind === 'imminent' ? 'text-amber-ink' : 'text-board-ink'}`}>
      {value.text}
    </span>
  )
}

function DirectionGroup({ station, line, direction, arrivals, carLoad, now }: {
  station: Station
  line: Line
  direction: Direction
  arrivals: Arrival[]
  carLoad?: CarLoad
  now: number
}) {
  const { t, lang } = useStrings()
  const ends = terminalsToward(station, line, direction)
  const firstTrain = station.departures.find(item => item.line === line.id && directionOf(station, line, item.to) === direction)?.first[0]
  const ended = arrivals.length > 0 && arrivals.every(item => item.status === 'ended')
  const live = arrivals.filter(item => item.status !== 'ended')
  // The direction caption only adds information when short-turn trains or a fork share the platform.
  const showCaption =
    ended || !arrivals.length || live.length > 1 || ends.length > 1 || live[0]?.destination.stationId !== ends[0]?.id

  return (
    <div className="border-t border-board-line px-4 py-2.5 first:border-0">
      {showCaption ? (
        <div className="text-[11px] font-semibold tracking-[0.08em] text-board-dim uppercase">
          <span className="truncate">
            {t.towards} {ends.map(end => stationName(end, lang)).join(' · ')}
            {lang === 'zh' ? ' 方向' : ''}
          </span>
        </div>
      ) : null}
      {ended || !arrivals.length ? (
        <div className="flex items-center justify-between py-2">
          <span className="text-[14px] font-semibold text-board-ink/80">{ended ? t.noService : t.noLiveData}</span>
          {firstTrain ? <span className="tabular text-[12.5px] text-board-dim">{t.noServiceHint(firstTrain)}</span> : null}
        </div>
      ) : (
        <ul>
          {live.map((arrival, index) => {
            const code = arrival.destination.stationId
              ? findStation(arrival.destination.stationId)?.codes.find(item => line.stations.includes(item)) ?? arrival.destination.code
              : arrival.destination.code
            const destination = arrival.destination.stationId ? findStation(arrival.destination.stationId) : undefined
            const name = destination ? stationName(destination, lang) : lang === 'en' ? arrival.destination.name.en || arrival.destination.name.zh : arrival.destination.name.zh
            const secondary = destination ? (lang === 'en' ? destination.name.zh : destination.name.en) : ''
            return (
              <li key={`${arrival.destination.code}-${index}`} className="py-1.5">
                <div className="flex items-center gap-3">
                  <span className="text-[12px] font-semibold text-board-dim">{t.towards}</span>
                  {code ? <StationCode code={code} size="sm" filled={isTerminus(code)} /> : null}
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate font-bold tracking-[0.02em] text-board-ink ${index === 0 ? 'text-[18px]' : 'text-[15.5px]'}`}>{name}</span>
                    {secondary ? <span className="block truncate text-[11px] text-board-dim">{secondary}</span> : null}
                  </span>
                  <span className="shrink-0">
                    <Countdown arrival={arrival} now={now} />
                  </span>
                </div>
                {index === 0 && carLoad && arrival.status !== 'ended' ? <CarLoadStrip load={carLoad} /> : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-[18px] bg-board p-4 ring-1 ring-hairline">
      <div className="h-4 w-28 animate-pulse rounded bg-ink/10" />
      <div className="mt-4 flex items-center justify-between">
        <div className="h-5 w-40 animate-pulse rounded bg-ink/10" />
        <div className="h-7 w-14 animate-pulse rounded bg-ink/10" />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="h-5 w-32 animate-pulse rounded bg-ink/10" />
        <div className="h-7 w-14 animate-pulse rounded bg-ink/10" />
      </div>
    </div>
  )
}

export default function ArrivalsBoard({ station, arrivals, carLoads }: ArrivalsBoardProps) {
  const { t, lang } = useStrings()
  const now = useNow()
  const lines = linesAt(station)

  if (arrivals.loading && !arrivals.data) {
    return (
      <div className="space-y-3">
        {lines.map(line => (
          <SkeletonCard key={line.id} />
        ))}
      </div>
    )
  }

  const data = arrivals.data ?? []
  const secondsAgo = arrivals.receivedAt ? Math.max(0, Math.round((now - arrivals.receivedAt) / 1000)) : null

  return (
    <div className="space-y-3">
      {lines.map(line => {
        const own = codeOnLine(station, line)!
        const forLine = data.filter(item => item.line === line.id)
        // Branch lines only get a card when a branch train is actually listed (北投 → 新北投).
        if (line.branchOf && !forLine.length && !station.codes.includes(line.stations[line.stations.length - 1])) return null
        const directions = DIRECTIONS.filter(direction => terminalsToward(station, line, direction).length > 0)
        return (
          <article key={line.id} className="animate-rise relative overflow-hidden rounded-[18px] bg-board text-board-ink ring-1 ring-hairline">
            <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: line.color }} aria-hidden="true" />
            <header className="flex items-center gap-2.5 px-4 pt-4 pb-2">
              <LineMark line={line} size="sm" />
              <span className="text-[14.5px] font-bold">{lineName(line, lang)}</span>
              <span className="truncate text-[12px] text-board-dim">{lang === 'zh' ? line.name.en : line.name.zh}</span>
              <span className="ml-auto">
                <StationCode code={own} size="sm" filled={isTerminus(own)} />
              </span>
            </header>
            {directions.map(direction => (
              <DirectionGroup
                key={direction}
                station={station}
                line={line}
                direction={direction}
                now={now}
                arrivals={forLine.filter(item => item.direction === direction)}
                carLoad={carLoads.find(item => item.line === line.code && item.direction === direction && !line.branchOf)}
              />
            ))}
          </article>
        )
      })}

      <p className="flex items-center justify-center gap-1.5 pt-1 text-[11.5px] text-ink-3">
        <span className={`h-1.5 w-1.5 rounded-full ${arrivals.error ? 'bg-amber' : 'animate-live bg-live'}`} />
        {arrivals.error && !data.length ? t.noLiveData : secondsAgo != null ? t.updatedAgo(secondsAgo) : t.loading}
        <span>·</span>
        <span>{t.sourceNote}</span>
      </p>
    </div>
  )
}
