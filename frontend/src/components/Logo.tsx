/**
 * App mark: two lines crossing at a transfer node, drawn like a station on the network map.
 * Kept in sync with public/icon.svg.
 */
export default function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="#111418" />
      <path d="M-4 44 C 14 44, 20 32, 32 32 S 50 20, 68 20" stroke="#0070BD" strokeWidth="8" fill="none" strokeLinecap="round" />
      <path d="M22 -4 C 22 14, 32 20, 32 32 S 42 50, 42 68" stroke="#E3002C" strokeWidth="8" fill="none" strokeLinecap="round" />
      <circle cx="32" cy="32" r="9.5" fill="#fff" stroke="#111418" strokeWidth="4" />
    </svg>
  )
}
