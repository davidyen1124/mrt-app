import type { Station } from '@/types/station'

export type Line = {
  line_index?: number
  line_code?: string
  stations: Station[]
}
