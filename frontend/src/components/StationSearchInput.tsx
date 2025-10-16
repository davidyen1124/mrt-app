type StationSearchInputProps = {
  placeholder: string
  value: string
  onChange: (value: string) => void
  onClear: () => void
}

export default function StationSearchInput({
  placeholder,
  value,
  onChange,
  onClear
}: StationSearchInputProps) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <input
        className="flex-1 rounded-md border px-3 py-3 text-base leading-tight"
        placeholder={placeholder}
        value={value}
        onChange={event => onChange(event.target.value)}
      />
      {value && (
        <button
          type="button"
          className="text-sm text-gray-500"
          onClick={onClear}
        >
          清除
        </button>
      )}
    </div>
  )
}
