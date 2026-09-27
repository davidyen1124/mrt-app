import type { Lang } from '@/data/network'
import { createContext, useContext } from 'react'

const zh = {
  appName: '北捷即時',
  appTagline: 'Taipei Metro Live',
  searchPlaceholder: '搜尋車站、站號或英文站名',
  searchNoResults: '找不到符合的車站',
  searchHint: '試試「忠孝新生」、「BL12」或 “Daan”',
  live: '即時',
  cancel: '取消',
  close: '關閉',
  nearby: '附近車站',
  nearbyCta: '顯示離我最近的車站',
  nearbyLocating: '定位中…',
  nearbyDenied: '無法取得位置，請確認定位權限',
  walk: (minutes: number) => `步行 ${minutes} 分`,
  favorites: '收藏車站',
  favoritesEmpty: '在車站頁點 ☆ 就能把常用車站放在這裡',
  lines: '路線',
  stationsCount: (count: number) => `${count} 站`,
  branch: '支線',
  towards: '往',
  arrivals: '即時',
  timetable: '首末班',
  fares: '票價',
  facilities: '設施',
  updatedAgo: (seconds: number) => (seconds < 5 ? '剛剛更新' : `${seconds} 秒前更新`),
  arriving: '進站中',
  noService: '今日營運已結束',
  noServiceHint: (time: string) => `首班車 ${time}`,
  noLiveData: '暫無即時資訊',
  loading: '載入中…',
  minutesUnit: '分',
  secondsUnit: '秒',
  nextTrains: '後續班次',
  carLoad: '車廂擁擠度',
  carLoadBest: (cars: string) => `建議搭乘第 ${cars} 節`,
  carLoadLevels: ['舒適', '普通', '稍擠', '擁擠'],
  carLoadEven: (level: string) => `各節車廂皆${level}`,
  firstTrain: '首班',
  lastTrain: '末班',
  lastTrainIn: (minutes: number) => `末班車 ${minutes} 分後`,
  weekday: '平日時刻',
  faresFilter: '篩選目的地',
  fareFull: '全票',
  fareConcession: '優待',
  travelTime: (minutes: number) => `約 ${minutes} 分`,
  faresUnavailable: '這一站的票價資料尚未更新',
  restroom: '廁所',
  info: '詢問處',
  lockers: '置物櫃',
  bikes: '攜帶自行車',
  facilitiesEmpty: '沒有設施資料',
  favorite: '收藏',
  unfavorite: '取消收藏',
  share: '分享',
  copied: '已複製連結',
  locate: '我的位置',
  language: 'English',
  newStation: '新站',
  sources: '資料來源：Bus+（即時到站、站點資料）· 臺北捷運公司（車廂擁擠度）· © OpenStreetMap 貢獻者（路線幾何）· OpenFreeMap © OpenMapTiles（底圖）',
  disclaimer: '非官方應用程式。到站時間僅供參考，請以現場廣播與官方公告為準。',
  dataUpdated: (date: string) => `站點資料更新於 ${date}`,
  mapCredit: '地圖',
  transfer: '轉乘',
  prevNext: '前後站',
  viewLine: '查看路線',
  sourceNote: 'Bus+ 即時資料 · 每 15 秒更新'
}

type Strings = typeof zh

const en: Strings = {
  appName: 'Taipei Metro Live',
  appTagline: '北捷即時',
  searchPlaceholder: 'Search stations or codes',
  searchNoResults: 'No matching stations',
  searchHint: 'Try “Daan”, “BL12” or 「忠孝新生」',
  live: 'Live',
  cancel: 'Cancel',
  close: 'Close',
  nearby: 'Nearby',
  nearbyCta: 'Show stations near me',
  nearbyLocating: 'Locating…',
  nearbyDenied: 'Location unavailable — check permissions',
  walk: minutes => `${minutes} min walk`,
  favorites: 'Favourites',
  favoritesEmpty: 'Tap ☆ on a station to pin it here',
  lines: 'Lines',
  stationsCount: count => `${count} stations`,
  branch: 'Branch',
  towards: 'To',
  arrivals: 'Live',
  timetable: 'First/Last',
  fares: 'Fares',
  facilities: 'Facilities',
  updatedAgo: seconds => (seconds < 5 ? 'Updated just now' : `Updated ${seconds}s ago`),
  arriving: 'Arriving',
  noService: 'Service has ended for today',
  noServiceHint: time => `First train ${time}`,
  noLiveData: 'No live data right now',
  loading: 'Loading…',
  minutesUnit: 'min',
  secondsUnit: 's',
  nextTrains: 'Then',
  carLoad: 'Car crowding',
  carLoadBest: cars => `Board car ${cars}`,
  carLoadLevels: ['Roomy', 'Normal', 'Busy', 'Packed'],
  carLoadEven: level => `All cars ${level.toLowerCase()}`,
  firstTrain: 'First',
  lastTrain: 'Last',
  lastTrainIn: minutes => `Last train in ${minutes} min`,
  weekday: 'Weekday times',
  faresFilter: 'Filter destinations',
  fareFull: 'Adult',
  fareConcession: 'Concession',
  travelTime: minutes => `${minutes} min`,
  faresUnavailable: 'Fares for this station are not available yet',
  restroom: 'Restrooms',
  info: 'Information',
  lockers: 'Lockers',
  bikes: 'Bicycles',
  facilitiesEmpty: 'No facility data',
  favorite: 'Save',
  unfavorite: 'Saved',
  share: 'Share',
  copied: 'Link copied',
  locate: 'My location',
  language: '中文',
  newStation: 'New',
  sources: 'Sources: Bus+ (arrivals, stations) · Taipei Metro (car crowding) · © OpenStreetMap contributors (track geometry) · OpenFreeMap © OpenMapTiles (basemap)',
  disclaimer: 'Unofficial app. Arrival times are estimates — follow station announcements.',
  dataUpdated: date => `Station data updated ${date}`,
  mapCredit: 'Map',
  transfer: 'Transfer',
  prevNext: 'Adjacent',
  viewLine: 'View line',
  sourceNote: 'Live data from Bus+ · refreshes every 15s'
}

export const strings: Record<Lang, Strings> = { zh, en }

export const LangContext = createContext<Lang>('zh')

export function useStrings() {
  const lang = useContext(LangContext)
  return { lang, t: strings[lang] }
}

export function loadLang(): Lang {
  try {
    const stored = localStorage.getItem('mrt:lang')
    if (stored === 'zh' || stored === 'en') return stored
  } catch {
    // Storage can be unavailable (private mode); fall back to the browser language.
  }
  return typeof navigator !== 'undefined' && !navigator.language.toLowerCase().startsWith('zh') ? 'en' : 'zh'
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem('mrt:lang', lang)
  } catch {
    // Non-critical preference.
  }
}
