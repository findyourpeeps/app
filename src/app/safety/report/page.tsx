import { redirect } from "next/navigation";

import { submitIncidentReportAction } from "@/app/actions/member";
import { SiteHeader } from "@/components/site-header";
import { readSessionCookie } from "@/lib/auth/session";

export const instant = false;

export default async function SafetyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await readSessionCookie();
  if (!session?.memberId) redirect("/sign-in");

  const sp = await searchParams;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-semibold">Private report</h1>
        <p className="mt-2 text-sm text-zinc-600">
          This goes to the safety owner only. It is not the same as optional feedback.
        </p>
        {sp.saved ? (
          <p className="mt-4 text-sm text-green-800">
            Report received. If you need immediate help, use the safety contact in your email.
          </p>
        ) : null}
        {sp.error === "short" ? (
          <p className="mt-4 text-sm text-red-800">Add a bit more detail so we can help.</p>
        ) : null}
        <form action={submitIncidentReportAction} className="mt-8 space-y-3">
          <label className="block text-sm">
            What happened?
            <textarea
              name="narrative"
              required
              minLength={10}
              rows={6}
              className="mt-1 block w-full rounded border px-2 py-1"
            />
          </label>
          <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white">
            Submit report
          </button>
        </form>
      </main>
    </>
  );
}
