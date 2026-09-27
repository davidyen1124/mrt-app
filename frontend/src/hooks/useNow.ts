import { useSyncExternalStore } from 'react'

type Listener = () => void

let snapshot = Date.now()
const listeners = new Set<Listener>()
let intervalId: number | undefined
let unsubscribeVisibility: (() => void) | undefined

const notifyListeners = () => {
  snapshot = Date.now()
  listeners.forEach(listener => listener())
}

const start = () => {
  if (typeof window === 'undefined' || intervalId != null) return

  const tick = () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return
    }
    notifyListeners()
  }

  intervalId = window.setInterval(tick, 1000)

  if (typeof document !== 'undefined') {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        notifyListeners()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    unsubscribeVisibility = () => document.removeEventListener('visibilitychange', handleVisibility)
  }
}

const stop = () => {
  if (typeof window !== 'undefined' && intervalId != null) {
    window.clearInterval(intervalId)
    intervalId = undefined
  }

  if (unsubscribeVisibility) {
    unsubscribeVisibility()
    unsubscribeVisibility = undefined
  }
}

const subscribe = (listener: Listener) => {
  listeners.add(listener)
  if (listeners.size === 1) {
    start()
  }

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      stop()
    }
  }
}

const getSnapshot = () => snapshot
const getServerSnapshot = () => Date.now()

export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
