import Link from "next/link";
import { redirect } from "next/navigation";

import { readSessionCookie } from "@/lib/auth/session";
import { getAppStore } from "@/lib/product/app-store";
import { computeEventBoundaries, formatAtlantaDateTime } from "@/lib/product/event-timing";

export const instant = false;

export default async function OpsEventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const session = await readSessionCookie();
  if (!session?.roles.includes("event_lead") && !session?.roles.includes("curation_lead")) {
    redirect("/ops");
  }

  const { eventId } = await params;
  const store = getAppStore();
  const event = store.getEvent(eventId);
  if (!event) redirect("/ops/events");

  const bounds = computeEventBoundaries(new Date(event.startsAt));
  const readiness = store.eventReadiness(eventId);

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Event</h1>
      <p className="mt-2 text-sm">Status: {event.status}</p>
      <p className="text-sm">Atlanta start: {formatAtlantaDateTime(event.startsAt)}</p>
      <dl className="mt-6 space-y-2 text-sm">
        <div>
          <dt className="font-medium">Go</dt>
          <dd>{event.capacity} confirmed</dd>
        </div>
        <div>
          <dt className="font-medium">Smaller night</dt>
          <dd>{event.minimumGroupSize} to 15 confirmed</dd>
        </div>
        <div>
          <dt className="font-medium">Reconfirm (E−72h)</dt>
          <dd>{formatAtlantaDateTime(bounds.e72h)}</dd>
        </div>
        <div>
          <dt className="font-medium">Release (E−48h)</dt>
          <dd>{formatAtlantaDateTime(bounds.e48h)}</dd>
        </div>
        <div>
          <dt className="font-medium">Go/no-go (E−24h)</dt>
          <dd>{formatAtlantaDateTime(bounds.e24h)}</dd>
        </div>
      </dl>
      {!readiness.ok ? (
        <p className="mt-4 text-sm text-amber-800">
          Not ready to invite: {readiness.reasons.join(", ")}
        </p>
      ) : (
        <p className="mt-4 text-sm text-green-800">Venue and staff readiness OK.</p>
      )}
      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        {session.roles.includes("curation_lead") ? (
          <Link href={`/ops/events/${eventId}/invite-list`} className="underline">
            Invite list
          </Link>
        ) : null}
        {session.roles.includes("event_lead") ? (
          <>
            <Link href={`/ops/events/${eventId}/decision`} className="underline">
              Go / smaller / reschedule
            </Link>
            <Link href={`/ops/events/${eventId}/check-in`} className="underline">
              Check-in
            </Link>
          </>
        ) : null}
      </div>
    </main>
  );
}
