const ATLANTA_TZ = "America/New_York";

/** Format an instant for display in Atlanta local time. */
export function formatAtlantaDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ATLANTA_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function formatAtlantaDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ATLANTA_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export interface EventBoundaries {
  startsAt: string;
  endsAt: string;
  e72h: string;
  e48h: string;
  e24h: string;
}

export function computeEventBoundaries(startsAt: Date, durationMinutes = 120): EventBoundaries {
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
  return {
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    e72h: new Date(startsAt.getTime() - 72 * 60 * 60 * 1000).toISOString(),
    e48h: new Date(startsAt.getTime() - 48 * 60 * 60 * 1000).toISOString(),
    e24h: new Date(startsAt.getTime() - 24 * 60 * 60 * 1000).toISOString(),
  };
}

/** Atlanta-local calendar date (YYYY-MM-DD) for an instant. */
export function atlantaDateKey(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ATLANTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${day}`;
}

export function addDaysUtc(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

export function currentAvailabilityWindow(now: Date): {
  startsAt: Date;
  endsAt: Date;
  expiresAt: Date;
} {
  const start = new Date(now);
  start.setUTCHours(12, 0, 0, 0);
  const endsAt = addDaysUtc(start, 14);
  return { startsAt: start, endsAt, expiresAt: endsAt };
}

export function eveningLabelsForWindow(
  startsAt: Date,
  endsAt: Date,
): { dateKey: string; label: string }[] {
  const out: { dateKey: string; label: string }[] = [];
  for (let t = startsAt.getTime(); t < endsAt.getTime(); t += 24 * 60 * 60 * 1000) {
    const day = new Date(t);
    const key = atlantaDateKey(day);
    out.push({
      dateKey: key,
      label: formatAtlantaDate(day.toISOString()),
    });
  }
  return out;
}
