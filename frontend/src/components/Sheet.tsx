import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'

export type Snap = 'peek' | 'half' | 'full'

type SheetProps = {
  desktop: boolean
  snap: Snap
  onSnapChange: (snap: Snap) => void
  /** Visible sheet height in px (mobile) so the map can pad around it. */
  onVisibleHeight: (height: number) => void
  peekHeight: number
  header: ReactNode
  children: ReactNode
  contentKey: string
}

function useViewport() {
  const read = () => ({ height: window.visualViewport?.height ?? window.innerHeight, safeBottom: readSafeBottom() })
  const [viewport, setViewport] = useState(read)
  useEffect(() => {
    const update = () => setViewport(read())
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [])
  return viewport
}

let safeBottomCache: number | null = null
function readSafeBottom() {
  if (safeBottomCache != null) return safeBottomCache
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;bottom:0;height:0;padding-bottom:env(safe-area-inset-bottom);visibility:hidden'
  document.body.appendChild(probe)
  safeBottomCache = probe.getBoundingClientRect().height
  probe.remove()
  return safeBottomCache
}

export default function Sheet({ desktop, snap, onSnapChange, onVisibleHeight, peekHeight, header, children, contentKey }: SheetProps) {
  const { height: viewportHeight, safeBottom } = useViewport()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ startY: number; startOffset: number; lastY: number; lastT: number; velocity: number; moved: boolean } | null>(null)
  const [dragOffset, setDragOffset] = useState<number | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const [headerHeight, setHeaderHeight] = useState(0)

  useLayoutEffect(() => {
    const element = headerRef.current
    if (!element) return
    const observer = new ResizeObserver(() => setHeaderHeight(element.getBoundingClientRect().height))
    observer.observe(element)
    return () => observer.disconnect()
  }, [desktop])

  const full = Math.round(viewportHeight * 0.92)
  const heights: Record<Snap, number> = {
    peek: Math.min(full, peekHeight + safeBottom),
    half: Math.round(Math.max(peekHeight + safeBottom + 120, viewportHeight * 0.52)),
    full
  }
  const offsetFor = (value: Snap) => full - heights[value]
  const offset = dragOffset ?? offsetFor(snap)

  useLayoutEffect(() => {
    if (desktop) return
    // The map only needs to clear the lower part of the screen, even when the sheet is tall.
    onVisibleHeight(Math.min(heights[snap], Math.round(viewportHeight * 0.56)))
  }, [desktop, snap, heights.peek, heights.half, heights.full, viewportHeight, onVisibleHeight])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [contentKey])

  if (desktop) {
    return (
      <aside className="pointer-events-auto absolute top-3 bottom-3 left-3 z-20 flex w-[400px] flex-col overflow-hidden rounded-[var(--radius-sheet)] bg-surface shadow-[var(--shadow-float)] ring-1 ring-hairline">
        <div className="shrink-0 px-4 pt-4">{header}</div>
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
          {children}
        </div>
      </aside>
    )
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('input, button, a, [data-no-drag]')) return
    drag.current = { startY: event.clientY, startOffset: offset, lastY: event.clientY, lastT: event.timeStamp, velocity: 0, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state) return
    const delta = event.clientY - state.startY
    if (!state.moved && Math.abs(delta) < 4) return
    state.moved = true
    const dt = Math.max(1, event.timeStamp - state.lastT)
    state.velocity = (event.clientY - state.lastY) / dt
    state.lastY = event.clientY
    state.lastT = event.timeStamp
    let next = state.startOffset + delta
    // Rubber-band past the ends.
    if (next < 0) next = next / 3
    const maxOffset = offsetFor('peek')
    if (next > maxOffset) next = maxOffset + (next - maxOffset) / 3
    setDragOffset(next)
  }

  const onPointerUp = () => {
    const state = drag.current
    drag.current = null
    if (!state) return
    if (!state.moved) {
      // A tap on the grabber cycles peek → half → full → half.
      if (snap === 'peek') onSnapChange('half')
      else if (snap === 'half') onSnapChange('full')
      else onSnapChange('half')
      return
    }
    const projected = (dragOffset ?? offset) + state.velocity * 180
    const candidates: Snap[] = ['full', 'half', 'peek']
    const target = candidates.reduce((best, item) =>
      Math.abs(offsetFor(item) - projected) < Math.abs(offsetFor(best) - projected) ? item : best
    )
    setDragOffset(null)
    onSnapChange(target)
  }

  return (
    <section
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 mx-auto flex max-w-[640px] flex-col rounded-t-[var(--radius-sheet)] bg-surface shadow-[var(--shadow-sheet)] ring-1 ring-hairline"
      style={{
        height: full,
        transform: `translate3d(0, ${offset}px, 0)`,
        transition: dragOffset == null ? 'transform 0.5s var(--ease-sheet)' : 'none',
        willChange: 'transform'
      }}
      aria-label="panel"
    >
      <div
        ref={headerRef}
        className="shrink-0 touch-none select-none px-4 pb-3"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="flex h-5 items-center justify-center">
          <span className="h-[5px] w-9 rounded-full bg-ink/15" />
        </div>
        {header}
      </div>
      <div
        ref={scrollRef}
        className="min-h-0 overflow-y-auto overscroll-contain px-4"
        style={{
          paddingBottom: `calc(env(safe-area-inset-bottom) + 24px)`,
          // Size the scroller to the resting height so everything is reachable at every snap point.
          height: Math.max(0, heights[snap] - headerHeight)
        }}
      >
        {children}
      </div>
    </section>
  )
}
