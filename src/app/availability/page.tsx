import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import {
  saveAvailabilityAction,
  saveAvailabilityNoneAction,
} from "@/app/actions/member";
import { SiteHeader } from "@/components/site-header";
import { readSessionCookie } from "@/lib/auth/session";
import { getAppStore } from "@/lib/product/app-store";
import {
  currentAvailabilityWindow,
  eveningLabelsForWindow,
  formatAtlantaDate,
} from "@/lib/product/event-timing";

export const instant = false;

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await connection();

  const session = await readSessionCookie();
  if (!session?.memberId) redirect("/sign-in?next=/availability");

  const member = getAppStore().getMemberProfileView(session.memberId);
  if (!member) redirect("/sign-in");

  if (member.status === "paused") {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-xl px-4 py-10">
          <p>You&apos;re paused. We&apos;re not asking right now.</p>
          <Link href="/settings" className="mt-4 inline-block underline text-sm">
            Resume
          </Link>
        </main>
      </>
    );
  }

  const now = new Date();
  const window = currentAvailabilityWindow(now);
  const evenings = eveningLabelsForWindow(window.startsAt, window.endsAt);
  const sp = await searchParams;
  const current = getAppStore().currentAvailability(session.memberId, now);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-semibold text-zinc-900">Weekly availability</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {formatAtlantaDate(window.startsAt.toISOString())} through{" "}
          {formatAtlantaDate(window.endsAt.toISOString())}
        </p>
        <p className="mt-4 text-sm text-zinc-700">
          These are the evenings we might hold a night. Saving them is not an RSVP. If
          you don&apos;t choose any, we won&apos;t invite you these two weeks. You stay a
          member.
        </p>
        {current?.eveningDates.length ? (
          <p className="mt-4 text-sm text-zinc-600">
            Last time you chose: {current.eveningDates.join(", ")}
          </p>
        ) : null}
        {sp.saved ? <p className="mt-4 text-sm text-green-800">Saved.</p> : null}
        {sp.error ? (
          <p className="mt-4 text-sm text-red-800" role="alert">
            We couldn&apos;t save your evenings. Your earlier answer still stands.
          </p>
        ) : null}

        <form action={saveAvailabilityAction} className="mt-8">
          <fieldset>
            <legend className="text-sm font-medium">Evenings</legend>
            <div className="mt-2 space-y-2">
              {evenings.map((e) => (
                <label key={e.dateKey} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="evening" value={e.dateKey} />
                  {e.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white">
              Save these evenings
            </button>
            <button
              type="submit"
              className="rounded-md border px-4 py-2 text-sm"
              formAction={saveAvailabilityNoneAction}
            >
              I&apos;m not free these weeks
            </button>
          </div>
        </form>
        <Link href="/settings" className="mt-6 inline-block text-sm underline">
          Change how often we ask
        </Link>
      </main>
    </>
  );
}
