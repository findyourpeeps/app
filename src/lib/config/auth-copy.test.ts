import { describe, expect, it } from "vitest";

import {
  MAGIC_LINK_RESEND_COOLDOWN_SECONDS,
  MAGIC_LINK_RESEND_COPY,
  MAGIC_LINK_VALIDITY_COPY,
  MAGIC_LINK_VALIDITY_HOURS,
} from "@/lib/config/auth-copy";

describe("S1 magic-link copy constants", () => {
  it("pins 1 hour validity and 60 second resend cooldown", () => {
    expect(MAGIC_LINK_VALIDITY_HOURS).toBe(1);
    expect(MAGIC_LINK_RESEND_COOLDOWN_SECONDS).toBe(60);
    expect(MAGIC_LINK_VALIDITY_COPY).toMatch(/1 hour/i);
    expect(MAGIC_LINK_RESEND_COPY).toMatch(/60 seconds/i);
  });
});
