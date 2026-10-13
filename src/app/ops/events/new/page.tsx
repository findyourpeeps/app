import { connection } from "next/server";
import { redirect } from "next/navigation";

import { createEventAction } from "@/app/actions/ops";
import { readSessionCookie } from "@/lib/auth/session";
import { getAppStore } from "@/lib/product/app-store";

export const instant = false;

export default async function NewEventPage() {
  await connection();

  const session = await readSessionCookie();
  if (!session?.roles.includes("event_lead")) redirect("/ops");

  const venues = getAppStore().listVenues();
  const defaultStart = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold">New event</h1>
      <form action={createEventAction} className="mt-8 space-y-3">
        <label className="block text-sm">
          Venue
          <select name="venueId" required className="mt-1 w-full border px-2 py-1">
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Starts at (UTC)
          <input
            type="datetime-local"
            name="startsAt"
            defaultValue={defaultStart}
            required
            className="mt-1 w-full border px-2 py-1"
          />
        </label>
        <input type="hidden" name="audienceDescription" value="25-45 intown east singles" />
        <input type="hidden" name="host1AuthUserId" value={session.authUserId} />
        <input type="hidden" name="host2AuthUserId" value={session.authUserId} />
        <input type="hidden" name="coachAuthUserId" value={session.authUserId} />
        <button type="submit" className="rounded bg-zinc-900 px-3 py-2 text-sm text-white">
          Create draft event
        </button>
      </form>
    </main>
  );
}
