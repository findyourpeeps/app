import { cookies } from "next/headers";

import { parseSessionCookieValue } from "@/lib/auth/session-cookie";
import type { VerifiedSession } from "@/lib/auth/types";

export const SESSION_COOKIE_NAME = "atl_singles_session";

export async function readSessionCookie(): Promise<VerifiedSession | null> {
  const jar = await cookies();
  return parseSessionCookieValue(jar.get(SESSION_COOKIE_NAME)?.value);
}

export async function writeSessionCookie(session: VerifiedSession): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE_NAME);
}
