import { redirect } from "next/navigation";

import { createVenueAction } from "@/app/actions/ops";
import { readSessionCookie } from "@/lib/auth/session";
import { getAppStore } from "@/lib/product/app-store";

export const instant = false;

export default async function OpsVenuesPage() {
  const session = await readSessionCookie();
  if (!session?.roles.includes("event_lead")) redirect("/ops");

  const venues = getAppStore().listVenues();

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Venues</h1>
      <ul className="mt-6 space-y-2 text-sm">
        {venues.map((v) => (
          <li key={v.id} className="rounded border px-3 py-2">
            {v.name} ({v.courtCount} courts)
          </li>
        ))}
      </ul>
      <form action={createVenueAction} className="mt-10 space-y-3">
        <h2 className="font-medium">Add venue</h2>
        <input name="name" placeholder="Name" required className="w-full border px-2 py-1" />
        <input name="streetAddress" placeholder="Address" required className="w-full border px-2 py-1" />
        <input name="zip" defaultValue="30308" className="w-full border px-2 py-1" />
        <textarea name="arrivalInstructions" placeholder="Arrival" required className="w-full border px-2 py-1" />
        <textarea name="accessibilityNotes" placeholder="Step-free access" required className="w-full border px-2 py-1" />
        <input name="waiverNotes" placeholder="Waiver notes" className="w-full border px-2 py-1" />
        <button type="submit" className="rounded bg-zinc-900 px-3 py-2 text-sm text-white">
          Save venue
        </button>
      </form>
    </main>
  );
}
