import HomePanel, { LineChips } from '@/components/HomePanel'
import LinePanel, { LineHeader } from '@/components/LinePanel'
import MapView, { type MapInsets } from '@/components/MapView'
import SearchField from '@/components/SearchField'
import SearchResults from '@/components/SearchResults'
import Sheet, { type Snap } from '@/components/Sheet'
import StationHeader from '@/components/station/StationHeader'
import StationPanel from '@/components/station/StationPanel'
import TopBar from '@/components/TopBar'
import { searchStations, type Lang, type Line, type Station } from '@/data/network'
import { useFavorites } from '@/hooks/useFavorites'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useFares } from '@/hooks/useLiveData'
import { useIsDesktop, usePrefersDark } from '@/hooks/useMediaQuery'
import { linePath, stationPath, useRoute, type StationTab } from '@/hooks/useRoute'
import { LangContext, loadLang, saveLang, strings } from '@/lib/i18n'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const PEEK_HEIGHT = 148

export default function App() {
  const [lang, setLang] = useState<Lang>(loadLang)
  const desktop = useIsDesktop()
  const dark = usePrefersDark()
  const { route, navigate, back } = useRoute()
  const { favorites, toggle, isFavorite } = useFavorites()
  const { geo, locate } = useGeolocation()

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [snap, setSnap] = useState<Snap>(route.name === 'home' ? 'peek' : 'half')
  const [sheetHeight, setSheetHeight] = useState(PEEK_HEIGHT)
  const [followUser, setFollowUser] = useState(0)
  const searchRef = useRef<HTMLInputElement | null>(null)

  const station = route.name === 'station' ? route.station : null
  const tab: StationTab = route.name === 'station' ? route.tab : 'live'
  const line = route.name === 'line' ? route.line : null
  const fares = useFares(station && tab === 'fares' ? station : null)

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en'
    const t = strings[lang]
    document.title = station
      ? `${lang === 'en' ? station.name.en : station.name.zh} · ${t.appName}`
      : line
        ? `${lang === 'en' ? line.name.en : line.name.zh} · ${t.appName}`
        : `${t.appName} · ${t.appTagline}`
  }, [lang, station, line])

  const results = useMemo(() => searchStations(query), [query])

  const selectStation = useCallback(
    (next: Station) => {
      setSearching(false)
      setQuery('')
      searchRef.current?.blur()
      navigate(stationPath(next, route.name === 'station' ? route.tab : 'live'), { replace: route.name === 'station' })
      setSnap(current => (current === 'full' && route.name === 'station' ? 'full' : 'half'))
    },
    [navigate, route]
  )

  const selectLine = useCallback(
    (next: Line) => {
      setSearching(false)
      setQuery('')
      navigate(linePath(next), { replace: route.name === 'line' })
      setSnap('half')
    },
    [navigate, route.name]
  )

  const goHome = useCallback(() => {
    navigate('/')
    setSnap('peek')
  }, [navigate])

  const closeDetail = useCallback(() => {
    back('/')
    setSnap('peek')
  }, [back])

  const cancelSearch = useCallback(() => {
    setSearching(false)
    setQuery('')
    searchRef.current?.blur()
    setSnap('peek')
  }, [])

  const handleLocate = useCallback(() => {
    locate()
    setFollowUser(value => value + 1)
    if (route.name === 'home') setSnap('half')
  }, [locate, route.name])

  const toggleLang = useCallback(() => {
    setLang(current => {
      const next = current === 'zh' ? 'en' : 'zh'
      saveLang(next)
      return next
    })
  }, [])

  const travelMinutes = useMemo(() => {
    if (!station || tab !== 'fares' || !fares.data) return null
    return new Map(fares.data.map(item => [item.to, item.minutes]))
  }, [station, tab, fares.data])

  const insets: MapInsets = useMemo(
    () =>
      desktop
        ? { top: 16, bottom: 16, left: 412, right: 16 }
        : { top: 76, bottom: Math.max(sheetHeight, PEEK_HEIGHT), left: 0, right: 0 },
    [desktop, sheetHeight]
  )

  const onBackgroundClick = useCallback(() => {
    if (desktop) return
    searchRef.current?.blur()
    setSearching(false)
    setSnap('peek')
  }, [desktop])

  let header: React.ReactNode
  let content: React.ReactNode
  if (station) {
    header = (
      <StationHeader
        station={station}
        tab={tab}
        favorite={isFavorite(station.id)}
        onTab={next => {
          navigate(stationPath(station, next), { replace: true })
          if (snap === 'peek') setSnap('half')
        }}
        onToggleFavorite={() => toggle(station.id)}
        onClose={closeDetail}
      />
    )
    content = <StationPanel station={station} tab={tab} fares={fares} onSelectStation={selectStation} />
  } else if (line) {
    header = <LineHeader line={line} onBack={closeDetail} onClose={goHome} />
    content = <LinePanel line={line} onSelectStation={selectStation} onSelectLine={selectLine} />
  } else {
    header = (
      <div className="pt-1">
        <SearchField
          ref={searchRef}
          value={query}
          active={searching}
          onChange={value => {
            setQuery(value)
            setSearching(true)
          }}
          onFocus={() => {
            setSearching(true)
            setSnap('full')
          }}
          onCancel={cancelSearch}
          onSubmit={() => {
            if (results[0]) selectStation(results[0])
          }}
        />
        {!searching ? <LineChips onSelectLine={selectLine} /> : null}
      </div>
    )
    content = searching ? (
      <SearchResults results={results} query={query} onSelect={selectStation} />
    ) : (
      <HomePanel geo={geo} favorites={favorites} onLocate={handleLocate} onSelectStation={selectStation} onSelectLine={selectLine} />
    )
  }

  const contentKey = station ? `station-${station.id}-${tab}` : line ? `line-${line.id}` : searching ? 'search' : 'home'

  return (
    <LangContext.Provider value={lang}>
      <div className="relative h-full w-full overflow-hidden bg-canvas">
        <MapView
          dark={dark}
          lang={lang}
          selected={station}
          focusLine={line}
          travelMinutes={travelMinutes}
          user={geo.status === 'ready' ? geo : null}
          followUser={followUser}
          insets={insets}
          onStationClick={selectStation}
          onBackgroundClick={onBackgroundClick}
        />
        <TopBar desktop={desktop} locating={geo.status === 'ready'} onLocate={handleLocate} onToggleLang={toggleLang} onHome={goHome} />
        <Sheet
          desktop={desktop}
          snap={snap}
          onSnapChange={setSnap}
          onVisibleHeight={setSheetHeight}
          peekHeight={PEEK_HEIGHT}
          header={header}
          contentKey={contentKey}
        >
          {content}
        </Sheet>
      </div>
    </LangContext.Provider>
  )
}
