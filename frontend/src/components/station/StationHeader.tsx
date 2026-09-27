import { StationCodes } from '@/components/Badges'
import { CloseIcon, ShareIcon, StarIcon } from '@/components/Icons'
import { stationName, type Station } from '@/data/network'
import { STATION_TABS, type StationTab } from '@/hooks/useRoute'
import { useStrings } from '@/lib/i18n'
import { useState } from 'react'

type StationHeaderProps = {
  station: Station
  tab: StationTab
  favorite: boolean
  onTab: (tab: StationTab) => void
  onToggleFavorite: () => void
  onClose: () => void
}

function IconButton({ label, onClick, children, pressed }: { label: string; onClick: () => void; children: React.ReactNode; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2 ring-1 ring-hairline transition active:scale-95"
    >
      {children}
    </button>
  )
}

export default function StationHeader({ station, tab, favorite, onTab, onToggleFavorite, onClose }: StationHeaderProps) {
  const { t, lang } = useStrings()
  const [toast, setToast] = useState(false)
  const secondary = lang === 'en' ? station.name.zh : station.name.en
  const labels: Record<StationTab, string> = { live: t.arrivals, times: t.timetable, fares: t.fares, facilities: t.facilities }

  const share = async () => {
    const url = window.location.href
    const title = `${stationName(station, lang)} · ${t.appName}`
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setToast(true)
      window.setTimeout(() => setToast(false), 1600)
    } catch {
      // The share sheet was dismissed.
    }
  }

  return (
    <div className="relative pt-1">
      <div className="flex items-start gap-3">
        <div className="pt-0.5">
          <StationCodes station={station} size="md" />
        </div>
        <div className="min-w-0 flex-1">
          <h1
            className={`flex items-center gap-2 leading-[1.1] font-extrabold tracking-[0.02em] ${
              stationName(station, lang).length > (lang === 'en' ? 16 : 7) ? 'text-[21px]' : 'text-[26px]'
            }`}
          >
            <span className="line-clamp-2">{stationName(station, lang)}</span>
            {station.note ? (
              <span className="shrink-0 rounded-full bg-amber px-2 py-0.5 text-[10.5px] font-bold tracking-[0.04em] text-[#2b1a00]">
                {t.newStation}
              </span>
            ) : null}
          </h1>
          <p className="mt-0.5 line-clamp-2 text-[13.5px] font-medium tracking-[0.01em] text-ink-3">{secondary}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <IconButton label={favorite ? t.unfavorite : t.favorite} onClick={onToggleFavorite} pressed={favorite}>
            <StarIcon size={18} filled={favorite} className={favorite ? 'text-amber' : ''} />
          </IconButton>
          <IconButton label={t.share} onClick={share}>
            <ShareIcon size={17} />
          </IconButton>
          <IconButton label={t.close} onClick={onClose}>
            <CloseIcon size={17} strokeWidth={2.4} />
          </IconButton>
        </div>
      </div>

      <div role="tablist" className="mt-3.5 grid grid-cols-4 rounded-[12px] bg-surface-2 p-1 ring-1 ring-hairline" data-no-drag>
        {STATION_TABS.map(item => (
          <button
            key={item}
            role="tab"
            type="button"
            aria-selected={tab === item}
            onClick={() => onTab(item)}
            className={`h-8 rounded-[9px] text-[13.5px] font-semibold transition ${
              tab === item ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08),0_1px_0_rgb(0_0_0/0.04)] ring-1 ring-hairline' : 'text-ink-3'
            }`}
          >
            {labels[item]}
          </button>
        ))}
      </div>

      {toast ? (
        <div className="animate-rise absolute top-0 right-0 rounded-full bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-on-accent shadow-[var(--shadow-float)]">
          {t.copied}
        </div>
      ) : null}
    </div>
  )
}
