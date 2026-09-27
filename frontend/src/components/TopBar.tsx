import { GlobeIcon, LocateIcon } from '@/components/Icons'
import Logo from '@/components/Logo'
import { useNow } from '@/hooks/useNow'
import { useStrings } from '@/lib/i18n'

type TopBarProps = {
  desktop: boolean
  locating: boolean
  onLocate: () => void
  onToggleLang: () => void
  onHome: () => void
}

const clock = (now: number) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Taipei' }).format(now)

function RoundButton({ label, onClick, children, active }: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`glass grid h-11 w-11 place-items-center rounded-full text-ink shadow-[var(--shadow-float)] ring-1 ring-hairline transition active:scale-95 ${active ? 'text-[#2f7cf6]' : ''}`}
    >
      {children}
    </button>
  )
}

export default function TopBar({ desktop, locating, onLocate, onToggleLang, onHome }: TopBarProps) {
  const { t, lang } = useStrings()
  const now = useNow()

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 px-3 ${desktop ? 'pl-[424px]' : ''}`}
      style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
    >
      <button
        type="button"
        onClick={onHome}
        className={`pointer-events-auto flex items-stretch overflow-hidden rounded-[14px] bg-surface text-left shadow-[var(--shadow-plate),var(--shadow-float)] ring-1 ring-hairline transition active:translate-y-px`}
        aria-label={t.appName}
      >
        <span className="flex items-center gap-2 py-1.5 pr-3 pl-1.5">
          <Logo className="h-8 w-8" />
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-extrabold tracking-[0.06em] whitespace-nowrap">北捷即時</span>
            <span className="mt-[3px] text-[8.5px] font-semibold tracking-[0.18em] whitespace-nowrap text-ink-3 uppercase">
              Taipei Metro Live
            </span>
          </span>
        </span>
        <span className="flex flex-col items-center justify-center border-l border-hairline bg-surface-2 px-3">
          <span className="tabular text-[17px] leading-none font-bold tracking-[-0.01em]">{clock(now)}</span>
          <span className="mt-1 flex items-center gap-1 text-[9px] font-bold tracking-[0.12em] text-live uppercase">
            <span className="animate-live h-1.5 w-1.5 rounded-full bg-live" />
            {t.live}
          </span>
        </span>
      </button>

      <div className="pointer-events-auto flex gap-2">
        <RoundButton label={t.language} onClick={onToggleLang}>
          <span className="flex items-center gap-1 text-[12px] font-bold">
            <GlobeIcon size={15} />
            {lang === 'zh' ? 'EN' : '中'}
          </span>
        </RoundButton>
        <RoundButton label={t.locate} onClick={onLocate} active={locating}>
          <LocateIcon size={19} />
        </RoundButton>
      </div>
    </div>
  )
}
