import Link from "next/link";

import { UpdatesForm } from "@/components/updates-form";

const STATIC_SITE = process.env.NEXT_PUBLIC_STATIC_SITE === "1";

export default function LandingPage() {
  return (
    <main className="relative flex min-h-dvh flex-1 flex-col items-center justify-center overflow-x-clip px-6 py-16">
      <div className="flex w-full flex-col items-center text-[clamp(3.25rem,8.6vw,156px)]">
        <div className="relative w-screen">
          <p
            aria-hidden="true"
            className="pointer-events-none bg-gradient-to-b from-[#f0dec2] to-[#f8f0e2] bg-clip-text text-center font-black text-[1.85em] leading-[0.78] tracking-[-0.045em] whitespace-nowrap text-transparent select-none"
          >
            COMING SOON
          </p>
          <img
            src="/brand/hero.png"
            alt=""
            width={360}
            height={188}
            className="absolute bottom-0 left-1/2 z-10 h-auto w-[1.9em] max-w-none -translate-x-1/2 translate-y-[5%]"
          />
        </div>

        <div className="rise-in relative z-10 mt-[0.58em] w-full max-w-md">
          <div className="flex flex-col items-center text-base">
            <h1 className="text-center text-[30px] leading-none font-black text-ink">
              findyourpeeps
            </h1>
            <p className="mt-3 text-center font-mono text-xs font-medium tracking-wide text-gold uppercase">
              Good company. Great possibilities.
            </p>
            <p className="mt-6 text-center text-sm text-balance text-zinc-700">
              The site isn&apos;t open yet. Leave your email and we&apos;ll
              write when it is.
            </p>

            <UpdatesForm />

            <p className="mt-4 text-center text-sm text-zinc-600">
              Updates only. No account yet.
              {STATIC_SITE ? null : (
                <>
                  {" "}
                  <Link href="/privacy" className="underline hover:text-gold">
                    Privacy
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
