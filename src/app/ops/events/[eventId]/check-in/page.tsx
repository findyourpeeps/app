import { redirect } from "next/navigation";

import { markCheckedInAction } from "@/app/actions/ops";
import { readSessionCookie } from "@/lib/auth/session";
import { getLocalAuthStore } from "@/lib/auth/local-auth-store";
import { getAppStore } from "@/lib/product/app-store";

export const instant = false;

export default async function EventCheckInPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await readSessionCookie();
  if (!session?.roles.includes("event_lead") && !session?.roles.includes("host")) {
    redirect("/ops");
  }

  const { eventId } = await params;
  const sp = await searchParams;
  const store = getAppStore();
  const event = store.getEvent(eventId);
  if (!event) redirect("/ops/events");

  const participations = store.listParticipationsForEvent(eventId);
  const auth = getLocalAuthStore();

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Check-in</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Online check-in only. First name and Event ID — no matching fields.
      </p>
      {sp.saved ? (
        <p className="mt-4 text-sm text-green-800">Check-in saved.</p>
      ) : null}
      <ul className="mt-8 space-y-4">
        {participations.map((p) => {
          const member = auth.getSnapshot().members.find((m) => m.id === p.memberId);
          return (
            <li key={p.id} className="rounded border p-3 text-sm">
              <p className="font-medium">{member?.chosenFirstName ?? "Member"}</p>
              <p className="text-zinc-600">Event ID: {p.eventParticipantId ?? "—"}</p>
              <p className="text-zinc-600">Status: {p.status}</p>
              {p.status === "expected" ? (
                <form action={markCheckedInAction} className="mt-2">
                  <input type="hidden" name="eventId" value={eventId} />
                  <input type="hidden" name="participationId" value={p.id} />
                  <button type="submit" className="rounded bg-zinc-900 px-3 py-1 text-white">
                    Check in
                  </button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
