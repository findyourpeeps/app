import Link from "next/link";

import { getAuthProvider } from "@/lib/auth/local-auth-store";

/** Dev-only: surfaces the latest unused magic link for local verification. */
export function LocalDevMagicLinkStub() {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const pending = getAuthProvider()
    .getSnapshot()
    .magicLinks.filter((link) => !link.usedAt);
  const latest = pending.at(-1);
  if (!latest) {
    return null;
  }

  const href = `/auth/callback?token=${encodeURIComponent(latest.token)}`;

  return (
    <p className="mt-6 rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
      Local stub:{" "}
      <Link href={href} className="font-medium underline">
        Open magic link (callback)
      </Link>
    </p>
  );
}
