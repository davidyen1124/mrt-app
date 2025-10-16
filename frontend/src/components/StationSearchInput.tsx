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
    <div className="pt-1">
      <div className="relative">
        <input
          className="w-full rounded-md border px-3 py-3 pr-12 text-base leading-tight"
          placeholder={placeholder}
          value={value}
          onChange={event => onChange(event.target.value)}
        />
        {value && (
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 transition hover:text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
            aria-label="Clear search"
            title="Clear search"
            onClick={onClear}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M6 18L18 6M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
