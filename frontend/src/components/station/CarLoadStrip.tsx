import type { CarLoad } from '@/hooks/useLiveData'
import { useStrings } from '@/lib/i18n'

// Taipei Metro reports four crowding levels per car.
const LEVEL_COLORS = ['#30d158', '#ffd60a', '#ff9f0a', '#ff453a']

export default function CarLoadStrip({ load }: { load: CarLoad }) {
  const { t, lang } = useStrings()
  const levelIndex = (level: number) => Math.min(3, Math.max(0, level - 1))
  const best = load.bestCars.join(lang === 'zh' ? '、' : ', ')
  // When every car reports the same level there is nothing to recommend.
  const even = load.carLoads.every(level => level === load.carLoads[0])
  const label = even ? t.carLoadEven(t.carLoadLevels[levelIndex(load.carLoads[0])]) : t.carLoadBest(best)
  return (
    <div className="mt-2 flex items-center gap-3" aria-label={t.carLoad}>
      <div className="flex items-end gap-[3px]">
        {load.carLoads.map((level, index) => {
          const isBest = !even && load.bestCars.includes(index + 1)
          return (
            <span key={index} className="flex flex-col items-center gap-[3px]">
              <span
                className={`block h-3 w-[18px] rounded-[3px] ${isBest ? 'ring-2 ring-board-ink/90 ring-offset-1 ring-offset-board' : ''}`}
                style={{ background: level > 0 ? LEVEL_COLORS[levelIndex(level)] : 'rgb(255 255 255 / 0.15)' }}
                title={`${index + 1}: ${level > 0 ? t.carLoadLevels[levelIndex(level)] : '—'}`}
              />
              <span className="tabular text-[9px] leading-none text-board-dim">{index + 1}</span>
            </span>
          )
        })}
      </div>
      <span className="text-[11.5px] leading-tight font-semibold text-board-ink/85">{label}</span>
    </div>
  )
}
