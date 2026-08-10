/**
 * Shopper brand mark.
 *
 * A clock face whose hands read as a check: scheduling plus confirmation, the
 * two things the product actually does. Drawn on a 24px grid with a 2px stroke
 * so it stays legible at favicon size, and it uses `currentColor` throughout so
 * it inherits whatever surface it sits on.
 */

export function LogoMark({ size = 24, strokeWidth = 2, className = "" }) {
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
      <circle cx="12" cy="12" r="9.25" />
      {/* Hands meeting at the centre, angled into a tick. */}
      <path d="M8.4 12.2l2.6 2.6 4.7-5.6" />
    </svg>
  );
}

/**
 * The mark on its own tile — used where the logo needs to hold its own against
 * a busy surface (sidebar header, login card).
 */
export function LogoTile({ size = 32, className = "" }) {
  return (
    <span className={`logo-tile ${className}`} style={{ width: size, height: size }}>
      <LogoMark size={Math.round(size * 0.62)} strokeWidth={2.2} />
    </span>
  );
}

/** Mark plus wordmark. `tile` gives the mark its filled background. */
export default function Logo({
  size = 26,
  tile = false,
  wordmark = true,
  tagline = "",
  className = "",
}) {
  return (
    <span className={`logo ${className}`}>
      {tile ? <LogoTile size={size} /> : <LogoMark size={size} strokeWidth={2} />}
      {wordmark ? (
        <span className="logo-text">
          <span className="logo-name">Shopper</span>
          {tagline ? <span className="logo-tagline">{tagline}</span> : null}
        </span>
      ) : null}
    </span>
  );
}
