"use server";

import { redirect } from "next/navigation";

import { readSessionCookie } from "@/lib/auth/session";
import type { AppRole } from "@/lib/auth/types";
import { getAppStore } from "@/lib/product/app-store";

function requireRole(roles: AppRole[]) {
  return async () => {
    const session = await readSessionCookie();
    if (!session) redirect("/sign-in");
    const has = roles.some((r) => session.roles.includes(r));
    if (!has) redirect("/ops?denied=1");
    return session;
  };
}

export async function createVenueAction(formData: FormData) {
  const session = await requireRole(["event_lead"])();
  const store = getAppStore();
  store.upsertVenue({
    name: String(formData.get("name") ?? ""),
    area: "intown east",
    zip: String(formData.get("zip") ?? "30308"),
    streetAddress: String(formData.get("streetAddress") ?? ""),
    arrivalInstructions: String(formData.get("arrivalInstructions") ?? ""),
    accessibilityNotes: String(formData.get("accessibilityNotes") ?? ""),
    capacity: 16,
    courtCount: 3,
    isIndoorOrCovered: true,
    isActive: true,
    waiverNotes: String(formData.get("waiverNotes") ?? ""),
  });
  redirect("/ops/venues?saved=1");
}

export async function createEventAction(formData: FormData) {
  const session = await requireRole(["event_lead"])();
  const venueId = String(formData.get("venueId") ?? "");
  const startsAtRaw = String(formData.get("startsAt") ?? "");
  const startsAt = new Date(startsAtRaw);
  const store = getAppStore();
  const event = store.createEvent({
    venueId: venueId || null,
    startsAt,
    audienceDescription: String(formData.get("audienceDescription") ?? "25-45 intown east"),
    createdByAuthUserId: session.authUserId,
  });
  if ("error" in event) {
    redirect("/ops/events/new?error=minimum");
  }
  const host1 = String(formData.get("host1AuthUserId") ?? session.authUserId);
  const host2 = String(formData.get("host2AuthUserId") ?? session.authUserId);
  const coach = String(formData.get("coachAuthUserId") ?? session.authUserId);
  store.assignEventStaff({
    eventId: event.id,
    authUserId: session.authUserId,
    role: "event_lead",
    isCoach: false,
    removedAt: null,
  });
  store.assignEventStaff({
    eventId: event.id,
    authUserId: host1,
    role: "host",
    isCoach: false,
    removedAt: null,
  });
  store.assignEventStaff({
    eventId: event.id,
    authUserId: host2,
    role: "host",
    isCoach: false,
    removedAt: null,
  });
  store.assignEventStaff({
    eventId: event.id,
    authUserId: coach,
    role: "host",
    isCoach: true,
    removedAt: null,
  });
  redirect(`/ops/events/${event.id}?saved=1`);
}

export async function buildInviteListAction(formData: FormData) {
  await requireRole(["curation_lead"])();
  const eventId = String(formData.get("eventId") ?? "");
  const session = await readSessionCookie();
  const store = getAppStore();
  store.buildInviteList(eventId, session!.authUserId);
  redirect(`/ops/events/${eventId}/invite-list?built=1`);
}

export async function lockAndSendInvitationsAction(formData: FormData) {
  await requireRole(["curation_lead"])();
  const eventId = String(formData.get("eventId") ?? "");
  const store = getAppStore();
  if (!store.canTransitionToInviting(eventId)) {
    redirect(`/ops/events/${eventId}/invite-list?error=readiness`);
  }
  store.lockInviteList(eventId);
  store.sendInvitations(eventId, 16);
  redirect(`/ops/events/${eventId}/invite-list?sent=1`);
}

export async function recordEventDecisionAction(formData: FormData) {
  const session = await requireRole(["event_lead"])();
  const eventId = String(formData.get("eventId") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  if (
    outcome !== "go" &&
    outcome !== "smaller" &&
    outcome !== "rescheduled" &&
    outcome !== "canceled"
  ) {
    redirect(`/ops/events/${eventId}/decision?error=outcome`);
  }
  const result = getAppStore().recordEventDecision({
    eventId,
    outcome,
    actorAuthUserId: session.authUserId,
    reason: String(formData.get("reason") ?? "ops_decision"),
  });
  if (!result.ok) redirect(`/ops/events/${eventId}/decision?error=${result.code}`);
  redirect(`/ops/events/${eventId}?decision=1`);
}

export async function rescheduleEventAction(formData: FormData) {
  const session = await requireRole(["event_lead"])();
  const eventId = String(formData.get("eventId") ?? "");
  const startsAtRaw = String(formData.get("startsAt") ?? "");
  const result = getAppStore().rescheduleEvent({
    eventId,
    newStartsAt: new Date(startsAtRaw),
    actorAuthUserId: session.authUserId,
  });
  if (!result.ok) redirect(`/ops/events/${eventId}/decision?error=${result.code}`);
  redirect(`/ops/events/${eventId}?rescheduled=1`);
}

export async function markCheckedInAction(formData: FormData) {
  await requireRole(["event_lead", "host"])();
  const participationId = String(formData.get("participationId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  getAppStore().markCheckedIn({
    participationId,
    actorAuthUserId: (await readSessionCookie())!.authUserId,
  });
  redirect(`/ops/events/${eventId}/check-in?saved=1`);
}
