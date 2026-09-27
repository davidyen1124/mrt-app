import { useCallback, useEffect, useRef, useState } from 'react'

export type GeoState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'denied' }
  | { status: 'ready'; lat: number; lng: number; accuracy: number }

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ status: 'idle' })
  const watchRef = useRef<number | null>(null)

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState({ status: 'denied' })
      return
    }
    if (watchRef.current != null) return
    setState(current => (current.status === 'ready' ? current : { status: 'locating' }))
    watchRef.current = navigator.geolocation.watchPosition(
      position =>
        setState({
          status: 'ready',
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        }),
      () => {
        if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
        watchRef.current = null
        setState({ status: 'denied' })
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    )
  }, [])

  useEffect(
    () => () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
    },
    []
  )

  // Resume silently when permission was granted on an earlier visit.
  useEffect(() => {
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then(result => {
        if (result.state === 'granted') start()
      })
      .catch(() => {})
  }, [start])

  return { geo: state, locate: start }
}
