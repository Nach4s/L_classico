/**
 * date-utils.ts
 *
 * Centralised date helpers to avoid timezone bugs.
 *
 * KEY RULE:
 *  - The database always stores UTC timestamps.
 *  - `new Date(utcString)` in JavaScript always produces a correct UTC Date
 *    object.  Comparison with `new Date()` (also UTC internally) is safe on
 *    both server and browser.
 *  - The ONLY place where timezone matters is DISPLAY (toLocaleString) and
 *    INPUT (<input type="datetime-local">), which works in *local* time.
 */

/**
 * Convert a UTC ISO string (from DB) into the value format required by
 * <input type="datetime-local"> (YYYY-MM-DDTHH:mm in LOCAL time).
 *
 * Without this, using .toISOString().slice(0, 16) would give UTC time,
 * which for UTC+5 users means the picker shows -5 hours.
 */
export function toDatetimeLocalValue(utcIsoString: string | null | undefined): string {
  if (!utcIsoString) return "";
  const d = new Date(utcIsoString);
  if (isNaN(d.getTime())) return "";
  // Subtract the UTC offset so the ISO string represents local time
  const localMs = d.getTime() - d.getTimezoneOffset() * 60_000;
  return new Date(localMs).toISOString().slice(0, 16);
}

/**
 * Convert a datetime-local input value (YYYY-MM-DDTHH:mm, LOCAL time,
 * NO timezone suffix) into a proper UTC ISO string for the API.
 *
 * `new Date("2026-04-25T09:50")` is parsed as LOCAL time by the browser,
 * so `.toISOString()` correctly converts it back to UTC.
 */
export function datetimeLocalToUtcIso(localValue: string | null | undefined): string | null {
  if (!localValue) return null;
  const d = new Date(localValue); // browser interprets as local
  if (isNaN(d.getTime())) return null;
  return d.toISOString(); // always UTC
}

/**
 * Format a UTC ISO date string for display in the user's local timezone.
 * Uses Intl.DateTimeFormat — no manual offset arithmetic needed.
 */
export function formatDeadline(utcIsoString: string | null | undefined, locale = "ru-RU"): string {
  if (!utcIsoString) return "Не указан";
  const d = new Date(utcIsoString);
  if (isNaN(d.getTime())) return "Некорректная дата";
  // No timeZone option → browser/Node uses its own local timezone
  return d.toLocaleString(locale, {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Returns true if the deadline has passed.
 * Safe on both server (UTC) and browser (both sides use UTC internally).
 */
export function isDeadlinePassed(utcIsoString: string | null | undefined): boolean {
  if (!utcIsoString) return true; // treat no deadline as already passed
  return new Date(utcIsoString) <= new Date();
}
