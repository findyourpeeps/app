import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { readSessionCookie } from "@/lib/auth/session";
import { getAppStore } from "@/lib/product/app-store";

export const instant = false;

export default async function ProfilePage() {
  await connection();

  const session = await readSessionCookie();
  if (!session?.memberId) redirect("/sign-in?next=/profile");

  const store = getAppStore();
  const member = store.getMemberProfileView(session.memberId);
  if (!member) redirect("/sign-in");
  const items = store.getMatchingItems(session.memberId);
  const avail = store.currentAvailability(session.memberId);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-semibold text-zinc-900">Your profile</h1>
        {member.status === "deletion_requested" ? (
          <p className="mt-2 text-sm text-amber-800">
            Deletion requested. Editing is off.
          </p>
        ) : null}
        <p className="mt-4 text-sm text-zinc-600">
          We show planners your matching preferences; we show hosts your first name
          only; we share contact only after both of you approve it, and it can&apos;t be
          taken back.
        </p>

        <dl className="mt-8 space-y-4 text-sm">
          <Row label="First name" value={member.chosenFirstName} />
          <Row label="Email" value={session.email} />
          <Row label="Age" value={String(member.selfReportedAge)} />
          <Row label="ZIP" value={member.homeZip} />
          <Row
            label="Status"
            value={
              member.profileStatus === "complete"
                ? "Profile complete"
                : "Profile incomplete — you won't be invited until it's done"
            }
          />
          <Row
            label="Evenings"
            value={
              avail
                ? avail.eveningDates.length
                  ? avail.eveningDates.join(", ")
                  : "Not available this window"
                : "Not answered yet"
            }
          />
          <Row
            label="Matching items saved"
            value={items.length ? String(items.length) : "Not given"}
          />
        </dl>

        {member.status !== "deletion_requested" ? (
          <div className="mt-8 flex flex-wrap gap-4 text-sm">
            <Link href="/profile/setup/gender" className="underline">
              Edit profile
            </Link>
            <Link href="/availability" className="underline">
              Change evenings
            </Link>
            <Link href="/settings" className="underline">
              Pause or leave
            </Link>
          </div>
        ) : null}
      </main>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-zinc-800">{label}</dt>
      <dd className="text-zinc-700">{value}</dd>
    </div>
  );
}
