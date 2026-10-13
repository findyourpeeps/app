import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="bg-cream">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <Link
          href="/"
          className="font-black text-xl tracking-tight text-ink"
          aria-label="Find Your Peeps"
        >
          findyourpeeps
        </Link>
        <nav className="flex items-center gap-4 font-mono text-xs uppercase tracking-wide">
          <Link href="/sign-in" className="text-ink hover:text-gold">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-[7px] bg-ink px-3 py-2 text-white hover:bg-zinc-800"
          >
            Sign up
          </Link>
        </nav>
      </div>
    </header>
  );
}
