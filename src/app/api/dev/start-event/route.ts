import { NextResponse } from "next/server";

import { readSessionCookie } from "@/lib/auth/session";
import { getAppStore } from "@/lib/product/app-store";

/** Dev-only: transition a go/smaller event to in_progress for verification. */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }
  const session = await readSessionCookie();
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = (await request.json()) as { eventId?: string };
  if (!body.eventId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const result = getAppStore().startEvent(body.eventId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, code: result.code }, { status: 400 });
  }
  return NextResponse.json({ ok: true, status: result.event.status });
}
