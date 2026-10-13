import type { VerifiedSession } from "@/lib/auth/types";

export function parseSessionCookieValue(
  raw: string | undefined,
): VerifiedSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as VerifiedSession;
    if (!parsed.authUserId || !parsed.email || !Array.isArray(parsed.roles)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
