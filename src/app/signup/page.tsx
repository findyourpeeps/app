import Link from "next/link";

import { signupAction } from "@/app/actions/auth";
import { SiteHeader } from "@/components/site-header";
import { AGE_REFUSAL_MESSAGE } from "@/lib/membership/age-gate";

export const instant = false;

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ refusal?: string; error?: string }>;
}) {
  const params = await searchParams;
  const showAgeRefusal = params.refusal === "age";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-lg flex-1 px-4 py-10">
        <h1 className="text-2xl font-semibold text-zinc-900">Sign up</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Ages 25–45. We use your email for a magic link—no password.
        </p>
        {showAgeRefusal ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          >
            {AGE_REFUSAL_MESSAGE}
          </p>
        ) : null}
        {params.error === "validation" ? (
          <p role="alert" className="mt-4 text-sm text-red-700">
            Fix the highlighted fields and try again.
          </p>
        ) : null}
        <form action={signupAction} className="mt-8 space-y-4">
          <label className="block text-sm font-medium text-zinc-800">
            First name
            <input
              name="chosenFirstName"
              required
              autoComplete="given-name"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            Age
            <input
              name="selfReportedAge"
              type="number"
              min={1}
              max={120}
              required
              inputMode="numeric"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            Home ZIP
            <input
              name="homeZip"
              required
              inputMode="numeric"
              pattern="[0-9]{5}"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            How did you hear about us?
            <input
              name="source"
              required
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            <p>
              Read the{" "}
              <Link href="/privacy" className="underline">
                privacy notice
              </Link>{" "}
              before you continue.
            </p>
            <label className="mt-3 flex items-start gap-2">
              <input
                name="noticeAcknowledged"
                type="checkbox"
                required
                className="mt-1"
              />
              <span>I have read the privacy notice.</span>
            </label>
          </div>
          <button
            type="submit"
            className="w-full rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Continue
          </button>
        </form>
      </main>
    </>
  );
}
