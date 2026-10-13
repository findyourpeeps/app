import { connection } from "next/server";
import { redirect } from "next/navigation";

import { createPrivateSelectionAction } from "@/app/actions/member";
import { SiteHeader } from "@/components/site-header";
import { readSessionCookie } from "@/lib/auth/session";
import { getAppStore } from "@/lib/product/app-store";

export const instant = false;

export default async function FollowUpPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await connection();

  const session = await readSessionCookie();
  if (!session?.memberId) redirect("/sign-in");

  const sp = await searchParams;
  const store = getAppStore();
  const eventId = store.findOpenFollowUpEventIdForMember(session.memberId, new Date());

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-semibold">Follow-up</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Enter another attendee&apos;s Event ID from the same night. One-sided choices stay
          private.
        </p>
        {sp.saved ? (
          <p className="mt-4 text-sm text-green-800">Selection saved.</p>
        ) : null}
        {sp.error ? (
          <p className="mt-4 text-sm text-red-800">We couldn&apos;t save that ID.</p>
        ) : null}
        {eventId ? (
          <form action={createPrivateSelectionAction} className="mt-8 space-y-3">
            <input type="hidden" name="eventId" value={eventId} />
            <label className="block text-sm">
              Event ID
              <input
                name="targetEventParticipantId"
                required
                className="mt-1 block w-full rounded border px-2 py-1"
                placeholder="PEEP-XXXXXX"
              />
            </label>
            <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white">
              Save private selection
            </button>
          </form>
        ) : (
          <p className="mt-6 text-sm text-zinc-700">No open follow-up window right now.</p>
        )}
      </main>
    </>
  );
}
