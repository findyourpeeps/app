import { requestSignInLinkAction } from "@/app/actions/auth";
import { SiteHeader } from "@/components/site-header";
import {
  MAGIC_LINK_RESEND_COPY,
  MAGIC_LINK_VALIDITY_COPY,
} from "@/lib/config/auth-copy";

export default function SignInPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-lg flex-1 px-4 py-10">
        <h1 className="text-2xl font-semibold text-zinc-900">Sign in</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Enter your email for a single-use magic link. No password.
        </p>
        <form action={requestSignInLinkAction} className="mt-8 space-y-4">
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
          <button
            type="submit"
            className="w-full rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Send sign-in link
          </button>
        </form>
        <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-zinc-700">
          <li>{MAGIC_LINK_VALIDITY_COPY}</li>
          <li>{MAGIC_LINK_RESEND_COPY}</li>
        </ul>
      </main>
    </>
  );
}
