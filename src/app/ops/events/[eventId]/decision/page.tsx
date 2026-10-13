import { redirect } from "next/navigation";

import {
  recordEventDecisionAction,
  rescheduleEventAction,
} from "@/app/actions/ops";
import { readSessionCookie } from "@/lib/auth/session";
import { getAppStore } from "@/lib/product/app-store";
import { formatAtlantaDateTime } from "@/lib/product/event-timing";

export const instant = false;

export default async function EventDecisionPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await readSessionCookie();
  if (!session?.roles.includes("event_lead")) redirect("/ops");

  const { eventId } = await params;
  const sp = await searchParams;
  const store = getAppStore();
  const event = store.getEvent(eventId);
  if (!event) redirect("/ops/events");

  const confirmed = store.confirmedCount(eventId);

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold">24-hour decision</h1>
      <p className="mt-2 text-sm text-zinc-700">
        Confirmed {confirmed} of 16. Minimum group is 12.
      </p>
      <p className="text-sm text-zinc-600">
        Decision due {formatAtlantaDateTime(event.decisionDueAt)}
      </p>
      {sp.error ? (
        <p className="mt-4 text-sm text-red-800">Could not save: {sp.error}</p>
      ) : null}

      <section className="mt-8 space-y-6">
        <form action={recordEventDecisionAction} className="space-y-2">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="outcome" value="go" />
          <button
            type="submit"
            disabled={confirmed !== 16}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            Go (16 confirmed)
          </button>
        </form>
        <form action={recordEventDecisionAction} className="space-y-2">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="outcome" value="smaller" />
          <button
            type="submit"
            disabled={confirmed < 12 || confirmed > 15}
            className="rounded-md border px-4 py-2 text-sm disabled:opacity-40"
          >
            Smaller night (12–15 confirmed)
          </button>
        </form>
        <form action={recordEventDecisionAction} className="space-y-2">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="outcome" value="rescheduled" />
          <button type="submit" className="rounded-md border px-4 py-2 text-sm">
            Mark rescheduled (decision)
          </button>
        </form>
        <form action={recordEventDecisionAction} className="space-y-2">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="outcome" value="canceled" />
          <button type="submit" className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-900">
            Cancel night
          </button>
        </form>
      </section>

      <section className="mt-10 border-t pt-8">
        <h2 className="text-lg font-medium">Material reschedule</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Changing the start time updates this Event. Accepted and confirmed members must RSVP
          again.
        </p>
        <form action={rescheduleEventAction} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="eventId" value={eventId} />
          <label className="text-sm">
            New start (local)
            <input
              type="datetime-local"
              name="startsAt"
              required
              className="mt-1 block w-full rounded border px-2 py-1"
            />
          </label>
          <button type="submit" className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm text-white">
            Save new time
          </button>
        </form>
      </section>
    </main>
  );
}
