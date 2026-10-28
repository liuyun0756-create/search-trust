import {localDate, type ImplementationEntry} from "./contracts";

export const comparisonLengths = [7, 14, 28, 90] as const;
export type ComparisonLength = typeof comparisonLengths[number];
type Period = {start: string; end: string};
export type CalendarPreview = {
  days: ComparisonLength; timezone: string; before: Period; excluded: Period; after: Period;
  calendar_state: "waiting" | "elapsed"; data_state: "not_checked";
};
/** Calendar-only preview in the saved implementation timezone. This is NOT
 * source qualification: date-only assertions may overlap two source dates.
 * UTC arithmetic counts calendar dates, never 24-hour local DST intervals.
 */
export function planImplementationWindow(entry: ImplementationEntry, days: ComparisonLength = 28, at = new Date()): CalendarPreview | null {
  if (!comparisonLengths.includes(days) || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(entry.implemented_on)) return null;
  try {
    const first = new Date(`${entry.implemented_on}T00:00:00Z`);
    if (!Number.isFinite(at.getTime()) || first.toISOString().slice(0, 10) !== entry.implemented_on) return null;
    // A calendar can skip a whole date (e.g. Pacific/Apia, 2011-12-30).
    // Fail closed instead of showing a date that never occurred locally.
    if (![-12, 0, 12, 24].some(hours => localDate(new Date(first.getTime() + hours * 3600000), entry.timezone) === entry.implemented_on)) return null;
    const shift = (offset: number) => {
      const value = new Date(first); value.setUTCDate(value.getUTCDate() + offset);
      const day = value.toISOString().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("unsupported calendar range");
      return day;
    };
    const after = {start: shift(1), end: shift(days)};
    return {days, timezone: entry.timezone, before: {start: shift(-days), end: shift(-1)},
      excluded: {start: entry.implemented_on, end: entry.implemented_on}, after,
      calendar_state: localDate(at, entry.timezone) <= after.end ? "waiting" : "elapsed", data_state: "not_checked"};
  } catch {return null;}
}
