import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { readSessionCookie } from "@/lib/auth/session";
import { getAppStore } from "@/lib/product/app-store";
import { formatAtlantaDateTime } from "@/lib/product/event-timing";

export const instant = false;

export default async function InvitationsPage() {
  const session = await readSessionCookie();
  if (!session?.memberId) redirect("/sign-in?next=/invitations");

  const store = getAppStore();
  const rows = store.listInvitationsForMember(session.memberId);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-semibold text-zinc-900">Invitations</h1>
        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">
            You haven&apos;t been invited to a night yet. We invite you only when a night
            fits your evenings and preferences.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {rows.map((inv) => {
              const event = store.getEvent(inv.eventId);
              return (
                <li key={inv.id} className="rounded-md border border-zinc-200 px-3 py-2">
                  <Link href={`/invitations/${inv.id}`} className="text-sm font-medium underline">
                    {event ? formatAtlantaDateTime(event.startsAt) : "Night"} — {inv.status}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
