/** 75 → "01:15" */
export function tc(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** 75 → "1:15" */
export function dur(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function kb(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Monday (local time) of the week containing `d`. */
export function mondayOf(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

/**
 * Label for the Last Week in Tech segment. After "Start new week" it's the day the week was
 * started ("Week of Sep 27"); before that ever happens, the Monday of the current week.
 */
export function weekLabel(since: string | undefined, now = new Date(), locale?: string): string {
  const start = since ? new Date(since) : mondayOf(now);
  return `Week of ${start.toLocaleDateString(locale, { month: "short", day: "numeric" })}`;
}

/** 87_400_000 → "87 MB", 950_000 → "0.9 MB" (upload progress reads better in one unit). */
export function mb(bytes: number): string {
  const v = bytes / 1024 / 1024;
  return `${v >= 10 ? Math.round(v) : v.toFixed(1)} MB`;
}

/**
 * Rough time left for an upload, from the average speed so far. Null until there's
 * enough data (3 s) to be worth showing, so the estimate doesn't jump around at the start.
 */
export function timeLeft(loaded: number, total: number, elapsedSec: number): string | null {
  if (elapsedSec < 3 || loaded <= 0 || loaded >= total) return null;
  const sec = ((total - loaded) / loaded) * elapsedSec;
  if (sec < 10) return "a few seconds left";
  if (sec < 60) return `about ${Math.max(10, Math.round(sec / 5) * 5)} sec left`;
  const min = Math.round(sec / 60);
  return `about ${min} min left`;
}
