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
