import { LineMark } from '@/components/Badges'
import { BikeIcon, InfoIcon, LockerIcon, RestroomIcon } from '@/components/Icons'
import { findLine, type FacilityRow, type Station } from '@/data/network'
import { useStrings } from '@/lib/i18n'
import type { ReactNode } from 'react'

function Card({ icon, title, rows }: { icon: ReactNode; title: string; rows: FacilityRow[] }) {
  if (!rows.length) return null
  return (
    <section className="rounded-[var(--radius-card)] bg-surface-2 p-4 ring-1 ring-hairline">
      <h3 className="flex items-center gap-2 text-[14.5px] font-bold">
        <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-surface text-ink ring-1 ring-hairline">{icon}</span>
        {title}
      </h3>
      <ul className="mt-2 space-y-2">
        {rows.map(row => {
          const line = row.line ? findLine(row.line) : undefined
          return (
            <li key={`${row.line}-${row.text}`} className="flex items-start gap-2">
              {line ? (
                // Same height as one text line, so the tag centres on the first line of a multi-line entry.
                <span className="flex h-[22px] shrink-0 items-center">
                  <LineMark line={line} size="sm" />
                </span>
              ) : null}
              <p className="text-[14px] leading-[22px] whitespace-pre-line text-ink-2">{row.text}</p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default function FacilitiesTab({ station }: { station: Station }) {
  const { t } = useStrings()
  const { restroom, info, lockers, bikes } = station.facilities
  if (![restroom, info, lockers, bikes].some(rows => rows.length)) {
    return <p className="py-10 text-center text-[14px] text-ink-3">{t.facilitiesEmpty}</p>
  }
  return (
    <div className="grid gap-3">
      <Card icon={<RestroomIcon size={18} />} title={t.restroom} rows={restroom} />
      <Card icon={<InfoIcon size={18} />} title={t.info} rows={info} />
      <Card icon={<LockerIcon size={18} />} title={t.lockers} rows={lockers} />
      <Card icon={<BikeIcon size={18} />} title={t.bikes} rows={bikes} />
    </div>
  )
}
