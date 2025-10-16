type SheetHandleProps = {
  expanded: boolean
  onToggle: () => void
}

export default function SheetHandle({ expanded, onToggle }: SheetHandleProps) {
  return (
    <button
      type="button"
      aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
      className="h-8 w-full flex items-center justify-center"
      onClick={onToggle}
    >
      <span className="h-1.5 w-12 rounded-full bg-gray-200" />
    </button>
  )
}
