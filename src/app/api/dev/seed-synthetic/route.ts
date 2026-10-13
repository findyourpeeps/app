import { NextResponse } from "next/server";

import { getAppStore } from "@/lib/product/app-store";

/** Dev-only: seed synthetic members for curation / event browser verification. */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }
  const body = (await request.json()) as {
    count?: number;
    eveningDateKey?: string;
  };
  const count = Math.min(Math.max(body.count ?? 24, 1), 80);
  getAppStore().seedSyntheticMembers(count, new Date(), body.eveningDateKey);
  return NextResponse.json({ ok: true, count });
}
