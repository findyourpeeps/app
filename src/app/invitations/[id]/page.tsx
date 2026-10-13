import { redirect } from "next/navigation";

import {
  confirmReconfirmationAction,
  respondInvitationAction,
} from "@/app/actions/member";
import { SiteHeader } from "@/components/site-header";
import { readSessionCookie } from "@/lib/auth/session";
import { getAppStore } from "@/lib/product/app-store";
import { formatAtlantaDateTime } from "@/lib/product/event-timing";

export const instant = false;

export default async function InvitationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; confirmed?: string }>;
}) {
  const session = await readSessionCookie();
  if (!session?.memberId) redirect("/sign-in");

  const { id } = await params;
  const sp = await searchParams;
  const store = getAppStore();
  const invitation = store.getInvitation(id);
  if (!invitation || invitation.memberId !== session.memberId) {
    redirect("/invitations");
  }
  const event = store.getEvent(invitation.eventId);
  const venue = event?.venueId
    ? store.listVenues().find((v) => v.id === event.venueId)
    : null;

  const expired = invitation.status === "expired";
  const full = sp.error === "full";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-semibold text-zinc-900">Invitation</h1>
        {event ? (
          <p className="mt-2 text-zinc-700">{formatAtlantaDateTime(event.startsAt)}</p>
        ) : null}
        {venue ? (
          <p className="mt-1 text-sm text-zinc-600">
            {venue.name} — {venue.streetAddress}
          </p>
        ) : null}
        <p className="mt-4 text-sm text-zinc-600">
          Paddles provided. 120 minutes: clinic, rotations, social close. No other
          person&apos;s name appears on this page.
        </p>

        {invitation.status === "invited" && !expired ? (
          <>
            {invitation.acceptanceDeadline ? (
              <p className="mt-4 text-sm font-medium text-zinc-800">
                RSVP by {formatAtlantaDateTime(invitation.acceptanceDeadline)}
              </p>
            ) : null}
            {full ? (
              <p className="mt-4 text-sm text-red-800">This night is now full.</p>
            ) : null}
            {sp.saved ? (
              <p className="mt-4 text-sm text-green-800">Your reply was saved.</p>
            ) : null}
            {!full && !sp.saved ? (
              <div className="mt-8 flex flex-wrap gap-3">
                <form action={respondInvitationAction}>
                  <input type="hidden" name="invitationId" value={invitation.id} />
                  <input type="hidden" name="response" value="accept" />
                  <button
                    type="submit"
                    className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white"
                  >
                    Accept invitation
                  </button>
                </form>
                <form action={respondInvitationAction}>
                  <input type="hidden" name="invitationId" value={invitation.id} />
                  <input type="hidden" name="response" value="decline" />
                  <button type="submit" className="rounded-md border px-4 py-2 text-sm">
                    Decline invitation
                  </button>
                </form>
              </div>
            ) : null}
          </>
        ) : null}

        {invitation.status === "accepted" ? (
          <>
            <p className="mt-6 text-sm text-zinc-800">
              You accepted. Confirm you are still coming (one tap).
            </p>
            {invitation.confirmationDeadline ? (
              <p className="mt-2 text-sm font-medium">
                Confirm by {formatAtlantaDateTime(invitation.confirmationDeadline)}
              </p>
            ) : null}
            {sp.error === "deadline_passed" ? (
              <p className="mt-4 text-sm text-red-800">
                The reconfirmation deadline passed. Your seat may have been released.
              </p>
            ) : null}
            {sp.confirmed ? (
              <p className="mt-4 text-sm text-green-800">You are confirmed for this night.</p>
            ) : (
            <form action={confirmReconfirmationAction} className="mt-4">
              <input type="hidden" name="invitationId" value={invitation.id} />
              <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white">
                Confirm attendance
              </button>
            </form>
            )}
          </>
        ) : null}

        {invitation.status === "confirmed" && !sp.confirmed ? (
          <p className="mt-6 text-sm text-green-800">
            You are confirmed for this night. Calendar updates stay held locally until email is
            enabled.
          </p>
        ) : null}

        {expired ? (
          <p className="mt-6 text-sm text-zinc-700">
            The deadline to RSVP has passed. This Invitation has closed.
          </p>
        ) : null}
      </main>
    </>
  );
}
