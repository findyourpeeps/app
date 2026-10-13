import { NextResponse } from "next/server";

import { getUpdateList } from "@/lib/updates/update-list";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
  } | null;
  const result = getUpdateList().add(String(body?.email ?? ""));
  if (!result.ok) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
