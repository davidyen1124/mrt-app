import { useEffect, useState } from 'react'

export function useViewportHeight(defaultHeight = 720) {
  const [height, setHeight] = useState(() =>
    typeof window === 'undefined' ? defaultHeight : window.innerHeight
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setHeight(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return height
}

export default useViewportHeight
