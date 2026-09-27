import AdjacentPlates from '@/components/station/AdjacentPlates'
import ArrivalsBoard from '@/components/station/ArrivalsBoard'
import FacilitiesTab from '@/components/station/FacilitiesTab'
import FaresTab from '@/components/station/FaresTab'
import TimetableTab from '@/components/station/TimetableTab'
import type { Station } from '@/data/network'
import { useArrivals, useCarLoads, type Fare } from '@/hooks/useLiveData'
import type { Polled } from '@/hooks/usePolling'
import type { StationTab } from '@/hooks/useRoute'

type StationPanelProps = {
  station: Station
  tab: StationTab
  fares: Polled<Fare[]>
  onSelectStation: (station: Station) => void
}

export default function StationPanel({ station, tab, fares, onSelectStation }: StationPanelProps) {
  const arrivals = useArrivals(station)
  const carLoads = useCarLoads(station)

  return (
    <div className="pt-1 pb-4">
      {tab === 'live' ? (
        <div className="space-y-4">
          <ArrivalsBoard station={station} arrivals={arrivals} carLoads={carLoads.data ?? []} />
          <AdjacentPlates station={station} onSelect={onSelectStation} />
        </div>
      ) : null}
      {tab === 'times' ? <TimetableTab station={station} /> : null}
      {tab === 'fares' ? <FaresTab fares={fares} onSelect={onSelectStation} /> : null}
      {tab === 'facilities' ? <FacilitiesTab station={station} /> : null}
    </div>
  )
}
