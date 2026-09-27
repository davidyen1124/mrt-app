import { StationCodes } from '@/components/Badges'
import { ChevronRight } from '@/components/Icons'
import { stationName, type Station } from '@/data/network'
import { useStrings } from '@/lib/i18n'
import type { ReactNode } from 'react'

type StationRowProps = {
  station: Station
  onSelect: (station: Station) => void
  trailing?: ReactNode
  meta?: ReactNode
}

export default function StationRow({ station, onSelect, trailing, meta }: StationRowProps) {
  const { lang } = useStrings()
  const secondary = lang === 'en' ? station.name.zh : station.name.en
  return (
    <button
      type="button"
      onClick={() => onSelect(station)}
      className="group flex min-h-[60px] w-full items-center gap-3 rounded-[14px] px-2 py-2 text-left transition hover:bg-surface-2 active:bg-surface-3"
    >
      <StationCodes station={station} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[16px] font-semibold tracking-[0.01em]">{stationName(station, lang)}</span>
        <span className="truncate text-[12.5px] text-ink-3">{meta ?? secondary}</span>
      </span>
      {trailing}
      <ChevronRight size={16} className="shrink-0 text-ink-3 transition group-hover:translate-x-0.5" />
    </button>
  )
}
