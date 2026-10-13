import { NextResponse } from "next/server";

import { readSessionCookie, writeSessionCookie } from "@/lib/auth/session";
import type { AppRole } from "@/lib/auth/types";
import { getLocalAuthStore } from "@/lib/auth/local-auth-store";

const ALLOWED: AppRole[] = [
  "curation_lead",
  "event_lead",
  "host",
  "community_lead",
];

/** Dev-only: grant a staff role to the current session for browser verification. */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }
  const session = await readSessionCookie();
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = (await request.json()) as { role?: AppRole };
  if (!body.role || !ALLOWED.includes(body.role)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const authStore = getLocalAuthStore();
  authStore.grantRoleForTests(session.authUserId, body.role);
  await writeSessionCookie(
    authStore.buildSession(session.authUserId, session.email),
  );
  return NextResponse.json({ ok: true, role: body.role });
}
