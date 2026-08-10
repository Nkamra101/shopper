/**
 * One icon set for the whole app, so stroke weight and grid stay consistent.
 * Every glyph is drawn on a 24px box with a 2px stroke and inherits
 * `currentColor`.
 */

const PATHS = {
  calendar: <><rect x="3" y="4.5" width="18" height="17" rx="2.5" /><path d="M8 2.5v4M16 2.5v4M3 10h18" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.2 1.9" /></>,
  users: <><path d="M16 20v-1.6a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" /><circle cx="9" cy="7" r="3.6" /><path d="M22 20v-1.6a4 4 0 0 0-3-3.87" /><path d="M15.5 3.6a4 4 0 0 1 0 7.75" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  plug: <><path d="M9 2v6M15 2v6" /><path d="M6 8h12v3a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8Z" /><path d="M12 17v5" /></>,
  zap: <><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></>,
  help: <><circle cx="12" cy="12" r="9.5" /><path d="M9.2 9.3a3 3 0 0 1 5.8 1c0 2-2.9 2.7-2.9 2.7" /><path d="M12 17.2h.01" /></>,
  user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>,
  menu: <><path d="M3 6h18M3 12h18M3 18h18" /></>,
  close: <><path d="M18 6 6 18M6 6l12 12" /></>,
  check: <><path d="M20 6 9 17l-5-5" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></>,
  external: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6M10 14 21 3" /></>,
  edit: <><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></>,
  trash: <><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></>,
  pause: <><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></>,
  play: <><path d="m6 3 14 9-14 9V3Z" /></>,
  duplicate: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2" /></>,
  search: <><circle cx="11" cy="11" r="7.5" /><path d="m21 21-4.3-4.3" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></>,
  chevronLeft: <><path d="m15 18-6-6 6-6" /></>,
  chevronRight: <><path d="m9 18 6-6-6-6" /></>,
  chevronDown: <><path d="m6 9 6 6 6-6" /></>,
  arrowRight: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  sun: <><circle cx="12" cy="12" r="4.5" /><path d="M12 1.5v2.5M12 20v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M1.5 12H4M20 12h2.5M4.2 19.8 6 18M18 6l1.8-1.8" /></>,
  moon: <><path d="M20.5 14.8A8.6 8.6 0 0 1 9.2 3.5a8.6 8.6 0 1 0 11.3 11.3Z" /></>,
  video: <><path d="m22 8.5-6 3.5 6 3.5v-7Z" /><rect x="2" y="6" width="14" height="12" rx="2.5" /></>,
  phone: <><path d="M21.5 16.9v2.6a2 2 0 0 1-2.2 2 19.6 19.6 0 0 1-8.5-3 19.3 19.3 0 0 1-6-6 19.6 19.6 0 0 1-3-8.6 2 2 0 0 1 2-2.2h2.6a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L8.6 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z" /></>,
  pin: <><path d="M20 10.3c0 5.3-8 12.2-8 12.2s-8-6.9-8-12.2a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="2.8" /></>,
  mail: <><rect x="2" y="4.5" width="20" height="15" rx="2.5" /><path d="m2.5 7 9.5 6.5L21.5 7" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></>,
  key: <><circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.8 12.2 8.7-8.7M16 6l3 3M13.5 8.5l3 3" /></>,
  globe: <><circle cx="12" cy="12" r="9.5" /><path d="M2.5 12h19M12 2.5a15 15 0 0 1 0 19 15 15 0 0 1 0-19Z" /></>,
  alert: <><circle cx="12" cy="12" r="9.5" /><path d="M12 7.5v5M12 16.5h.01" /></>,
  info: <><circle cx="12" cy="12" r="9.5" /><path d="M12 16v-4.5M12 7.8h.01" /></>,
  filter: <><path d="M3 5h18l-7 8.5V20l-4-2v-4.5L3 5Z" /></>,
  ban: <><circle cx="12" cy="12" r="9.5" /><path d="m5.3 5.3 13.4 13.4" /></>,
  refresh: <><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v5.5h-5.5" /></>,
};

export default function Icon({ name, size = 16, strokeWidth = 2, className = "" }) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {path}
    </svg>
  );
}
