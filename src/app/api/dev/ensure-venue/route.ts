import { NextResponse } from "next/server";

import { getAppStore } from "@/lib/product/app-store";

/** Dev-only: ensure a test venue exists for browser verification. */
export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }
  const store = getAppStore();
  const existing = store.listVenues()[0];
  if (existing) {
    return NextResponse.json({ ok: true, venueId: existing.id, created: false });
  }
  const venue = store.upsertVenue({
    name: "QA Courts",
    area: "intown east",
    zip: "30308",
    streetAddress: "1 Test St",
    arrivalInstructions: "Front desk",
    accessibilityNotes: "Step-free",
    capacity: 16,
    courtCount: 3,
    isIndoorOrCovered: true,
    isActive: true,
    waiverNotes: "Signed on site",
  });
  return NextResponse.json({ ok: true, venueId: venue.id, created: true });
}
