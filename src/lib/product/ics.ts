import { formatAtlantaDateTime } from "@/lib/product/event-timing";

export function buildAcceptanceIcs(input: {
  eventId: string;
  startsAt: string;
  endsAt: string;
  venueName: string;
  venueAddress: string;
}): string {
  const uid = `event-${input.eventId}@atlanta-singles.local`;
  const dtStart = formatAtlantaDateTime(input.startsAt);
  const dtEnd = formatAtlantaDateTime(input.endsAt);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Atlanta Singles//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `SUMMARY:Pickleball night at ${input.venueName}`,
    `LOCATION:${input.venueAddress}`,
    `DESCRIPTION:Atlanta Singles curated night. ${dtStart} – ${dtEnd} America/New_York`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
