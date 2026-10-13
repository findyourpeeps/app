import { beforeEach, describe, expect, it } from "vitest";

import { getLocalAuthStore } from "@/lib/auth/local-auth-store";
import { getUpdateList } from "@/lib/updates/update-list";

describe("coming-soon update list", () => {
  beforeEach(() => {
    getUpdateList().resetForTests();
    getLocalAuthStore().resetForTests();
  });

  it("saves a normalized email and does not create a member", () => {
    const result = getUpdateList().add("  Ada@Example.Test ");
    expect(result).toEqual({ ok: true, already: false });
    expect(getUpdateList().list().map((row) => row.email)).toEqual(["ada@example.test"]);
    expect(getLocalAuthStore().getSnapshot().members).toHaveLength(0);
    expect(getLocalAuthStore().getSnapshot().outbox).toHaveLength(0);
  });

  it("treats a repeat address as already on the list", () => {
    getUpdateList().add("ada@example.test");
    const again = getUpdateList().add("Ada@Example.test");
    expect(again).toEqual({ ok: true, already: true });
    expect(getUpdateList().list()).toHaveLength(1);
  });

  it("rejects an address that is not an email", () => {
    expect(getUpdateList().add("not-an-email")).toEqual({ ok: false, code: "invalid" });
    expect(getUpdateList().list()).toHaveLength(0);
  });
});
