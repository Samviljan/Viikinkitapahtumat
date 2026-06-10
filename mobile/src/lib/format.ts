export const FI_MONTHS = [
  "Tammikuu", "Helmikuu", "Maaliskuu", "Huhtikuu", "Toukokuu", "Kesäkuu",
  "Heinäkuu", "Elokuu", "Syyskuu", "Lokakuu", "Marraskuu", "Joulukuu",
];

export const FI_CATS: Record<string, string> = {
  market: "Markkinat",
  training_camp: "Harjoitusleiri",
  course: "Kurssi",
  festival: "Juhla",
  meetup: "Kokoontuminen",
  other: "Muu",
};

/**
 * Parse `YYYY-MM-DD` as a LOCAL Date (not UTC) — same fix used on the website
 * so calendar grouping doesn't drift over timezone boundaries.
 */
export function parseEventDate(s?: string | null): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Finnish numeric date range:
 *   5.6.2026, 5.–7.6.2026, 28.6.–2.7.2026, 30.12.2026 – 2.1.2027
 */
export function formatDateRange(start?: string | null, end?: string | null): string {
  const s = parseEventDate(start);
  if (!s) return "";
  const e = parseEventDate(end) || s;
  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();
  const sameMonth =
    s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();
  const sameYear = s.getFullYear() === e.getFullYear();
  if (sameDay) return `${s.getDate()}.${s.getMonth() + 1}.${s.getFullYear()}`;
  if (sameMonth)
    return `${s.getDate()}.–${e.getDate()}.${e.getMonth() + 1}.${e.getFullYear()}`;
  if (sameYear)
    return `${s.getDate()}.${s.getMonth() + 1}.–${e.getDate()}.${e.getMonth() + 1}.${e.getFullYear()}`;
  return `${s.getDate()}.${s.getMonth() + 1}.${s.getFullYear()} – ${e.getDate()}.${e.getMonth() + 1}.${e.getFullYear()}`;
}

/**
 * Days until event start (0 = today/ongoing, null = already past).
 */
export function daysUntil(start?: string | null, end?: string | null): number | null {
  const s = parseEventDate(start);
  if (!s) return null;
  const e = parseEventDate(end) || s;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  if (today > e) return null;
  if (today >= s && today <= e) return 0;
  return Math.round((s.getTime() - today.getTime()) / 86400000);
}

export function countdownLabel(
  days: number,
  t?: (k: string, vars?: Record<string, string | number>) => string,
): string {
  // Backwards-compat: when called without `t` (legacy callers) fall back to FI.
  const tr = t || ((k: string, vars?: Record<string, string | number>) => {
    const fi: Record<string, string> = {
      "countdown.today": "Käynnissä nyt",
      "countdown.tomorrow": "Huomenna",
      "countdown.days": `${vars?.n} päivää`,
    };
    return fi[k] || k;
  });
  if (days === 0) return tr("countdown.today");
  if (days === 1) return tr("countdown.tomorrow");
  return tr("countdown.days", { n: days });
}

/**
 * Total whole days the event spans (1 = single-day, 2 = two-day, …).
 * Returns null if start date is missing.
 */
export function durationDays(start?: string | null, end?: string | null): number | null {
  const s = parseEventDate(start);
  if (!s) return null;
  const e = parseEventDate(end) || s;
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}

export function durationLabel(
  days: number,
  t?: (k: string, vars?: Record<string, string | number>) => string,
): string {
  const tr = t || ((k: string, vars?: Record<string, string | number>) => {
    const fi: Record<string, string> = {
      "duration.one": "1 päivä",
      "duration.n": `${vars?.n} päivää`,
    };
    return fi[k] || k;
  });
  if (days === 1) return tr("duration.one");
  return tr("duration.n", { n: days });
}
