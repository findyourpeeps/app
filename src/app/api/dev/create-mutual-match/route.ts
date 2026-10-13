import { NextResponse } from "next/server";

import { getLocalAuthStore } from "@/lib/auth/local-auth-store";
import { getAppStore } from "@/lib/product/app-store";
import { participationEligibleForFollowUp } from "@/lib/product/event-lifecycle";

/** Dev-only: reciprocal private selections → mutual Connection for browser verification. */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }
  const body = (await request.json()) as { eventId?: string };
  if (!body.eventId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const store = getAppStore();
  const eligible = store
    .listParticipationsForEvent(body.eventId)
    .filter((p) => participationEligibleForFollowUp(p));
  if (eligible.length < 2) {
    return NextResponse.json({ ok: false, code: "need_two_checked_in" }, { status: 400 });
  }
  const [a, b] = eligible;
  const idA = a!.eventParticipantId;
  const idB = b!.eventParticipantId;
  if (!idA || !idB) {
    return NextResponse.json({ ok: false, code: "missing_event_ids" }, { status: 400 });
  }

  const selA = store.createPrivateSelection({
    eventId: body.eventId,
    selectorMemberId: a!.memberId,
    targetEventParticipantId: idB,
  });
  if (!selA.ok) {
    return NextResponse.json({ ok: false, code: selA.code }, { status: 400 });
  }
  const selB = store.createPrivateSelection({
    eventId: body.eventId,
    selectorMemberId: b!.memberId,
    targetEventParticipantId: idA,
  });
  if (!selB.ok) {
    return NextResponse.json({ ok: false, code: selB.code }, { status: 400 });
  }

  const connectionsA = store.listConnectionsForMember(a!.memberId);
  const connection = connectionsA.find(
    (c) =>
      (c.memberAId === a!.memberId && c.memberBId === b!.memberId) ||
      (c.memberBId === a!.memberId && c.memberAId === b!.memberId),
  );
  if (!connection) {
    return NextResponse.json({ ok: false, code: "no_connection" }, { status: 400 });
  }

  const auth = getLocalAuthStore();
  const memberEmail = (memberId: string) => {
    const member = auth.getSnapshot().members.find((m) => m.id === memberId);
    const user = member
      ? auth.getSnapshot().authUsers.find((u) => u.id === member.authUserId)
      : null;
    return user?.email ?? null;
  };

  const outboxHeld = store.getProductOutbox().every((row) => row.held);

  return NextResponse.json({
    ok: true,
    connectionId: connection.id,
    status: connection.status,
    memberA: { memberId: a!.memberId, email: memberEmail(a!.memberId) },
    memberB: { memberId: b!.memberId, email: memberEmail(b!.memberId) },
    outboxHeld,
  });
}
