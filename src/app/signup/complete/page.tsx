import Link from "next/link";

import { LocalDevMagicLinkStub } from "@/components/local-dev-magic-link-stub";
import { SiteHeader } from "@/components/site-header";
import {
  MAGIC_LINK_RESEND_COPY,
  MAGIC_LINK_VALIDITY_COPY,
} from "@/lib/config/auth-copy";

export default function SignupCompletePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-lg flex-1 px-4 py-10">
        <h1 className="text-2xl font-semibold text-zinc-900">Check your email</h1>
        <p className="mt-3 text-zinc-700">
          If an account exists for that email, we sent a single-use sign-in link.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-zinc-700">
          <li>{MAGIC_LINK_VALIDITY_COPY}</li>
          <li>{MAGIC_LINK_RESEND_COPY}</li>
        </ul>
        <LocalDevMagicLinkStub />
        <Link href="/sign-in" className="mt-6 inline-block text-sm underline">
          Request another link
        </Link>
      </main>
    </>
  );
}
