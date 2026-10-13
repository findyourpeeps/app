import Link from "next/link";
import { redirect } from "next/navigation";

import {
  cancelDeletionRequestAction,
  pauseMemberAction,
  requestDeletionAction,
  resumeMemberAction,
  saveCadenceAction,
} from "@/app/actions/member";
import { SiteHeader } from "@/components/site-header";
import { readSessionCookie } from "@/lib/auth/session";
import { getAppStore } from "@/lib/product/app-store";

export const instant = false;

export default async function SettingsPage() {
  const session = await readSessionCookie();
  if (!session?.memberId) redirect("/sign-in?next=/settings");

  const member = getAppStore().getMemberProfileView(session.memberId);
  if (!member) redirect("/sign-in");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-semibold text-zinc-900">Settings</h1>

        {member.status === "deletion_requested" ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-zinc-700">
              Deletion requested. We&apos;ll email you when it&apos;s done. You can cancel this
              request while it is pending.
            </p>
            <form action={cancelDeletionRequestAction}>
              <button type="submit" className="rounded-md border px-4 py-2 text-sm">
                Cancel deletion request
              </button>
            </form>
          </div>
        ) : (
          <>
            <section className="mt-8">
              <h2 className="text-lg font-medium text-zinc-900">
                How often we ask about evenings
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                We always send messages about an Invitation you received.
              </p>
              <form action={saveCadenceAction} className="mt-4 space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="cadence"
                    value="weekly"
                    defaultChecked={member.availabilityCadence === "weekly"}
                  />
                  Every week
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="cadence"
                    value="every_other_week"
                    defaultChecked={member.availabilityCadence === "every_other_week"}
                  />
                  Every other week
                </label>
                <button
                  type="submit"
                  className="mt-3 rounded-md bg-zinc-900 px-4 py-2 text-sm text-white"
                >
                  Save
                </button>
              </form>
            </section>

            <section className="mt-10">
              <h2 className="text-lg font-medium text-zinc-900">Take a break</h2>
              <p className="mt-1 text-sm text-zinc-600">
                We stop the weekly question and new Invitations until you come back. You
                stay a member. If you already have an Invitation, it&apos;s still there.
              </p>
              {member.status === "paused" ? (
                <form action={resumeMemberAction} className="mt-4">
                  <button type="submit" className="rounded-md border px-4 py-2 text-sm">
                    Resume invitations
                  </button>
                </form>
              ) : (
                <form action={pauseMemberAction} className="mt-4">
                  <button type="submit" className="rounded-md border px-4 py-2 text-sm">
                    Pause invitations
                  </button>
                </form>
              )}
            </section>

            <section className="mt-10">
              <h2 className="text-lg font-medium text-zinc-900">Leave</h2>
              <p className="mt-1 text-sm text-zinc-600">
                We delete your profile. If you shared contact with someone and you both
                agreed, we can&apos;t take that back. If you filed or were named in a
                report, we keep that report for 3 years.
              </p>
              <form action={requestDeletionAction} className="mt-4">
                <button
                  type="submit"
                  className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-800"
                >
                  Request deletion
                </button>
              </form>
            </section>
          </>
        )}

        <Link href="/home" className="mt-10 inline-block text-sm underline">
          Back to home
        </Link>
      </main>
    </>
  );
}
