import { isTerminus, lineForCode, type Line, type Station } from '@/data/network'

type Size = 'sm' | 'md' | 'lg'

const SIZES: Record<Size, { box: string; letters: string; digits: string }> = {
  sm: { box: 'h-[24px] min-w-[21px] rounded-[5px] border-[1.5px] px-[2px]', letters: 'text-[8px]', digits: 'text-[10.5px]' },
  md: { box: 'h-[32px] min-w-[28px] rounded-[6px] border-[2px] px-[3px]', letters: 'text-[9.5px]', digits: 'text-[13.5px]' },
  lg: { box: 'h-[44px] min-w-[38px] rounded-[8px] border-[2.5px] px-[4px]', letters: 'text-[12px]', digits: 'text-[18px]' }
}

/**
 * Station number plate as on Taipei Metro signage: line letters stacked over the number, white with a
 * line-colour border. Terminus codes are filled, which is also how the official apps mark trains that run
 * the full length of the line.
 */
export function StationCode({ code, size = 'md', filled }: { code: string; size?: Size; filled?: boolean }) {
  const line = lineForCode(code)
  const color = line?.color ?? '#8a909a'
  const solid = filled ?? isTerminus(code)
  const [, letters = code, digits = ''] = code.match(/^([A-Z]+)(.*)$/) ?? []
  const s = SIZES[size]
  return (
    <span
      className={`inline-flex shrink-0 flex-col items-center justify-center font-bold leading-[0.95] ${s.box}`}
      style={{
        borderColor: color,
        background: solid ? color : '#ffffff',
        color: solid ? line?.onColor ?? '#fff' : '#16181b'
      }}
      role="img"
      aria-label={code}
      title={code}
    >
      <span className={`${s.letters} tracking-[0.02em]`}>{letters}</span>
      <span className={`${s.digits} tabular tracking-[-0.03em]`}>{digits}</span>
    </span>
  )
}

export function StationCodes({ station, size = 'md' }: { station: Station; size?: Size }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-[3px]">
      {station.codes.map(code => (
        <StationCode key={code} code={code} size={size} />
      ))}
    </span>
  )
}

/** Solid line chip, e.g. [BL]. Branches carry their parent code with a small "A". */
export function LineMark({ line, size = 'md' }: { line: Line; size?: 'sm' | 'md' | 'lg' }) {
  const box =
    size === 'lg'
      ? 'h-11 min-w-11 rounded-[12px] text-[17px]'
      : size === 'sm'
        ? 'h-[18px] min-w-[18px] rounded-[5px] text-[10px]'
        : 'h-7 min-w-7 rounded-[8px] text-[12px]'
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center px-1 font-extrabold tracking-[0.01em] ${box}`}
      style={{ background: line.color, color: line.onColor }}
    >
      {line.code}
      {line.branchOf ? <span className="text-[0.72em] font-bold">A</span> : null}
    </span>
  )
}

export function LineDot({ color, className = 'h-2.5 w-2.5' }: { color: string; className?: string }) {
  return <span className={`inline-block shrink-0 rounded-full ${className}`} style={{ background: color }} />
}
