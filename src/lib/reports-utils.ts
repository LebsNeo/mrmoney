/**
 * Pure utility helpers for the reports module.
 * No "use server" — safe to import in both client and server components.
 */

export type PeriodPreset =
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "last_quarter"
  | "this_year"
  | "last_year"
  | "custom";

export function resolvePeriod(preset: PeriodPreset, customFrom?: string, customTo?: string) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed

  switch (preset) {
    case "this_month":
      return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0) };
    case "last_month":
      return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0) };
    case "this_quarter": {
      const q = Math.floor(m / 3);
      return { from: new Date(y, q * 3, 1), to: new Date(y, q * 3 + 3, 0) };
    }
    case "last_quarter": {
      const q = Math.floor(m / 3) - 1;
      const qy = q < 0 ? y - 1 : y;
      const qq = ((q % 4) + 4) % 4;
      return { from: new Date(qy, qq * 3, 1), to: new Date(qy, qq * 3 + 3, 0) };
    }
    case "this_year":
      return { from: new Date(y, 0, 1), to: new Date(y, 11, 31) };
    case "last_year":
      return { from: new Date(y - 1, 0, 1), to: new Date(y - 1, 11, 31) };
    case "custom":
      return {
        from: customFrom ? new Date(customFrom) : new Date(y, m, 1),
        to: customTo ? new Date(customTo) : new Date(y, m + 1, 0),
      };
    default:
      return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0) };
  }
}

export function formatPeriodLabel(from: Date, to: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  const f = from.toLocaleDateString("en-ZA", opts);
  const t = to.toLocaleDateString("en-ZA", opts);
  if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
    return from.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
  }
  return `${f} – ${t}`;
}
