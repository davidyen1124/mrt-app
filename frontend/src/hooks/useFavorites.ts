import { useCallback, useEffect, useState } from 'react'

const KEY = 'mrt:favorites'

const read = (): string[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(read)

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY) setFavorites(read())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toggle = useCallback((id: string) => {
    setFavorites(current => {
      const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id]
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        // Favourites still work for this session without storage.
      }
      return next
    })
  }, [])

  return { favorites, toggle, isFavorite: (id: string) => favorites.includes(id) }
}
