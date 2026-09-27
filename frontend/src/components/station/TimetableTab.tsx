import { LineMark, StationCode } from '@/components/Badges'
import { directionOf } from '@/components/station/ArrivalsBoard'
import { findLine, findStation, lineName, stationName, type Station } from '@/data/network'
import { useNow } from '@/hooks/useNow'
import { useStrings } from '@/lib/i18n'
import { serviceMinutes, serviceMinutesNow } from '@/lib/time'

export default function TimetableTab({ station }: { station: Station }) {
  const { t, lang } = useStrings()
  const now = useNow()
  const nowMinutes = serviceMinutesNow(now)

  if (!station.departures.length) {
    return <p className="py-10 text-center text-[14px] text-ink-3">{t.noLiveData}</p>
  }

  const byLine = new Map<string, typeof station.departures>()
  for (const departure of station.departures) byLine.set(departure.line, [...(byLine.get(departure.line) ?? []), departure])

  return (
    <div className="space-y-3">
      <p className="px-1 text-[12px] font-semibold tracking-[0.06em] text-ink-3 uppercase">{t.weekday}</p>
      {[...byLine].map(([lineId, departures]) => {
        const line = findLine(lineId)
        if (!line) return null
        return (
          <section key={lineId} className="overflow-hidden rounded-[var(--radius-card)] bg-surface-2 ring-1 ring-hairline">
            <header className="flex items-center gap-2 px-4 pt-3 pb-1">
              <LineMark line={line} size="sm" />
              <span className="text-[14.5px] font-bold">{lineName(line, lang)}</span>
            </header>
            <ul>
              {departures
                .slice()
                .sort((a, b) => (directionOf(station, line, a.to) === 'down' ? -1 : 1) - (directionOf(station, line, b.to) === 'down' ? -1 : 1))
                .map(departure => {
                  const destination = findStation(departure.to)
                  const last = departure.last[departure.last.length - 1]
                  const minutesToLast = last ? serviceMinutes(last) - nowMinutes : null
                  const lastSoon = minutesToLast != null && minutesToLast > 0 && minutesToLast <= 90
                  const code = destination?.codes.find(item => line.stations.includes(item)) ?? departure.to
                  return (
                    <li key={departure.to} className="border-t border-hairline px-4 py-3 first:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[12.5px] font-semibold text-ink-3">{t.towards}</span>
                        <StationCode code={code} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-[16px] font-bold">
                          {destination ? stationName(destination, lang) : departure.to}
                        </span>
                        {lastSoon ? (
                          <span className="shrink-0 rounded-full bg-amber/20 px-2 py-0.5 text-[11.5px] font-bold text-amber-ink">
                            {t.lastTrainIn(minutesToLast!)}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {[
                          { label: t.firstTrain, times: departure.first, primary: departure.first[0] },
                          { label: t.lastTrain, times: departure.last, primary: last }
                        ].map(block => (
                          <div key={block.label} className="rounded-[12px] bg-surface px-3 py-2 ring-1 ring-hairline">
                            <div className="text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">{block.label}</div>
                            <div className="tabular text-[22px] leading-tight font-bold">{block.primary ?? '—'}</div>
                            {block.times.length > 1 ? (
                              <div className="tabular mt-0.5 text-[11.5px] text-ink-3">{block.times.join(' · ')}</div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </li>
                  )
                })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
