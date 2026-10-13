import { NextResponse } from "next/server";

import { readSessionCookie } from "@/lib/auth/session";
import { getLocalAuthStore } from "@/lib/auth/local-auth-store";
import { getAppStore } from "@/lib/product/app-store";

/** Dev-only: check in (optional) and complete an event to open follow-up. */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }
  const body = (await request.json()) as {
    eventId?: string;
    checkInAll?: boolean;
  };
  if (!body.eventId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const store = getAppStore();
  const session = await readSessionCookie();
  const actorAuthUserId = session?.authUserId ?? "dev-browser";
  const event = store.getEvent(body.eventId);
  if (!event) {
    return NextResponse.json({ ok: false, code: "missing_event" }, { status: 400 });
  }

  if (event.status === "completed") {
    return NextResponse.json({ ok: false, code: "already_completed" }, { status: 400 });
  }

  if (event.status !== "in_progress") {
    const confirmed = store.confirmedCount(body.eventId);
    const outcome =
      confirmed === 16 ? ("go" as const) : confirmed >= 12 ? ("smaller" as const) : null;
    if (!outcome) {
      return NextResponse.json({ ok: false, code: "need_confirmations" }, { status: 400 });
    }
    const decision = store.recordEventDecision({
      eventId: body.eventId,
      outcome,
      actorAuthUserId,
      reason: "dev_complete_event",
    });
    if (!decision.ok) {
      return NextResponse.json({ ok: false, code: decision.code }, { status: 400 });
    }
    const started = store.startEvent(body.eventId);
    if (!started.ok) {
      return NextResponse.json({ ok: false, code: started.code }, { status: 400 });
    }
  }

  if (body.checkInAll !== false) {
    for (const p of store.listParticipationsForEvent(body.eventId)) {
      if (p.status !== "expected") continue;
      store.markCheckedIn({
        participationId: p.id,
        actorAuthUserId,
      });
    }
  }

  const result = store.completeEvent(body.eventId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, code: result.code }, { status: 400 });
  }

  const auth = getLocalAuthStore();
  const participations = store.listParticipationsForEvent(body.eventId).map((p) => {
    const member = auth.getSnapshot().members.find((m) => m.id === p.memberId);
    const user = member
      ? auth.getSnapshot().authUsers.find((u) => u.id === member.authUserId)
      : null;
    return {
      memberId: p.memberId,
      email: user?.email ?? null,
      eventParticipantId: p.eventParticipantId,
      status: p.status,
    };
  });

  return NextResponse.json({
    ok: true,
    eventId: body.eventId,
    window: result.window,
    participations,
  });
}
