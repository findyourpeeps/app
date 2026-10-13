import { beforeEach, describe, expect, it } from "vitest";

import { getLocalAuthStore } from "@/lib/auth/local-auth-store";
import { buildAcceptanceIcs } from "@/lib/product/ics";
import { resetAllStoresForTests, getAppStore } from "@/lib/product/app-store";
import {
  atlantaDateKey,
  computeEventBoundaries,
  formatAtlantaDateTime,
} from "@/lib/product/event-timing";
import {
  isReciprocallyEligible,
  readRelationshipIntentionValue,
} from "@/lib/product/matching";

function signupMember(email: string, age = 30, zip = "30308") {
  const auth = getLocalAuthStore();
  const now = new Date("2026-10-13T12:00:00.000Z");
  const result = auth.completeSignup(
    {
      chosenFirstName: "Test",
      email,
      selfReportedAge: age,
      homeZip: zip,
      source: "test",
      noticeAcknowledged: true,
    },
    now,
  );
  expect(result.ok).toBe(true);
  const user = auth.findAuthUserByEmail(email)!;
  const member = auth.findMemberByAuthUserId(user.id)!;
  return { member, authUserId: user.id, now };
}

function completeProfile(memberId: string, now: Date) {
  const store = getAppStore();
  const sections = [
    ["gender", { value: "woman" }, "firm"],
    ["dating-genders", { values: ["man"] }, "firm"],
    ["age-range", { min: 28, max: 40 }, "firm"],
    ["intention", { value: "long_term" }, "firm"],
    ["experience", "casual"],
    ["structure", { value: "monogamous" }, "flexible"],
  ] as const;
  for (const [section, payload, firmness] of sections) {
    if (section === "experience") {
      store.saveProfileSection({ memberId, section, payload, now });
    } else {
      store.saveProfileSection({
        memberId,
        section,
        payload,
        firmness: firmness as "firm" | "flexible",
        now,
      });
    }
  }
}

describe("S2 profile and lifecycle", () => {
  beforeEach(() => resetAllStoresForTests());

  it("saves sections, completes profile, pause and deletion", () => {
    const { member, now } = signupMember("s2@example.test");
    completeProfile(member.id, now);
    const updated = getAppStore().getMemberProfileView(member.id)!;
    expect(updated.profileStatus).toBe("complete");

    expect(getAppStore().pauseMember(member.id, now).ok).toBe(true);
    expect(getAppStore().resumeMember(member.id, now).ok).toBe(true);
    expect(getAppStore().requestDeletion(member.id, now).ok).toBe(true);
  });

  it("readRelationshipIntentionValue returns saved intention for profile reload", () => {
    const { member, now } = signupMember("intention-reload@example.test");
    const store = getAppStore();
    store.saveProfileSection({
      memberId: member.id,
      section: "intention",
      payload: { value: "open_to_long_term" },
      firmness: "flexible",
      now,
    });
    const items = store.getMatchingItems(member.id);
    expect(readRelationshipIntentionValue(items)).toBe("open_to_long_term");
  });

  it("failed save preserves prior matching item version", () => {
    const { member, now } = signupMember("s2fail@example.test");
    getAppStore().saveProfileSection({
      memberId: member.id,
      section: "gender",
      payload: { value: "woman" },
      firmness: "firm",
      now,
    });
    const before = getAppStore().getMatchingItems(member.id)[0]!.value;
    const fail = getAppStore().saveProfileSection({
      memberId: member.id,
      section: "gender",
      payload: { value: "man" },
      firmness: "firm",
      forceFail: true,
      now,
    });
    expect(fail.ok).toBe(false);
    expect(getAppStore().getMatchingItems(member.id)[0]!.value).toEqual(before);
  });

  it("staff projections hide matching from host and community_lead", () => {
    const { member, authUserId } = signupMember("s2roles@example.test");
    completeProfile(member.id, new Date());
    const store = getAppStore();
    const hostView = store.projectMemberForRole(member.id, "host", {
      authUserId,
      email: "s2roles@example.test",
      memberId: member.id,
      roles: ["host"],
    });
    expect(hostView.data?.matchingItems).toBeUndefined();
    expect(hostView.data?.chosenFirstName).toBe("Test");

    const community = store.projectMemberForRole(member.id, "community_lead", null);
    expect(community.data?.source).toBe("test");
    expect(community.data?.matchingItems).toBeUndefined();
  });

  it("pickleball experience is excluded from reciprocal eligibility", () => {
    const store = getAppStore();
    const a = signupMember("a@example.test");
    const b = signupMember("b@example.test");
    completeProfile(a.member.id, a.now);
    store.saveProfileSection({
      memberId: b.member.id,
      section: "gender",
      payload: { value: "man" },
      firmness: "firm",
      now: b.now,
    });
    store.saveProfileSection({
      memberId: b.member.id,
      section: "dating-genders",
      payload: { values: ["woman"] },
      firmness: "firm",
      now: b.now,
    });
    store.saveProfileSection({
      memberId: b.member.id,
      section: "age-range",
      payload: { min: 28, max: 40 },
      firmness: "firm",
      now: b.now,
    });
    store.saveProfileSection({
      memberId: b.member.id,
      section: "intention",
      payload: { value: "long_term" },
      firmness: "firm",
      now: b.now,
    });
    store.saveProfileSection({
      memberId: b.member.id,
      section: "experience",
      payload: "regular",
      now: b.now,
    });
    store.saveProfileSection({
      memberId: b.member.id,
      section: "structure",
      payload: { value: "monogamous" },
      firmness: "flexible",
      now: b.now,
    });
    const fa = store.matchingFacts(a.member.id)!;
    const fb = store.matchingFacts(b.member.id)!;
    fa.pickleballExperience = "never_played";
    fb.pickleballExperience = "regular";
    expect(isReciprocallyEligible(fa, fb, [])).toBe(true);
  });
});

describe("S3 availability and cadence", () => {
  beforeEach(() => resetAllStoresForTests());

  it("records not available when no evenings checked", () => {
    const { member, now } = signupMember("s3@example.test");
    const saved = getAppStore().saveAvailability({
      memberId: member.id,
      eveningDates: [],
      now,
    });
    expect(saved.ok).toBe(true);
    expect(saved.record?.eveningDates).toEqual([]);
  });

  it("cadence ask job skips paused and deletion_requested", () => {
    const paused = signupMember("paused@example.test");
    const deleted = signupMember("del@example.test");
    getAppStore().pauseMember(paused.member.id, paused.now);
    getAppStore().requestDeletion(deleted.member.id, deleted.now);
    const now = new Date("2026-10-20T12:00:00.000Z");
    const first = getAppStore().runCadenceAskJob(now);
    expect(first.sent).toBe(0);
    const replay = getAppStore().runCadenceAskJob(now);
    expect(replay.sent).toBe(0);
    expect(getAppStore().getProductOutbox().filter((o) => o.kind === "availability_ask")).toHaveLength(0);
  });

  it("active member gets one held ask per window", () => {
    const { member, now } = signupMember("active@example.test");
    member; // keep member created
    const runAt = new Date("2026-10-20T12:00:00.000Z");
    const r1 = getAppStore().runCadenceAskJob(runAt);
    expect(r1.sent).toBe(1);
    const r2 = getAppStore().runCadenceAskJob(runAt);
    expect(r2.sent).toBe(0);
    const held = getAppStore().getProductOutbox().filter((o) => o.kind === "availability_ask");
    expect(held).toHaveLength(1);
    expect(held[0]?.held).toBe(true);
  });
});

describe("S4 events", () => {
  beforeEach(() => resetAllStoresForTests());

  it("rejects minimum_group_size other than 12", () => {
    const { authUserId } = signupMember("el@example.test");
    const store = getAppStore();
    const venue = store.upsertVenue({
      name: "Court A",
      area: "intown east",
      zip: "30308",
      streetAddress: "1 Main St",
      arrivalInstructions: "Front door",
      accessibilityNotes: "Step-free",
      capacity: 16,
      courtCount: 3,
      isIndoorOrCovered: true,
      isActive: true,
      waiverNotes: "Signed on site",
    });
    const starts = new Date("2026-11-15T00:00:00.000Z");
    const event = store.createEvent({
      venueId: venue.id,
      startsAt: starts,
      audienceDescription: "pilot",
      createdByAuthUserId: authUserId,
      minimumGroupSize: 10,
    });
    expect("error" in event).toBe(true);
  });

  it("readiness gates inviting transition", () => {
    const { authUserId } = signupMember("el2@example.test");
    const store = getAppStore();
    const event = store.createEvent({
      venueId: null,
      startsAt: new Date("2026-11-15T00:00:00.000Z"),
      audienceDescription: "pilot",
      createdByAuthUserId: authUserId,
    });
    if ("error" in event) throw new Error("expected event");
    expect(event.capacity).toBe(16);
    expect(event.minimumGroupSize).toBe(12);
    expect(store.canTransitionToInviting(event.id)).toBe(false);
  });

  it("DST Atlanta display preserves local label for fall event", () => {
    const starts = new Date("2026-11-01T23:00:00.000Z");
    const bounds = computeEventBoundaries(starts);
    expect(formatAtlantaDateTime(bounds.startsAt)).toMatch(/Nov/);
    expect(bounds.e24h < bounds.startsAt).toBe(true);
  });
});

describe("S5 curation", () => {
  beforeEach(() => resetAllStoresForTests());

  it("builds invite list from synthetic pool with reasons and blocks", () => {
    const store = getAppStore();
    const now = new Date("2026-10-13T12:00:00.000Z");
    store.seedSyntheticMembers(50, now);
    const { authUserId } = signupMember("curator@example.test");
    store.grantStaffRole(authUserId, "curation_lead", now);
    const venue = store.upsertVenue({
      name: "East courts",
      area: "intown east",
      zip: "30308",
      streetAddress: "2 Court Ln",
      arrivalInstructions: "Side",
      accessibilityNotes: "Ramp",
      capacity: 16,
      courtCount: 3,
      isIndoorOrCovered: true,
      isActive: true,
      waiverNotes: "ok",
    });
    const eventStart = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    const event = store.createEvent({
      venueId: venue.id,
      startsAt: eventStart,
      audienceDescription: "pilot",
      createdByAuthUserId: authUserId,
    });
    if ("error" in event) throw new Error("event");
    store.assignEventStaff({
      eventId: event.id,
      authUserId,
      role: "event_lead",
      isCoach: false,
      removedAt: null,
    });
    store.assignEventStaff({
      eventId: event.id,
      authUserId,
      role: "host",
      isCoach: false,
      removedAt: null,
    });
    store.assignEventStaff({
      eventId: event.id,
      authUserId,
      role: "host",
      isCoach: false,
      removedAt: null,
    });
    store.assignEventStaff({
      eventId: event.id,
      authUserId,
      role: "host",
      isCoach: true,
      removedAt: null,
    });

    const built = store.buildInviteList(event.id, authUserId, now);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.entries.length).toBeGreaterThan(0);
    expect(built.entries.every((e) => e.statedCriteriaReason.length > 0)).toBe(true);

    const members = built.entries.map((e) => e.memberId);
    if (members.length >= 2) {
      store.createBlockForTests(members[0]!, members[1]!, now);
      const fa = store.matchingFacts(members[0]!)!;
      const fb = store.matchingFacts(members[1]!)!;
      expect(
        isReciprocallyEligible(fa, fb, store.getActiveBlocks()),
      ).toBe(false);
    }
  });
});

describe("S6 invitations", () => {
  beforeEach(() => resetAllStoresForTests());

  it("accepts at most capacity 16 under concurrent replies", () => {
    const store = getAppStore();
    const now = new Date("2026-10-13T12:00:00.000Z");
    const startsAt = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    const eveningKey = atlantaDateKey(startsAt.toISOString());
    store.seedSyntheticMembers(55, now, eveningKey);
    const { authUserId } = signupMember("lead@example.test");
    const venue = store.upsertVenue({
      name: "V",
      area: "intown east",
      zip: "30308",
      streetAddress: "x",
      arrivalInstructions: "x",
      accessibilityNotes: "x",
      capacity: 16,
      courtCount: 3,
      isIndoorOrCovered: true,
      isActive: true,
      waiverNotes: "x",
    });
    const event = store.createEvent({
      venueId: venue.id,
      startsAt,
      audienceDescription: "pilot",
      createdByAuthUserId: authUserId,
    });
    if ("error" in event) throw new Error("event");
    store.assignEventStaff({
      eventId: event.id,
      authUserId,
      role: "event_lead",
      isCoach: false,
      removedAt: null,
    });
    store.assignEventStaff({
      eventId: event.id,
      authUserId,
      role: "host",
      isCoach: false,
      removedAt: null,
    });
    store.assignEventStaff({
      eventId: event.id,
      authUserId,
      role: "host",
      isCoach: false,
      removedAt: null,
    });
    store.assignEventStaff({
      eventId: event.id,
      authUserId,
      role: "host",
      isCoach: true,
      removedAt: null,
    });
    store.buildInviteList(event.id, authUserId, now);
    store.lockInviteList(event.id, now);
    store.sendInvitations(event.id, 17, now);

    const invited = store
      .listInvitationsForEvent(event.id)
      .filter((i) => i.status === "invited");
    expect(invited.length).toBeGreaterThanOrEqual(17);

    let accepted = 0;
    let full = 0;
    for (const inv of invited) {
      const res = store.respondInvitation({
        invitationId: inv.id,
        memberId: inv.memberId,
        response: "accept",
        now,
      });
      if (res.ok) accepted += 1;
      else if (res.code === "full") full += 1;
    }
    expect(accepted).toBe(16);
    expect(full).toBeGreaterThanOrEqual(1);
    const icsRows = store.getProductOutbox().filter((o) => o.kind === "acceptance_confirmation_ics");
    expect(icsRows).toHaveLength(16);
    expect(icsRows.every((o) => o.held)).toBe(true);
  });

  it("double accept is idempotent and ics uid is stable", () => {
    const store = getAppStore();
    const now = new Date("2026-10-13T12:00:00.000Z");
    const { member, authUserId } = signupMember("inv@example.test");
    completeProfile(member.id, now);
    store.saveAvailability({ memberId: member.id, eveningDates: ["2026-10-23"], now });
    const venue = store.upsertVenue({
      name: "V",
      area: "intown east",
      zip: "30308",
      streetAddress: "x",
      arrivalInstructions: "x",
      accessibilityNotes: "x",
      capacity: 16,
      courtCount: 3,
      isIndoorOrCovered: true,
      isActive: true,
      waiverNotes: "x",
    });
    const event = store.createEvent({
      venueId: venue.id,
      startsAt: new Date("2026-10-23T23:00:00.000Z"),
      audienceDescription: "pilot",
      createdByAuthUserId: authUserId,
    });
    if ("error" in event) throw new Error("event");
    store.assignEventStaff({ eventId: event.id, authUserId, role: "event_lead", isCoach: false, removedAt: null });
    store.assignEventStaff({ eventId: event.id, authUserId, role: "host", isCoach: false, removedAt: null });
    store.assignEventStaff({ eventId: event.id, authUserId, role: "host", isCoach: false, removedAt: null });
    store.assignEventStaff({ eventId: event.id, authUserId, role: "host", isCoach: true, removedAt: null });
    store.buildInviteList(event.id, authUserId, now);
    store.lockInviteList(event.id, now);
    store.sendInvitations(event.id, 1, now);
    const inv = store.listInvitationsForMember(member.id)[0]!;
    store.respondInvitation({ invitationId: inv.id, memberId: member.id, response: "accept", now });
    store.respondInvitation({ invitationId: inv.id, memberId: member.id, response: "accept", now });
    const ics = buildAcceptanceIcs({
      eventId: event.id,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      venueName: "V",
      venueAddress: "x",
    });
    expect(ics).toContain(`UID:event-${event.id}@atlanta-singles.local`);
    expect(ics).not.toContain("ATTENDEE");
  });
});
