/** All "today" boundaries use Europe/Amsterdam (CET/CEST). */

export const AMSTERDAM_TZ = 'Europe/Amsterdam';

/** YYYY-MM-DD for the given instant in Amsterdam. */
export function getAmsterdamYmd(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: AMSTERDAM_TZ });
}

/** English weekday (long), matching `WEEKDAYS` in workoutPlan, in Amsterdam. */
export function getAmsterdamWeekdayLong(now: Date = new Date()): string {
  return now.toLocaleDateString('en-US', { timeZone: AMSTERDAM_TZ, weekday: 'long' });
}

/**
 * First instant (UTC) when Amsterdam local calendar shows `ymd` (start of that day).
 */
export function startOfAmsterdamDay(ymd: string): Date {
  const [y, mo, d] = ymd.split('-').map((x) => parseInt(x, 10));
  if (!y || !mo || !d) return new Date();

  let ms = Date.UTC(y, mo - 1, d - 1, 0, 0, 0, 0);
  const limit = Date.UTC(y, mo - 1, d + 2, 0, 0, 0, 0);
  while (ms < limit) {
    const dt = new Date(ms);
    if (dt.toLocaleDateString('en-CA', { timeZone: AMSTERDAM_TZ }) === ymd) {
      return dt;
    }
    ms += 15 * 60 * 1000;
  }
  return new Date(Date.UTC(y, mo - 1, d, 23, 0, 0, 0));
}

/** Start of the Amsterdam calendar day after `ymd`. */
export function startOfNextAmsterdamDay(ymd: string): Date {
  const start = startOfAmsterdamDay(ymd);
  let ms = start.getTime() + 3600000;
  for (let i = 0; i < 28; i++) {
    const z = new Date(ms).toLocaleDateString('en-CA', { timeZone: AMSTERDAM_TZ });
    if (z !== ymd) {
      return startOfAmsterdamDay(z);
    }
    ms += 3600000;
  }
  return new Date(start.getTime() + 24 * 3600000);
}

/** ms until next Amsterdam local midnight (00:00), capped for sanity. */
export function msUntilNextAmsterdamMidnight(now: Date = new Date()): number {
  const ymd = getAmsterdamYmd(now);
  const next = startOfNextAmsterdamDay(ymd);
  const delta = next.getTime() - now.getTime();
  return Math.max(1000, Math.min(delta, 48 * 3600000));
}

/** Amsterdam local ms bounds for `/api/steps` (same calendar day as getAmsterdamYmd). */
export function getAmsterdamDayMsRange(now: Date = new Date()): { ymd: string; startMs: number; endMs: number } {
  const ymd = getAmsterdamYmd(now);
  const start = startOfAmsterdamDay(ymd);
  const end = startOfNextAmsterdamDay(ymd);
  return { ymd, startMs: start.getTime(), endMs: end.getTime() };
}

const WEEK_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

/**
 * Amsterdam YYYY-MM-DD for `weekdayLong` in the same Mon–Sun week as `now` (Amsterdam).
 * Week = ISO-style Monday start.
 */
export function amsterdamYmdForWeekdayName(weekdayLong: string, now: Date = new Date()): string {
  const target = WEEK_ORDER.indexOf(weekdayLong as (typeof WEEK_ORDER)[number]);
  if (target < 0) return getAmsterdamYmd(now);

  const todayName = getAmsterdamWeekdayLong(now);
  const todayIdx = WEEK_ORDER.indexOf(todayName as (typeof WEEK_ORDER)[number]);
  if (todayIdx < 0) return getAmsterdamYmd(now);

  const delta = target - todayIdx;
  if (delta === 0) return getAmsterdamYmd(now);

  const sign = delta > 0 ? 1 : -1;
  let ymd = getAmsterdamYmd(now);
  for (let i = 0; i < Math.abs(delta); i++) {
    const start = startOfAmsterdamDay(ymd);
    const nextMs = start.getTime() + sign * 24 * 3600000;
    ymd = new Date(nextMs).toLocaleDateString('en-CA', { timeZone: AMSTERDAM_TZ });
  }
  return ymd;
}

/** Add signed calendar days in Amsterdam (approx. 24h steps; OK across DST for this use case). */
export function addAmsterdamDays(ymd: string, deltaDays: number): string {
  if (deltaDays === 0) return ymd;
  const sign = deltaDays > 0 ? 1 : -1;
  let y = ymd;
  for (let i = 0; i < Math.abs(deltaDays); i++) {
    const start = startOfAmsterdamDay(y);
    y = new Date(start.getTime() + sign * 24 * 3600000).toLocaleDateString('en-CA', {
      timeZone: AMSTERDAM_TZ,
    });
  }
  return y;
}
