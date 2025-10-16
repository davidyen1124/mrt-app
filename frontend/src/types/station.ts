export type Station = {
  id: string
  codes: string[]
  name_zh?: string
  index?: number
  lat?: number
  lng?: number
  [key: string]: unknown
}
