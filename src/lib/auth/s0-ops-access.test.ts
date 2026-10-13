import { describe, expect, it } from "vitest";

import { canAccessOpsRoutes } from "@/lib/auth/ops-access";
import type { VerifiedSession } from "@/lib/auth/types";

describe("S0 /ops route isolation", () => {
  it("denies plain members without a staff grant", () => {
    const memberSession: VerifiedSession = {
      authUserId: "user-1",
      email: "member@example.test",
      memberId: "member-1",
      roles: ["member"],
    };
    expect(canAccessOpsRoutes(null)).toBe(false);
    expect(canAccessOpsRoutes(memberSession)).toBe(false);
  });

  it("allows staff roles to reach /ops", () => {
    const hostSession: VerifiedSession = {
      authUserId: "user-2",
      email: "host@example.test",
      memberId: null,
      roles: ["host"],
    };
    expect(canAccessOpsRoutes(hostSession)).toBe(true);
  });
});
