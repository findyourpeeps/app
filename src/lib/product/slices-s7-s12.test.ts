import { beforeEach, describe, expect, it } from "vitest";

import { getLocalAuthStore } from "@/lib/auth/local-auth-store";
import { resetAllStoresForTests, getAppStore } from "@/lib/product/app-store";
import { atlantaDateKey, computeEventBoundaries } from "@/lib/product/event-timing";

function signupMember(email: string, age = 30) {
  const auth = getLocalAuthStore();
  const now = new Date("2026-10-13T12:00:00.000Z");
  const result = auth.completeSignup(
    {
      chosenFirstName: "Test",
      email,
      selfReportedAge: age,
      homeZip: "30308",
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

function staffEventWithInvites(count: number, startsAt: Date) {
  const store = getAppStore();
  const now = new Date("2026-10-01T12:00:00.000Z");
  const { authUserId } = signupMember("lead@example.test");
  store.seedSyntheticMembers(count + 5, now, atlantaDateKey(startsAt));
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
  for (const role of ["event_lead", "host", "host"] as const) {
    store.assignEventStaff({
      eventId: event.id,
      authUserId,
      role,
      isCoach: role === "host" && false,
      removedAt: null,
    });
  }
  store.assignEventStaff({
    eventId: event.id,
    authUserId,
    role: "host",
    isCoach: true,
    removedAt: null,
  });
  store.buildInviteList(event.id, authUserId, now);
  store.lockInviteList(event.id, now);
  store.sendInvitations(event.id, count, now);
  return { store, event, authUserId, now };
}

function confirmN(store: ReturnType<typeof getAppStore>, eventId: string, n: number) {
  const invitations = store.listInvitationsForEvent(eventId);
  for (const inv of invitations.slice(0, n)) {
    store.respondInvitation({
      invitationId: inv.id,
      memberId: inv.memberId,
      response: "accept",
      now: new Date("2026-10-02T12:00:00.000Z"),
    });
    store.confirmReconfirmation({
      invitationId: inv.id,
      memberId: inv.memberId,
      now: new Date("2026-10-02T13:00:00.000Z"),
    });
  }
}

describe("S7 reconfirmation and decisions", () => {
  beforeEach(() => resetAllStoresForTests());

  it("reconciliation is idempotent at E-72h and E-48h release", () => {
    const startsAt = new Date("2026-10-25T23:00:00.000Z");
    const { store, event } = staffEventWithInvites(16, startsAt);
    const invited = store.listInvitationsForEvent(event.id).filter((i) => i.status === "invited");
    for (const inv of invited.slice(0, 14)) {
      store.respondInvitation({
        invitationId: inv.id,
        memberId: inv.memberId,
        response: "accept",
        now: new Date("2026-10-02T12:00:00.000Z"),
      });
    }
    const at72 = new Date(computeEventBoundaries(startsAt).e72h);
    store.runEventBoundaryReconciliation(at72);
    store.runEventBoundaryReconciliation(at72);
    const reconfirmRows = store
      .getProductOutbox()
      .filter((o) => o.kind === "reconfirm_request");
    expect(reconfirmRows).toHaveLength(14);

    const at48 = new Date(computeEventBoundaries(startsAt).e48h);
    store.runEventBoundaryReconciliation(at48);
    const released = store
      .listInvitationsForEvent(event.id)
      .filter((i) => i.status === "released");
    expect(released.length).toBe(14);
    store.runEventBoundaryReconciliation(at48);
    expect(store.getProductOutbox().filter((o) => o.kind === "seat_released")).toHaveLength(14);
  });

  it("go requires 16 confirmed; 11 confirmed allows only reschedule or cancel", () => {
    const startsAt = new Date("2026-10-25T23:00:00.000Z");
    const { store, event, authUserId } = staffEventWithInvites(16, startsAt);
    const invited = store.listInvitationsForEvent(event.id);
    for (const inv of invited.slice(0, 11)) {
      store.respondInvitation({
        invitationId: inv.id,
        memberId: inv.memberId,
        response: "accept",
        now: new Date("2026-10-02T12:00:00.000Z"),
      });
      store.confirmReconfirmation({
        invitationId: inv.id,
        memberId: inv.memberId,
        now: new Date("2026-10-02T13:00:00.000Z"),
      });
    }
    expect(store.recordEventDecision({
      eventId: event.id,
      outcome: "go",
      actorAuthUserId: authUserId,
      reason: "test",
    }).ok).toBe(false);
    expect(store.recordEventDecision({
      eventId: event.id,
      outcome: "smaller",
      actorAuthUserId: authUserId,
      reason: "test",
    }).ok).toBe(false);
    expect(
      store.recordEventDecision({
        eventId: event.id,
        outcome: "rescheduled",
        actorAuthUserId: authUserId,
        reason: "thin",
      }).ok,
    ).toBe(true);
  });

  it("material reschedule returns confirmed invitations to invited", () => {
    const startsAt = new Date("2026-10-25T23:00:00.000Z");
    const { store, event, authUserId } = staffEventWithInvites(4, startsAt);
    const inv = store.listInvitationsForEvent(event.id)[0]!;
    store.respondInvitation({
      invitationId: inv.id,
      memberId: inv.memberId,
      response: "accept",
      now: new Date("2026-10-02T12:00:00.000Z"),
    });
    store.confirmReconfirmation({
      invitationId: inv.id,
      memberId: inv.memberId,
      now: new Date("2026-10-02T13:00:00.000Z"),
    });
    expect(store.getInvitation(inv.id)!.status).toBe("confirmed");
    const newStart = new Date("2026-11-01T23:00:00.000Z");
    store.rescheduleEvent({
      eventId: event.id,
      newStartsAt: newStart,
      actorAuthUserId: authUserId,
      now: new Date("2026-10-03T12:00:00.000Z"),
    });
    const updated = store.getInvitation(inv.id)!;
    expect(updated.status).toBe("invited");
    expect(updated.confirmedAt).toBeNull();
    expect(store.getEvent(event.id)!.status).toBe("inviting");
    const reaccept = store.respondInvitation({
      invitationId: inv.id,
      memberId: inv.memberId,
      response: "accept",
      now: new Date("2026-10-03T13:00:00.000Z"),
    });
    expect(reaccept.ok).toBe(true);
  });
});

describe("S8 check-in", () => {
  beforeEach(() => resetAllStoresForTests());

  it("refuses absent mark before start plus 60 minutes", () => {
    const startsAt = new Date("2026-10-25T23:00:00.000Z");
    const { store, event, authUserId } = staffEventWithInvites(16, startsAt);
    confirmN(store, event.id, 12);
    const participation = store.listParticipationsForEvent(event.id)[0]!;
    store.recordEventDecision({
      eventId: event.id,
      outcome: "smaller",
      actorAuthUserId: authUserId,
      reason: "test",
    });
    store.startEvent(event.id, startsAt);
    const early = store.markAbsent({
      participationId: participation.id,
      now: new Date(startsAt.getTime() + 30 * 60 * 1000),
    });
    expect(early.ok).toBe(false);
    const late = store.markAbsent({
      participationId: participation.id,
      now: new Date(startsAt.getTime() + 61 * 60 * 1000),
    });
    expect(late.ok).toBe(true);
  });
});

describe("S9–S10 follow-up and connection", () => {
  beforeEach(() => resetAllStoresForTests());

  it("private selection and reciprocal connection with 72h lapse", () => {
    const startsAt = new Date("2026-10-25T23:00:00.000Z");
    const { store, event, authUserId } = staffEventWithInvites(16, startsAt);
    confirmN(store, event.id, 12);
    store.recordEventDecision({
      eventId: event.id,
      outcome: "smaller",
      actorAuthUserId: authUserId,
      reason: "test",
    });
    store.startEvent(event.id, startsAt);
    const parts = store.listParticipationsForEvent(event.id);
    for (const p of parts) {
      store.markCheckedIn({
        participationId: p.id,
        actorAuthUserId: authUserId,
        now: startsAt,
      });
    }
    const end = new Date(startsAt.getTime() + 120 * 60 * 1000);
    store.completeEvent(event.id, end);
    const [a, b] = parts;
    const idA = a!.eventParticipantId!;
    const idB = b!.eventParticipantId!;
    store.createPrivateSelection({
      eventId: event.id,
      selectorMemberId: a!.memberId,
      targetEventParticipantId: idB,
      now: end,
    });
    store.createPrivateSelection({
      eventId: event.id,
      selectorMemberId: b!.memberId,
      targetEventParticipantId: idA,
      now: end,
    });
    const connections = store.listConnectionsForMember(a!.memberId);
    expect(connections).toHaveLength(1);
    const conn = connections[0]!;
    store.authorizeConnection({
      connectionId: conn.id,
      memberId: a!.memberId,
      contactField: "verified_email",
      now: end,
    });
    expect(conn.status).toBe("awaiting_authorization");
    const lapseAt = new Date(new Date(conn.mutualNotifiedAt).getTime() + 73 * 60 * 60 * 1000);
    store.runConnectionDeadlineJobs(lapseAt);
    expect(conn.status).toBe("lapsed");
  });
});

describe("S11–S12 safety and deletion", () => {
  beforeEach(() => resetAllStoresForTests());

  it("block prevents connection release", () => {
    const startsAt = new Date("2026-10-25T23:00:00.000Z");
    const { store, event, authUserId } = staffEventWithInvites(16, startsAt);
    confirmN(store, event.id, 12);
    store.recordEventDecision({
      eventId: event.id,
      outcome: "smaller",
      actorAuthUserId: authUserId,
      reason: "test",
    });
    store.startEvent(event.id, startsAt);
    const parts = store.listParticipationsForEvent(event.id);
    for (const p of parts) {
      store.markCheckedIn({
        participationId: p.id,
        actorAuthUserId: authUserId,
        now: startsAt,
      });
    }
    const end = new Date(startsAt.getTime() + 120 * 60 * 1000);
    store.completeEvent(event.id, end);
    const [a, b] = parts;
    store.createPrivateSelection({
      eventId: event.id,
      selectorMemberId: a!.memberId,
      targetEventParticipantId: b!.eventParticipantId!,
      now: end,
    });
    store.createPrivateSelection({
      eventId: event.id,
      selectorMemberId: b!.memberId,
      targetEventParticipantId: a!.eventParticipantId!,
      now: end,
    });
    store.createMemberBlock({
      creatorMemberId: a!.memberId,
      targetEventParticipantId: b!.eventParticipantId!,
      eventId: event.id,
      now: end,
    });
    const conn = store.listConnectionsForMember(a!.memberId)[0]!;
    store.authorizeConnection({
      connectionId: conn.id,
      memberId: a!.memberId,
      contactField: "verified_email",
      now: end,
    });
    store.authorizeConnection({
      connectionId: conn.id,
      memberId: b!.memberId,
      contactField: "verified_email",
      now: end,
    });
    expect(conn.status).not.toBe("released");
  });

  it("deletion request can cancel; purge retains incident reports", () => {
    const { member, now } = signupMember("del@example.test");
    const store = getAppStore();
    expect(store.requestDeletion(member.id, now).ok).toBe(true);
    expect(store.cancelDeletionRequest(member.id, now).ok).toBe(true);
    expect(store.requestDeletion(member.id, now).ok).toBe(true);
    const submitted = store.submitIncidentReport({
      reporterMemberId: member.id,
      eventId: null,
      involvedEventParticipantId: null,
      narrative: "synthetic concern",
      now,
    });
    expect(submitted.ok).toBe(true);
    expect(store.getIncidentReportForSafetyOwner(submitted.reportId)).not.toBeNull();
    expect(store.processMemberDeletion(member.id, now).ok).toBe(true);
    expect(store.getIncidentReportForSafetyOwner(submitted.reportId)).not.toBeNull();
    expect(getLocalAuthStore().findMemberByAuthUserId(member.authUserId)).toBeNull();
  });
});
