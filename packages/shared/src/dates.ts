/**
 * Warranty date math (§4.3):
 * End date = start + duration using calendar months, clamped to last day of month.
 * Coverage includes the end date and ends at end-of-day in the shop timezone.
 */

export function addCalendarMonths(start: Date, months: number): Date {
  const result = new Date(start.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = daysInUtcMonth(result.getUTCFullYear(), result.getUTCMonth());
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function daysInUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** End of day (23:59:59.999) in a given IANA timezone, returned as UTC Date. */
export function endOfDayInTimezone(date: Date, timeZone: string): Date {
  const parts = getZonedParts(date, timeZone);
  // Construct the local end-of-day then convert back via offset approximation
  const localEnd = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T23:59:59.999`;
  return zonedLocalToUtc(localEnd, timeZone);
}

export function computeWarrantyEnd(params: {
  startAt: Date;
  durationMonths: number | null;
  timeZone: string;
}): Date | null {
  if (params.durationMonths == null) return null; // lifetime
  const endDay = addCalendarMonths(params.startAt, params.durationMonths);
  return endOfDayInTimezone(endDay, params.timeZone);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function getZonedParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function zonedLocalToUtc(localIsoWithoutZone: string, timeZone: string): Date {
  // Binary-search UTC instant whose zoned local matches localIsoWithoutZone
  const target = localIsoWithoutZone;
  let lo = Date.parse(localIsoWithoutZone + "Z") - 48 * 3600_000;
  let hi = Date.parse(localIsoWithoutZone + "Z") + 48 * 3600_000;
  for (let i = 0; i < 40; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const parts = getZonedParts(new Date(mid), timeZone);
    const candidate = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}.999`;
    if (candidate < target) lo = mid + 1;
    else hi = mid;
  }
  return new Date(hi);
}

export type RuleTargetType = "variant" | "product" | "collection" | "default";

const PRECEDENCE: Record<RuleTargetType, number> = {
  variant: 400,
  product: 300,
  collection: 200,
  default: 100,
};

export function rulePrecedenceScore(targetType: RuleTargetType, priority: number): number {
  return PRECEDENCE[targetType] * 10_000 + (10_000 - priority);
}

export function pickWinningRule<T extends { targetType: RuleTargetType; priority: number }>(
  rules: T[],
): T | null {
  if (rules.length === 0) return null;
  return [...rules].sort(
    (a, b) => rulePrecedenceScore(b.targetType, b.priority) - rulePrecedenceScore(a.targetType, a.priority),
  )[0]!;
}
