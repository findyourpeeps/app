import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

export type UpdateSignup = {
  email: string;
  signedUpAt: string;
};

type AddResult =
  | { ok: true; already: boolean }
  | { ok: false; code: "invalid" };

function dataFilePath() {
  return path.join(process.cwd(), "data", "update-signups.json");
}

function persistEnabled() {
  return process.env.VITEST !== "true";
}

export function normalizeUpdateEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return null;
  }
  return email;
}

/**
 * Coming-soon update list. This is not a Member account and it does not send mail.
 */
export class UpdateList {
  private signups = new Map<string, UpdateSignup>();

  add(raw: string, now = new Date()): AddResult {
    const email = normalizeUpdateEmail(raw);
    if (!email) return { ok: false, code: "invalid" };
    const already = this.signups.has(email);
    if (!already) {
      this.signups.set(email, { email, signedUpAt: now.toISOString() });
      this.persist();
    }
    return { ok: true, already };
  }

  list(): UpdateSignup[] {
    return [...this.signups.values()];
  }

  loadFromDisk() {
    if (!persistEnabled()) return;
    try {
      const raw = readFileSync(dataFilePath(), "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      for (const row of parsed) {
        if (!row || typeof row !== "object") continue;
        const email = normalizeUpdateEmail(String((row as UpdateSignup).email ?? ""));
        const signedUpAt = String((row as UpdateSignup).signedUpAt ?? "");
        if (email && signedUpAt) this.signups.set(email, { email, signedUpAt });
      }
    } catch {
      // No file yet.
    }
  }

  resetForTests() {
    this.signups.clear();
  }

  private persist() {
    if (!persistEnabled()) return;
    const file = dataFilePath();
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(this.list(), null, 2));
  }
}

let list: UpdateList | null = null;

export function getUpdateList() {
  if (!list) {
    list = new UpdateList();
    list.loadFromDisk();
  }
  return list;
}
