import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    listener => {
      const media = window.matchMedia(query)
      media.addEventListener('change', listener)
      return () => media.removeEventListener('change', listener)
    },
    () => window.matchMedia(query).matches,
    () => false
  )
}

export const useIsDesktop = () => useMediaQuery('(min-width: 768px)')
export const usePrefersDark = () => useMediaQuery('(prefers-color-scheme: dark)')
