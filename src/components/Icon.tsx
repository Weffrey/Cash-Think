import type { ReactNode } from "react";

const PATHS = {
  practice: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </>
  ),
  star: <path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />,
  stats: <path d="M4 20V11M10 20V4M16 20v-7M22 20H2" />,
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  chat: <path d="M20 14.5a2 2 0 0 1-2 2H9l-4.5 3.5V6.500a2 2 0 0 1 2-2H18a2 2 0 0 1 2 2z" />,
  up: <path d="M12 19V5M5.500 11.500L12 5l6.500 6.500" />,
  book: <path d="M5 4.500h10.500a2.500 2.500 0 0 1 2.500 2.500v12.500H7.500A2.500 2.500 0 0 1 5 17zM5 17a2.500 2.500 0 0 1 2.500-2.500H18M9 8.500h5" />,
  bulb: <path d="M9.500 18h5M10.500 21h3M12 3a6 6 0 0 0-3.500 10.900c.6.5 1 1.300 1 2.100h5c0-.800.4-1.600 1-2.100A6 6 0 0 0 12 3z" />,
  eye: (
    <>
      <path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z" />
      <circle cx="12" cy="12" r="2.700" />
    </>
  ),
  check: <path d="M5 12.500l4.500 4.500L19 7.500" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  arrowRight: <path d="M5 12h14M12.500 5.500L19 12l-6.500 6.500" />,
  arrowLeft: <path d="M19 12H5M11.500 5.500L5 12l6.500 6.500" />,
  send: <path d="M4 12l16-7.500-5.500 16-3-6.500z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.500v2M12 19.500v2M2.500 12h2M19.500 12h2M5.300 5.300l1.400 1.400M17.300 17.300l1.400 1.400M5.300 18.700l1.400-1.400M17.300 6.700l1.400-1.400" />
    </>
  ),
  moon: <path d="M20 14.500A8 8 0 0 1 9.500 4a8 8 0 1 0 10.500 10.500z" />,
  auto: (
    <>
      <circle cx="12" cy="12" r="8.500" />
      <path d="M12 3.500v17a8.500 8.500 0 0 0 0-17z" fill="currentColor" />
    </>
  ),
  chevronDown: <path d="M6 9.500l6 6 6-6" />,
  flag: <path d="M5 21V4M5 4.500h11l-2 4 2 4H5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.500" />
      <path d="M12 7.500V12l3 2" />
    </>
  ),
  pin: <path d="M9 3.500h6l-1 6 3.500 3.500h-11L10 9.500zM12 13v7.500" />,
  retry: <path d="M4 12a8 8 0 1 0 2.500-5.800M4 4.500v4h4" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, filled = false, className }: { name: IconName; size?: number; filled?: boolean; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
