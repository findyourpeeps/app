import { beforeEach, describe, expect, it } from "vitest";

import { getLocalAuthStore } from "@/lib/auth/local-auth-store";
import type { SignupCommandInput } from "@/lib/auth/types";

const baseInput: SignupCommandInput = {
  chosenFirstName: "Alex",
  email: "alex@example.test",
  selfReportedAge: 30,
  homeZip: "30308",
  source: "friend",
  noticeAcknowledged: true,
};

function emptySnapshot(store: ReturnType<typeof getLocalAuthStore>) {
  const snap = store.getSnapshot();
  expect(snap.authUsers).toHaveLength(0);
  expect(snap.members).toHaveLength(0);
  expect(snap.roleGrants).toHaveLength(0);
  expect(snap.outbox).toHaveLength(0);
  expect(snap.audit).toHaveLength(0);
}

describe("S1 signup age gate", () => {
  beforeEach(() => {
    getLocalAuthStore().resetForTests();
  });

  it.each([17, 18, 24, 46])(
    "refuses age %i with nothing saved",
    (age) => {
      const store = getLocalAuthStore();
      const result = store.completeSignup({ ...baseInput, selfReportedAge: age });

      expect(result.ok).toBe(false);
      if (result.ok || result.code !== "age_refused") {
        throw new Error(`expected age_refused, got ${JSON.stringify(result)}`);
      }
      expect(result.message).toBe(
        "This event series is for ages 25-45. We didn't save anything.",
      );
      emptySnapshot(store);
    },
  );

  it("allows ages 25 and 45 through the short signup path", () => {
    const store = getLocalAuthStore();

    for (const age of [25, 45] as const) {
      store.resetForTests();
      const email = `member${age}@example.test`;
      const result = store.completeSignup({
        ...baseInput,
        email,
        selfReportedAge: age,
      });
      expect(result.ok).toBe(true);
      const snap = store.getSnapshot();
      expect(snap.authUsers).toHaveLength(1);
      expect(snap.members).toHaveLength(1);
      expect(snap.members[0]?.selfReportedAge).toBe(age);
      expect(snap.roleGrants.filter((g) => g.role === "member")).toHaveLength(1);
    }
  });

  it("issues a one-use magic link after accepted signup", () => {
    const store = getLocalAuthStore();
    const now = new Date("2026-10-13T12:00:00.000Z");
    const result = store.completeSignup(baseInput, now);
    expect(result.ok).toBe(true);

    const link = store.getSnapshot().magicLinks[0];
    expect(link).toBeDefined();
    const session = store.verifyMagicLink(link!.token, now);
    expect(session?.email).toBe("alex@example.test");

    const reused = store.verifyMagicLink(link!.token, now);
    expect(reused).toBeNull();
  });
});
