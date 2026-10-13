import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { readSessionCookie } from "@/lib/auth/session";
import { getAppStore } from "@/lib/product/app-store";
import { PROFILE_SECTION_ORDER } from "@/lib/product/profile-sections";

export const instant = false;

export default async function MemberHomePage() {
  await connection();

  const session = await readSessionCookie();
  if (!session) {
    redirect("/sign-in");
  }
  if (!session.memberId) {
    redirect("/ops");
  }

  const store = getAppStore();
  const member = store.getMemberProfileView(session.memberId);
  if (!member) redirect("/sign-in");

  const items = store.getMatchingItems(session.memberId);
  const progress = store.sectionProgress(member, items);
  const incompleteSections = PROFILE_SECTION_ORDER.filter(
    (s) => progress[s] !== "done",
  );
  const invitations = store
    .listInvitationsForMember(session.memberId)
    .filter((i) => i.status === "invited");
  const needsAvailability =
    member.status === "active" && !store.currentAvailability(session.memberId);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-semibold text-zinc-900">Home</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Status:{" "}
          {member.status === "active"
            ? "Active"
            : member.status === "paused"
              ? "Paused"
              : "Deletion requested"}
        </p>
        {!member.isInServiceArea ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            We don&apos;t hold nights near that ZIP yet. We saved your profile and will
            invite you when we do.
          </p>
        ) : null}

        <ul className="mt-8 space-y-3 text-sm">
          {incompleteSections.length ? (
            <li>
              <Link href="/profile/setup/gender" className="font-medium underline">
                Finish your matching profile ({incompleteSections.length} sections left)
              </Link>
            </li>
          ) : null}
          {needsAvailability ? (
            <li>
              <Link href="/availability" className="font-medium underline">
                This week&apos;s availability ask
              </Link>
            </li>
          ) : null}
          {invitations.map((inv) => (
            <li key={inv.id}>
              <Link href={`/invitations/${inv.id}`} className="font-medium underline">
                Invitation waiting for your RSVP
              </Link>
            </li>
          ))}
          {!incompleteSections.length && !needsAvailability && invitations.length === 0 ? (
            <li className="text-zinc-600">
              Nothing needs your attention right now. We&apos;ll email you when a night
              fits.
            </li>
          ) : null}
        </ul>
      </main>
    </>
  );
}
