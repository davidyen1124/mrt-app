import { CloseIcon, SearchIcon } from '@/components/Icons'
import { useStrings } from '@/lib/i18n'
import { forwardRef } from 'react'

type SearchFieldProps = {
  value: string
  active: boolean
  onChange: (value: string) => void
  onFocus: () => void
  onCancel: () => void
  onSubmit: () => void
}

const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, active, onChange, onFocus, onCancel, onSubmit },
  ref
) {
  const { t } = useStrings()
  return (
    <div className="flex items-center gap-2">
      <label className="relative flex h-12 min-w-0 flex-1 items-center rounded-[14px] bg-surface-2 ring-1 ring-hairline transition focus-within:bg-surface focus-within:ring-2 focus-within:ring-ink/80">
        <SearchIcon size={19} className="pointer-events-none absolute left-3.5 text-ink-3" />
        <input
          ref={ref}
          value={value}
          onChange={event => onChange(event.target.value)}
          onFocus={onFocus}
          onKeyDown={event => {
            if (event.key === 'Enter') onSubmit()
            if (event.key === 'Escape') onCancel()
          }}
          placeholder={t.searchPlaceholder}
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="h-full w-full min-w-0 bg-transparent pr-10 pl-11 text-[16px] font-medium outline-none placeholder:font-normal placeholder:text-ink-3"
          aria-label={t.searchPlaceholder}
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-2 grid h-7 w-7 place-items-center rounded-full bg-ink/10 text-ink-2"
            aria-label={t.close}
          >
            <CloseIcon size={14} strokeWidth={2.6} />
          </button>
        ) : null}
      </label>
      {active ? (
        <button type="button" onClick={onCancel} className="animate-rise shrink-0 px-1 text-[15px] font-semibold text-ink">
          {t.cancel}
        </button>
      ) : null}
    </div>
  )
})

export default SearchField
