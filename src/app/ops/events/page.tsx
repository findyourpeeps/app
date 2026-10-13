import Link from "next/link";
import { redirect } from "next/navigation";

import { readSessionCookie } from "@/lib/auth/session";
import { getAppStore } from "@/lib/product/app-store";

export const instant = false;

export default async function OpsEventsPage() {
  const session = await readSessionCookie();
  if (!session?.roles.includes("event_lead") && !session?.roles.includes("curation_lead")) {
    redirect("/ops");
  }

  const events = getAppStore().listEvents();

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Events</h1>
      <Link href="/ops/events/new" className="mt-4 inline-block text-sm underline">
        New event
      </Link>
      <ul className="mt-6 space-y-2 text-sm">
        {events.map((e) => (
          <li key={e.id}>
            <Link href={`/ops/events/${e.id}`} className="underline">
              {e.status} — {e.startsAt.slice(0, 10)}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
