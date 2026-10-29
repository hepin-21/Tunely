import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

const base = ({ size = 22, ...rest }: P) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...rest,
})

export const HomeIcon = (p: P) => (
  <svg {...base(p)}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>
)
export const SearchIcon = (p: P) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
)
export const LibraryIcon = (p: P) => (
  <svg {...base(p)}><path d="M4 4v16M9 4v16M14 4l6 16" /></svg>
)
export const CompassIcon = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></svg>
)
export const PlayIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none"><path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l12-7.2a1 1 0 0 0 0-1.72l-12-7.2A1 1 0 0 0 7 4.8z" /></svg>
)
export const PauseIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none"><rect x="6" y="4" width="4.5" height="16" rx="1.2" /><rect x="13.5" y="4" width="4.5" height="16" rx="1.2" /></svg>
)
export const NextIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none"><path d="M5 5.5v13a1 1 0 0 0 1.55.83L16 13v5a1 1 0 0 0 2 0V6a1 1 0 0 0-2 0v5L6.55 4.67A1 1 0 0 0 5 5.5z" /></svg>
)
export const PrevIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none"><path d="M19 5.5v13a1 1 0 0 1-1.55.83L8 13v5a1 1 0 0 1-2 0V6a1 1 0 0 1 2 0v5l9.45-6.33A1 1 0 0 1 19 5.5z" /></svg>
)
export const ShuffleIcon = (p: P) => (
  <svg {...base(p)}><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>
)
export const RepeatIcon = (p: P) => (
  <svg {...base(p)}><path d="m17 2 4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></svg>
)
export const RepeatOneIcon = (p: P) => (
  <svg {...base(p)}><path d="m17 2 4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /><path d="M11 10h1v4" /></svg>
)
export const HeartIcon = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base(p)} fill={filled ? 'currentColor' : 'none'}><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7.1 4.5c2 0 3.6 1.1 4.9 2.8 1.3-1.7 2.9-2.8 4.9-2.8 3.5 0 5.7 3.4 4.4 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" /></svg>
)
export const MoreIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
)
export const VolumeIcon = ({ level = 1, ...p }: P & { level?: number }) => (
  <svg {...base(p)}>
    <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
    {level === 0 ? <path d="m22 9-6 6M16 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7" />}
    {level > 0.5 && <path d="M18.5 5.5a9 9 0 0 1 0 13" />}
  </svg>
)
export const QueueIcon = (p: P) => (
  <svg {...base(p)}><path d="M3 6h13M3 12h13M3 18h8" /><path d="M17 15v6l4-3z" fill="currentColor" /></svg>
)
export const ChevronDownIcon = (p: P) => (
  <svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>
)
export const ChevronLeftIcon = (p: P) => (
  <svg {...base(p)}><path d="m15 6-6 6 6 6" /></svg>
)
export const PlusIcon = (p: P) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
)
export const CloseIcon = (p: P) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>
)
export const TrashIcon = (p: P) => (
  <svg {...base(p)}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
)
export const MusicIcon = (p: P) => (
  <svg {...base(p)}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
)
export const SparkleIcon = (p: P) => (
  <svg {...base(p)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></svg>
)
export const ClockIcon = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
)
export const InfinityIcon = (p: P) => (
  <svg {...base(p)}><path d="M18.2 8.4a5 5 0 1 1 0 7.2L12 12 5.8 8.4a5 5 0 1 0 0 7.2L12 12z" /></svg>
)
export const UserIcon = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
)
export const VerifiedIcon = (p: P) => (
  <svg {...base(p)} stroke="none" fill="currentColor"><path d="M12 2 14.4 4.1l3.1-.3.9 3 2.8 1.4-.9 3 .9 3-2.8 1.4-.9 3-3.1-.3L12 22l-2.4-2.1-3.1.3-.9-3L2.8 15.8l.9-3-.9-3 2.8-1.4.9-3 3.1.3z" /><path d="m8.5 12 2.3 2.3 4.7-4.6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
export const DownloadIcon = (p: P) => (
  <svg {...base(p)}><path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16" /></svg>
)
