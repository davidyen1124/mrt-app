import type { Station } from './station'

export type Line = {
  line_index?: number
  line_code?: string
  stations: Station[]
}
