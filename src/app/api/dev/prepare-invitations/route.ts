import { NextResponse } from "next/server";

import { readSessionCookie } from "@/lib/auth/session";
import { getAppStore } from "@/lib/product/app-store";

/** Dev-only: build invite list and send invitations for browser verification. */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }
  const body = (await request.json()) as { eventId?: string };
  if (!body.eventId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const session = await readSessionCookie();
  const actorAuthUserId = session?.authUserId ?? "dev-browser";
  const store = getAppStore();
  store.buildInviteList(body.eventId, actorAuthUserId);
  if (!store.canTransitionToInviting(body.eventId)) {
    return NextResponse.json({ ok: false, code: "readiness" }, { status: 400 });
  }
  store.lockInviteList(body.eventId);
  store.sendInvitations(body.eventId, 16);
  return NextResponse.json({ ok: true, eventId: body.eventId });
}
