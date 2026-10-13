import { NextResponse } from "next/server";

import { getLocalAuthStore } from "@/lib/auth/local-auth-store";
import { getAppStore } from "@/lib/product/app-store";

/** Dev-only: set synthetic members' availability to one evening for curation tests. */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }
  const body = (await request.json()) as { eveningDateKey?: string };
  if (!body.eveningDateKey) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const auth = getLocalAuthStore();
  const store = getAppStore();
  const now = new Date();
  let updated = 0;
  for (const member of auth.getSnapshot().members) {
    const user = auth.getSnapshot().authUsers.find((u) => u.id === member.authUserId);
    if (!user?.email.endsWith("@example.test")) continue;
    store.saveAvailability({
      memberId: member.id,
      eveningDates: [body.eveningDateKey],
      now,
    });
    updated += 1;
  }
  return NextResponse.json({ ok: true, updated, eveningDateKey: body.eveningDateKey });
}
