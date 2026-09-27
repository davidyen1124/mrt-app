import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

const base = ({ size = 20, ...props }: IconProps) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props
})

export const SearchIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </svg>
)

export const CloseIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

export const StarIcon = ({ filled, ...props }: IconProps & { filled?: boolean }) => (
  <svg {...base(props)} fill={filled ? 'currentColor' : 'none'}>
    <path d="m12 3.6 2.55 5.3 5.8.8-4.22 4.05 1.02 5.77L12 16.77l-5.15 2.75 1.02-5.77L3.65 9.7l5.8-.8Z" />
  </svg>
)

export const ShareIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 3.5v11M8 7.3l4-3.8 4 3.8" />
    <path d="M6.5 11H5.8A1.8 1.8 0 0 0 4 12.8v5.4A1.8 1.8 0 0 0 5.8 20h12.4a1.8 1.8 0 0 0 1.8-1.8v-5.4a1.8 1.8 0 0 0-1.8-1.8h-.7" />
  </svg>
)

export const LocateIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M20.2 3.8 3.9 10.6c-.7.3-.6 1.3.1 1.5l6.3 1.6 1.6 6.3c.2.7 1.2.8 1.5.1Z" />
  </svg>
)

export const ChevronRight = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="m9.5 6 6 6-6 6" />
  </svg>
)

export const ChevronLeft = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="m14.5 6-6 6 6 6" />
  </svg>
)

export const ArrowRight = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4.5 12h15M14 6.5l5.5 5.5-5.5 5.5" />
  </svg>
)

export const GlobeIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.4 2.4 3.4 5.2 3.4 8.5s-1 6.1-3.4 8.5c-2.4-2.4-3.4-5.2-3.4-8.5s1-6.1 3.4-8.5Z" />
  </svg>
)

export const RestroomIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="7.5" cy="5" r="1.6" />
    <circle cx="16.5" cy="5" r="1.6" />
    <path d="M6 9h3l.6 5H8.8v6.2M6.6 14H5.8l.2-5M16.5 9c-1.6 0-2.3.4-2.7 1.7L12.6 15h2.3v5.2h3.2V15h2.3l-1.2-4.3c-.4-1.3-1.1-1.7-2.7-1.7Z" />
    <path d="M12 3v18" strokeOpacity=".35" />
  </svg>
)

export const InfoIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5M12 7.6v.1" />
  </svg>
)

export const LockerIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="4.5" y="3.5" width="15" height="17" rx="2" />
    <path d="M12 3.5v17M8 9v2M16 9v2" />
  </svg>
)

export const BikeIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="6" cy="16" r="3.5" />
    <circle cx="18" cy="16" r="3.5" />
    <path d="M6 16l4-7h5.5L18 16M10 9 8.8 6.5H7M15.5 9 12 16H6" />
  </svg>
)

export const ClockIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

export const PinIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.3" />
  </svg>
)

export const WalkIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="13" cy="4.5" r="1.7" />
    <path d="m10 20.5 2-6 2.5 2.5V21M8 12.5l1.7-4.2c.3-.8 1.2-1.1 1.9-.8l2.4 1.1 1.5 3M12 14.5l1-5" />
  </svg>
)

export const GithubIcon = (props: IconProps) => (
  <svg {...base(props)} fill="currentColor" stroke="none">
    <path d="M12 2.5a9.5 9.5 0 0 0-3 18.5c.5.1.7-.2.7-.5v-1.7c-2.7.6-3.3-1.2-3.3-1.2-.4-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.1-.2-4.4-1.1-4.4-4.8 0-1 .4-1.9 1-2.6-.1-.2-.4-1.2.1-2.6 0 0 .8-.3 2.6 1a9 9 0 0 1 4.8 0c1.8-1.3 2.6-1 2.6-1 .5 1.4.2 2.4.1 2.6.6.7 1 1.6 1 2.6 0 3.7-2.3 4.6-4.4 4.8.3.3.7.9.7 1.8v2.7c0 .3.2.6.7.5A9.5 9.5 0 0 0 12 2.5Z" />
  </svg>
)
