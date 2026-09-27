/** Minutes since midnight in Taipei, with the service day rolling over at 04:00 (00:30 counts as 24:30). */
export function serviceMinutesNow(now: number) {
  const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Taipei' })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, part) => ({ ...acc, [part.type]: part.value }), {})
  const minutes = Number(parts.hour) * 60 + Number(parts.minute)
  return minutes < 240 ? minutes + 1440 : minutes
}

export function serviceMinutes(clock: string) {
  const [hours, minutes] = clock.split(':').map(Number)
  const value = hours * 60 + minutes
  return value < 240 ? value + 1440 : value
}

export type Countdown =
  | { kind: 'arriving' }
  | { kind: 'imminent'; text: string }
  | { kind: 'clock'; text: string }
  | { kind: 'minutes'; minutes: number }

export function countdown(arriveAt: number, now: number): Countdown {
  const seconds = Math.round((arriveAt - now) / 1000)
  if (seconds <= 0) return { kind: 'arriving' }
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  if (seconds < 60) return { kind: 'imminent', text: clock }
  if (seconds < 600) return { kind: 'clock', text: clock }
  return { kind: 'minutes', minutes: Math.floor(seconds / 60) }
}
