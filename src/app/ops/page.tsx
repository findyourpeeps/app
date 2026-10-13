import { readSessionCookie } from "@/lib/auth/session";
import { STAFF_ROLES, type AppRole } from "@/lib/auth/types";

export const instant = false;

const ROLE_LABELS: Record<AppRole, string> = {
  member: "Member",
  curation_lead: "Curation lead",
  event_lead: "Event lead",
  host: "Host",
  safety_owner: "Safety owner",
  community_lead: "Community lead",
};

export default async function OpsHomePage() {
  const session = await readSessionCookie();
  const staffRoles =
    session?.roles.filter((r) =>
      (STAFF_ROLES as readonly AppRole[]).includes(r),
    ) ?? [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs uppercase tracking-wide text-zinc-500">Operations</p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Staff shell</h1>
      <p className="mt-2 text-sm text-zinc-600">Staff tools (local stub).</p>
      <ul className="mt-4 space-y-2 text-sm underline">
        {staffRoles.includes("event_lead") ? (
          <>
            <li>
              <a href="/ops/venues">Venues</a>
            </li>
            <li>
              <a href="/ops/events">Events</a>
            </li>
          </>
        ) : null}
        {staffRoles.includes("curation_lead") ? (
          <li>
            <a href="/ops/events">Events & invite lists</a>
          </li>
        ) : null}
      </ul>
      <ul className="mt-6 space-y-2 text-sm text-zinc-800">
        {staffRoles.map((role) => (
          <li key={role} className="rounded-md border border-zinc-200 px-3 py-2">
            {ROLE_LABELS[role]} workspace (placeholder)
          </li>
        ))}
      </ul>
    </main>
  );
}
