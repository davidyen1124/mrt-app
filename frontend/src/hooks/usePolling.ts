import { useEffect, useRef, useState } from 'react'

export type Polled<T> = { data: T | null; error: boolean; receivedAt: number | null; loading: boolean }

/**
 * Fetches JSON on an interval while the tab is visible, and immediately when it becomes visible again.
 * `parse` validates the payload so components only ever see well-formed data.
 */
export function usePolling<T>(url: string | null, intervalMs: number, parse: (value: unknown) => T | null): Polled<T> {
  const [state, setState] = useState<Polled<T>>({ data: null, error: false, receivedAt: null, loading: Boolean(url) })
  const parseRef = useRef(parse)
  parseRef.current = parse

  useEffect(() => {
    setState({ data: null, error: false, receivedAt: null, loading: Boolean(url) })
    if (!url) return

    let cancelled = false
    let controller: AbortController | null = null

    const load = async (force = false) => {
      if (!force && document.visibilityState !== 'visible') return
      controller?.abort()
      controller = new AbortController()
      try {
        const response = await fetch(url, { signal: controller.signal })
        const body: unknown = await response.json()
        const parsed = response.ok ? parseRef.current(body) : null
        if (cancelled) return
        setState(current =>
          parsed
            ? { data: parsed, error: false, receivedAt: Date.now(), loading: false }
            : { ...current, error: true, loading: false }
        )
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) return
        setState(current => ({ ...current, error: true, loading: false }))
      }
    }

    // Always fetch once, even in a background tab; only the refresh ticks pause while hidden.
    load(true)
    const timer = intervalMs > 0 ? window.setInterval(() => load(), intervalMs) : undefined
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      controller?.abort()
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [url, intervalMs])

  return state
}
