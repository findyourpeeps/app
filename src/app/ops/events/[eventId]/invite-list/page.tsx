import { redirect } from "next/navigation";

import {
  buildInviteListAction,
  lockAndSendInvitationsAction,
} from "@/app/actions/ops";
import { readSessionCookie } from "@/lib/auth/session";
import { getAppStore } from "@/lib/product/app-store";

export const instant = false;

export default async function InviteListPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ built?: string; sent?: string; error?: string }>;
}) {
  const session = await readSessionCookie();
  if (!session?.roles.includes("curation_lead")) redirect("/ops");

  const { eventId } = await params;
  const sp = await searchParams;
  const store = getAppStore();
  const list = store.getInviteListForEvent(eventId);
  const entries = list ? store.getInviteEntries(list.id) : [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Invite list</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Hold-and-recheck runs before each send. Pickleball experience is never used here.
      </p>
      {sp.error === "readiness" ? (
        <p className="mt-4 text-sm text-red-800">Venue or staff readiness blocks inviting.</p>
      ) : null}
      {sp.built ? <p className="mt-4 text-sm text-green-800">List built.</p> : null}
      {sp.sent ? <p className="mt-4 text-sm text-green-800">Invitations queued (held).</p> : null}

      {!list ? (
        <form action={buildInviteListAction} className="mt-6">
          <input type="hidden" name="eventId" value={eventId} />
          <button type="submit" className="rounded bg-zinc-900 px-3 py-2 text-sm text-white">
            Build eligible list
          </button>
        </form>
      ) : (
        <>
          <p className="mt-4 text-sm">
            {entries.length} entries · {list.status}
          </p>
          <ol className="mt-4 list-decimal space-y-1 pl-6 text-sm">
            {entries.slice(0, 20).map((e) => (
              <li key={e.id}>
                Member {e.memberId.slice(0, 8)}… — {e.statedCriteriaReason.slice(0, 60)}…
              </li>
            ))}
          </ol>
          {list.status === "draft" ? (
            <form action={lockAndSendInvitationsAction} className="mt-6">
              <input type="hidden" name="eventId" value={eventId} />
              <button type="submit" className="rounded bg-zinc-900 px-3 py-2 text-sm text-white">
                Lock list and send invitations
              </button>
            </form>
          ) : null}
        </>
      )}
    </main>
  );
}
