import { NextResponse } from "next/server";

import { getAppStore } from "@/lib/product/app-store";

/** Dev-only: accept and confirm invitations for browser verification. */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }
  const body = (await request.json()) as { eventId?: string; count?: number };
  if (!body.eventId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const count = Math.min(Math.max(body.count ?? 16, 1), 16);
  const store = getAppStore();
  const now = new Date();
  const invitations = store
    .listInvitationsForEvent(body.eventId)
    .filter((i) => i.status === "invited")
    .slice(0, count);
  let confirmed = 0;
  for (const inv of invitations) {
    const accept = store.respondInvitation({
      invitationId: inv.id,
      memberId: inv.memberId,
      response: "accept",
      now,
    });
    if (!accept.ok) continue;
    const confirm = store.confirmReconfirmation({
      invitationId: inv.id,
      memberId: inv.memberId,
      now,
    });
    if (confirm.ok) confirmed += 1;
  }
  return NextResponse.json({ ok: true, confirmed });
}
