"use client";

import { useState, type FormEvent } from "react";

type Status = "idle" | "saving" | "joined" | "invalid";

/**
 * The static GitHub Pages build has no server to store addresses. In that
 * build the form only shows the thank-you message. Local dev posts to the
 * API route so addresses reach the local update list.
 */
const STATIC_SITE = process.env.NEXT_PUBLIC_STATIC_SITE === "1";

export function UpdatesForm() {
  const [status, setStatus] = useState<Status>("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    if (STATIC_SITE) {
      setStatus("joined");
      return;
    }
    setStatus("saving");
    const response = await fetch("/api/updates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setStatus(response.ok ? "joined" : "invalid");
  }

  if (status === "joined") {
    return (
      <p
        role="status"
        className="mt-6 rounded-[7px] bg-white px-4 py-3 text-center text-sm text-ink"
      >
        {STATIC_SITE
          ? "Thanks. We'll be in touch when the site is ready."
          : "You're on the list. We'll email you when the site is ready."}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 w-full">
      <label htmlFor="updates-email" className="sr-only">
        Email for updates
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="updates-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@email.com"
          aria-invalid={status === "invalid" || undefined}
          className="min-w-0 flex-1 rounded-[7px] border border-zinc-300 bg-white px-3 py-3 text-ink placeholder:text-zinc-500"
        />
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded-[7px] bg-ink px-4 py-3 font-mono text-xs font-medium tracking-wide text-white uppercase hover:bg-zinc-800 disabled:opacity-60"
        >
          Get updates
        </button>
      </div>
      {status === "invalid" ? (
        <p role="alert" className="mt-2 text-center text-sm text-red-700">
          Enter an email address.
        </p>
      ) : null}
    </form>
  );
}
