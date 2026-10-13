import { redirect } from "next/navigation";

import { authorizeConnectionAction } from "@/app/actions/member";
import { SiteHeader } from "@/components/site-header";
import { readSessionCookie } from "@/lib/auth/session";
import { getAppStore } from "@/lib/product/app-store";
import { formatAtlantaDateTime } from "@/lib/product/event-timing";

export const instant = false;

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await readSessionCookie();
  if (!session?.memberId) redirect("/sign-in");

  const sp = await searchParams;
  const connections = getAppStore().listConnectionsForMember(session.memberId);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-semibold">Connections</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Approve sharing your verified email only. You have 72 hours after a mutual match.
        </p>
        {sp.saved ? (
          <p className="mt-4 text-sm text-green-800">Authorization saved.</p>
        ) : null}
        {sp.error ? (
          <p className="mt-4 text-sm text-red-800">Authorization could not be saved.</p>
        ) : null}
        <ul className="mt-8 space-y-4">
          {connections.map((c) => {
            const mine =
              c.memberAId === session.memberId
                ? c.memberAAuthorizedAt
                : c.memberBAuthorizedAt;
            return (
              <li key={c.id} className="rounded border p-4 text-sm">
                <p>Status: {c.status}</p>
                <p className="text-zinc-600">
                  Approve by {formatAtlantaDateTime(c.authorizationDeadline)}
                </p>
                {c.status !== "released" &&
                c.status !== "lapsed" &&
                c.status !== "withdrawn" &&
                !mine ? (
                  <form action={authorizeConnectionAction} className="mt-3">
                    <input type="hidden" name="connectionId" value={c.id} />
                    <button type="submit" className="rounded-md bg-zinc-900 px-3 py-1.5 text-white">
                      Approve verified email
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
        {connections.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-700">No mutual matches yet.</p>
        ) : null}
      </main>
    </>
  );
}
