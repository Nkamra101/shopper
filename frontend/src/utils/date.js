export function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

export function getUpcomingDates(total = 10) {
  const dates = [];
  const today = new Date();

  for (let index = 0; index < total; index += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    dates.push(date);
  }

  return dates;
}

export function toDateInputValue(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/* ------------------------------------------------------------ timezones -- */

/** The visitor's own IANA timezone, or UTC if the browser won't say. */
export function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function safeFormat(value, options, timezone) {
  try {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: timezone }).format(new Date(value));
  } catch {
    // An unknown zone should degrade to the visitor's local time, not crash.
    return new Intl.DateTimeFormat("en-US", options).format(new Date(value));
  }
}

/** "9:30 AM" for an instant, rendered in the given timezone. */
export function formatTimeIn(value, timezone) {
  return safeFormat(value, { hour: "numeric", minute: "2-digit" }, timezone);
}

/** "Monday, March 3" for an instant, rendered in the given timezone. */
export function formatDayIn(value, timezone) {
  return safeFormat(value, { weekday: "long", month: "long", day: "numeric" }, timezone);
}

/** "Mon, Mar 3, 2026 at 9:30 AM" for an instant, in the given timezone. */
export function formatFullIn(value, timezone) {
  return safeFormat(
    value,
    { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" },
    timezone
  );
}

/** The YYYY-MM-DD calendar date an instant falls on within a timezone. */
export function dateKeyIn(value, timezone) {
  try {
    // en-CA renders ISO-style YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  } catch {
    return toDateInputValue(new Date(value));
  }
}

/** "GMT+5:30" style label for a zone, useful next to its name. */
export function timezoneOffsetLabel(timezone) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    return parts.find((part) => part.type === "timeZoneName")?.value || "";
  } catch {
    return "";
  }
}

/** Shift a YYYY-MM-DD string by whole days without tripping over DST. */
export function shiftDateKey(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * A short, readable timezone list for the public booking picker.
 * The full IANA set is ~600 entries, which is a worse experience than a
 * curated list plus whatever zone the visitor is actually in.
 */
export const COMMON_TIMEZONES = [
  "Pacific/Auckland",
  "Australia/Sydney",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/Moscow",
  "Africa/Nairobi",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/London",
  "Africa/Lagos",
  "America/Sao_Paulo",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Pacific/Honolulu",
  "UTC",
];
