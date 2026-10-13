import { randomUUID } from "node:crypto";

import { getLocalAuthStore } from "@/lib/auth/local-auth-store";
import type { AppRole, MemberRecord, VerifiedSession } from "@/lib/auth/types";
import {
  atlantaDateKey,
  computeEventBoundaries,
  currentAvailabilityWindow,
} from "@/lib/product/event-timing";
import {
  edgeKey,
  graphCoveragePasses,
  isReciprocallyEligible,
  intentionIsEligible,
  type MemberMatchingFacts,
} from "@/lib/product/matching";
import {
  CONNECTION_AUTH_MS,
  CONNECTION_REMINDER_MS,
  FOLLOW_UP_WINDOW_MS,
  NO_SHOW_GUARD_MS,
  REPLY_DEADLINE_MS,
  applyMaterialTimeChangeToInvitation,
  canRescheduleEvent,
  canonicalMemberPair,
  connectionReleaseBlocked,
  eventStatusAfterMaterialChange,
  findReciprocalSelection,
  invitationsPastGoNoGo,
  pairBlocked,
  participationEligibleForFollowUp,
  validateEventDecision,
} from "@/lib/product/event-lifecycle";
import type {
  AvailabilityRecord,
  BlockRecord,
  ConnectionRecord,
  CourtRotationAssignment,
  EventBoundaryJobState,
  EventDecisionOutcome,
  EventDecisionRecord,
  EventRecord,
  EventStaffRecord,
  FeedbackRecord,
  FollowUpWindowRecord,
  IncidentReportRecord,
  InvitationRecord,
  InviteListEntryRecord,
  InviteListRecord,
  MatchingItemRecord,
  MatchingItemKind,
  ParticipationRecord,
  PickleballExperience,
  PrivateSelectionRecord,
  ProductOutboxRow,
  ProfileSectionId,
  VenueRecord,
  CadenceAskRecord,
} from "@/lib/product/types";

const PROFILE_SECTIONS: ProfileSectionId[] = [
  "gender",
  "dating-genders",
  "age-range",
  "intention",
  "experience",
  "structure",
];

const SECTION_KIND: Record<
  ProfileSectionId,
  MatchingItemKind | "pickleball_experience"
> = {
  gender: "gender_identity",
  "dating-genders": "dating_gender",
  "age-range": "desired_age_range",
  intention: "relationship_intention",
  experience: "pickleball_experience",
  structure: "relationship_structure",
};

class AppStore {
  private matchingItems = new Map<string, MatchingItemRecord>();
  private availability = new Map<string, AvailabilityRecord>();
  private cadenceAsks: CadenceAskRecord[] = [];
  private venues = new Map<string, VenueRecord>();
  private events = new Map<string, EventRecord>();
  private eventStaff: EventStaffRecord[] = [];
  private inviteLists = new Map<string, InviteListRecord>();
  private inviteEntries: InviteListEntryRecord[] = [];
  private invitations = new Map<string, InvitationRecord>();
  private participations: ParticipationRecord[] = [];
  private blocks: BlockRecord[] = [];
  private productOutbox: ProductOutboxRow[] = [];
  private memberCadenceAnchor = new Map<string, string>();
  private boundaryJobs = new Map<string, EventBoundaryJobState>();
  private eventDecisions: EventDecisionRecord[] = [];
  private followUpWindows = new Map<string, FollowUpWindowRecord>();
  private privateSelections: PrivateSelectionRecord[] = [];
  private connections: ConnectionRecord[] = [];
  private feedback: FeedbackRecord[] = [];
  private incidentReports: IncidentReportRecord[] = [];

  resetForTests(): void {
    getLocalAuthStore().resetForTests();
    this.matchingItems.clear();
    this.availability.clear();
    this.cadenceAsks = [];
    this.venues.clear();
    this.events.clear();
    this.eventStaff = [];
    this.inviteLists.clear();
    this.inviteEntries = [];
    this.invitations.clear();
    this.participations = [];
    this.blocks = [];
    this.productOutbox = [];
    this.memberCadenceAnchor.clear();
    this.boundaryJobs.clear();
    this.eventDecisions = [];
    this.followUpWindows.clear();
    this.privateSelections = [];
    this.connections = [];
    this.feedback = [];
    this.incidentReports = [];
  }

  getProductOutbox(): ProductOutboxRow[] {
    return [...this.productOutbox];
  }

  touchMemberActivity(memberId: string, now: Date): void {
    const auth = getLocalAuthStore();
    const member = [...auth.getSnapshot().members].find((m) => m.id === memberId);
    if (!member) return;
    member.lastMemberActivityAt = now.toISOString();
  }

  private memberById(memberId: string): MemberRecord | null {
    return (
      getLocalAuthStore()
        .getSnapshot()
        .members.find((m) => m.id === memberId) ?? null
    );
  }

  private itemsForMember(memberId: string): MatchingItemRecord[] {
    return [...this.matchingItems.values()].filter(
      (i) => i.memberId === memberId && i.isActive,
    );
  }

  sectionProgress(
    member: MemberRecord,
    items: MatchingItemRecord[],
  ): Record<ProfileSectionId, "not_started" | "in_progress" | "done"> {
    const progress = {} as Record<
      ProfileSectionId,
      "not_started" | "in_progress" | "done"
    >;
    for (const section of PROFILE_SECTIONS) {
      if (section === "experience") {
        progress[section] = member.pickleballExperience ? "done" : "not_started";
        continue;
      }
      const kind = SECTION_KIND[section] as MatchingItemKind;
      const row = items.find((i) => i.kind === kind);
      progress[section] = row ? "done" : "not_started";
    }
    return progress;
  }

  recomputeProfileComplete(memberId: string, now: Date): void {
    const member = this.memberById(memberId);
    if (!member) return;
    const items = this.itemsForMember(memberId);
    const progress = this.sectionProgress(member, items);
    const allDone = PROFILE_SECTIONS.every((s) => progress[s] === "done");
    const intentionOk = intentionIsEligible(items);
    if (allDone && intentionOk) {
      member.profileStatus = "complete";
      member.profileCompletedAt = now.toISOString();
    } else {
      member.profileStatus = "draft";
      member.profileCompletedAt = null;
    }
  }

  saveProfileSection(input: {
    memberId: string;
    section: ProfileSectionId;
    payload: unknown;
    firmness?: "firm" | "flexible";
    now?: Date;
    forceFail?: boolean;
  }):
    | { ok: true }
    | { ok: false; code: "validation"; message: string }
    | { ok: false; code: "save_failed"; message: string } {
    const now = input.now ?? new Date();
    const member = this.memberById(input.memberId);
    if (!member || member.status === "deletion_requested") {
      return { ok: false, code: "validation", message: "Not allowed." };
    }

    if (input.forceFail) {
      return {
        ok: false,
        code: "save_failed",
        message: "We couldn't save this section. Earlier sections are saved.",
      };
    }

    if (input.section === "age-range") {
      const range = input.payload as { min?: number; max?: number };
      if (
        typeof range.min !== "number" ||
        typeof range.max !== "number" ||
        range.min > range.max ||
        range.min < 18 ||
        range.max > 99
      ) {
        return {
          ok: false,
          code: "validation",
          message: "Enter an age range where the minimum is not above the maximum.",
        };
      }
    }

    if (input.section === "intention") {
      const value = (input.payload as { value?: string }).value;
      if (value !== "long_term" && value !== "open_to_long_term") {
        return {
          ok: false,
          code: "validation",
          message: "Choose a relationship intention we invite for.",
        };
      }
    }

    if (input.section === "experience") {
      const exp = input.payload as PickleballExperience;
      if (!["never_played", "casual", "regular"].includes(exp)) {
        return { ok: false, code: "validation", message: "Choose an experience level." };
      }
      member.pickleballExperience = exp;
      this.touchMemberActivity(member.id, now);
      this.recomputeProfileComplete(member.id, now);
      return { ok: true };
    }

    const kind = SECTION_KIND[input.section] as MatchingItemKind;
    const firmness = input.firmness ?? "flexible";
    const existing = [...this.matchingItems.values()].find(
      (i) => i.memberId === input.memberId && i.kind === kind && i.itemKey === "primary",
    );
    const record: MatchingItemRecord = {
      id: existing?.id ?? randomUUID(),
      memberId: input.memberId,
      kind,
      itemKey: "primary",
      value: input.payload,
      firmness,
      isActive: true,
      displayOrder: 0,
      updatedAt: now.toISOString(),
    };
    this.matchingItems.set(record.id, record);
    this.touchMemberActivity(member.id, now);
    this.recomputeProfileComplete(member.id, now);
    return { ok: true };
  }

  getMemberProfileView(memberId: string): MemberRecord | null {
    return this.memberById(memberId);
  }

  getMatchingItems(memberId: string): MatchingItemRecord[] {
    return this.itemsForMember(memberId);
  }

  setCadence(memberId: string, cadence: "weekly" | "every_other_week", now = new Date()) {
    const member = this.memberById(memberId);
    if (!member) return { ok: false as const, code: "not_found" as const };
    member.availabilityCadence = cadence;
    this.touchMemberActivity(memberId, now);
    return { ok: true as const };
  }

  pauseMember(memberId: string, now = new Date()) {
    const member = this.memberById(memberId);
    if (!member || member.status !== "active") {
      return { ok: false as const, code: "invalid_state" as const };
    }
    member.status = "paused";
    member.pausedAt = now.toISOString();
    this.touchMemberActivity(memberId, now);
    return { ok: true as const };
  }

  resumeMember(memberId: string, now = new Date()) {
    const member = this.memberById(memberId);
    if (!member || member.status !== "paused") {
      return { ok: false as const, code: "invalid_state" as const };
    }
    member.status = "active";
    member.pausedAt = null;
    this.memberCadenceAnchor.set(memberId, now.toISOString());
    this.touchMemberActivity(memberId, now);
    return { ok: true as const };
  }

  requestDeletion(memberId: string, now = new Date()) {
    const member = this.memberById(memberId);
    if (!member) return { ok: false as const };
    member.status = "deletion_requested";
    member.deletionRequestedAt = now.toISOString();
    this.touchMemberActivity(memberId, now);
    return { ok: true as const };
  }

  cancelDeletionRequest(memberId: string, now = new Date()) {
    const member = this.memberById(memberId);
    if (!member || member.status !== "deletion_requested") {
      return { ok: false as const, code: "invalid_state" as const };
    }
    member.status = "active";
    member.deletionRequestedAt = null;
    this.touchMemberActivity(memberId, now);
    return { ok: true as const };
  }

  projectMemberForRole(
    memberId: string,
    role: AppRole,
    session: VerifiedSession | null,
  ): { allowed: boolean; data: Record<string, unknown> | null } {
    const member = this.memberById(memberId);
    if (!member) return { allowed: false, data: null };

    switch (role) {
      case "host":
      case "event_lead":
        return {
          allowed: true,
          data: { chosenFirstName: member.chosenFirstName },
        };
      case "community_lead":
        return {
          allowed: true,
          data: {
            chosenFirstName: member.chosenFirstName,
            source: member.source,
            status: member.status,
            createdAt: member.createdAt,
          },
        };
      case "curation_lead":
        return {
          allowed: true,
          data: {
            chosenFirstName: member.chosenFirstName,
            profileStatus: member.profileStatus,
            matchingItems: this.itemsForMember(memberId),
            invitable: this.isMemberInvitable(memberId),
          },
        };
      case "member":
        if (session?.memberId !== memberId) return { allowed: false, data: null };
        return {
          allowed: true,
          data: {
            ...member,
            matchingItems: this.itemsForMember(memberId),
          },
        };
      case "safety_owner":
        return { allowed: false, data: null };
      default: {
        const _exhaustive: never = role;
        return _exhaustive;
      }
    }
  }

  matchingFacts(memberId: string): MemberMatchingFacts | null {
    const member = this.memberById(memberId);
    if (!member) return null;
    return {
      memberId: member.id,
      selfReportedAge: member.selfReportedAge,
      profileStatus: member.profileStatus,
      status: member.status,
      isInServiceArea: member.isInServiceArea,
      pickleballExperience: member.pickleballExperience,
      items: this.itemsForMember(memberId),
    };
  }

  isMemberInvitable(memberId: string, eventDateKey?: string): boolean {
    const facts = this.matchingFacts(memberId);
    if (!facts) return false;
    if (facts.status !== "active") return false;
    if (facts.profileStatus !== "complete") return false;
    if (!facts.isInServiceArea) return false;
    if (!intentionIsEligible(facts.items)) return false;
    if (eventDateKey && !this.availabilityCoversEvening(memberId, eventDateKey)) {
      return false;
    }
    return true;
  }

  currentAvailability(memberId: string, now = new Date()): AvailabilityRecord | null {
    const window = currentAvailabilityWindow(now);
    return (
      [...this.availability.values()]
        .filter((a) => a.memberId === memberId && !a.withdrawnAt)
        .find(
          (a) =>
            new Date(a.startsAt).getTime() === window.startsAt.getTime() &&
            new Date(a.expiresAt).getTime() >= now.getTime(),
        ) ?? null
    );
  }

  availabilityCoversEvening(memberId: string, dateKey: string): boolean {
    const row = [...this.availability.values()].find(
      (a) =>
        a.memberId === memberId &&
        !a.withdrawnAt &&
        new Date(a.expiresAt).getTime() > Date.now(),
    );
    if (!row) return false;
    return row.eveningDates.includes(dateKey);
  }

  saveAvailability(input: {
    memberId: string;
    eveningDates: string[];
    now?: Date;
    forceFail?: boolean;
  }) {
    const now = input.now ?? new Date();
    const member = this.memberById(input.memberId);
    if (!member) return { ok: false as const, code: "not_found" as const };
    if (member.status === "paused") {
      return { ok: false as const, code: "paused" as const };
    }
    if (member.status === "deletion_requested") {
      return { ok: false as const, code: "deletion_requested" as const };
    }
    if (input.forceFail) {
      return { ok: false as const, code: "save_failed" as const };
    }

    const window = currentAvailabilityWindow(now);
    const existing = this.currentAvailability(input.memberId, now);
    const record: AvailabilityRecord = {
      id: existing?.id ?? randomUUID(),
      memberId: input.memberId,
      startsAt: window.startsAt.toISOString(),
      endsAt: window.endsAt.toISOString(),
      timezone: "America/New_York",
      expiresAt: window.expiresAt.toISOString(),
      withdrawnAt: null,
      eveningDates: input.eveningDates,
      createdAt: existing?.createdAt ?? now.toISOString(),
      updatedAt: now.toISOString(),
    };
    this.availability.set(record.id, record);
    this.touchMemberActivity(input.memberId, now);
    return { ok: true as const, record };
  }

  runCadenceAskJob(now: Date): { sent: number; skipped: number } {
    let sent = 0;
    let skipped = 0;
    const auth = getLocalAuthStore();
    for (const member of auth.getSnapshot().members) {
      if (member.status !== "active") {
        skipped += 1;
        continue;
      }
      const due = this.isCadenceDue(member, now);
      if (!due) {
        skipped += 1;
        continue;
      }
      const window = currentAvailabilityWindow(now);
      const key = `${member.id}:${window.startsAt.toISOString()}`;
      const duplicate = this.cadenceAsks.some((a) => a.idempotencyKey === key);
      if (duplicate) {
        skipped += 1;
        continue;
      }
      this.cadenceAsks.push({
        id: randomUUID(),
        memberId: member.id,
        windowStartsAt: window.startsAt.toISOString(),
        windowEndsAt: window.endsAt.toISOString(),
        sentAt: now.toISOString(),
        idempotencyKey: key,
      });
      this.productOutbox.push({
        id: randomUUID(),
        kind: "availability_ask",
        held: true,
        idempotencyKey: key,
        memberId: member.id,
        createdAt: now.toISOString(),
        metadataRedacted: { template: "availability_ask_v1" },
      });
      sent += 1;
    }
    return { sent, skipped };
  }

  private isCadenceDue(member: MemberRecord, now: Date): boolean {
    const anchorIso =
      this.memberCadenceAnchor.get(member.id) ?? member.createdAt;
    const anchor = new Date(anchorIso);
    const days = (now.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000);
    if (member.availabilityCadence === "weekly") return days >= 7 || days < 1;
    return days >= 14 || days < 1;
  }

  upsertVenue(input: Omit<VenueRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }, now = new Date()) {
    const id = input.id ?? randomUUID();
    const existing = this.venues.get(id);
    const record: VenueRecord = {
      ...input,
      id,
      createdAt: existing?.createdAt ?? now.toISOString(),
      updatedAt: now.toISOString(),
    };
    this.venues.set(id, record);
    return record;
  }

  listVenues(): VenueRecord[] {
    return [...this.venues.values()];
  }

  createEvent(input: {
    venueId: string | null;
    startsAt: Date;
    audienceDescription: string;
    createdByAuthUserId: string;
    minimumGroupSize?: number;
  }): EventRecord | { error: string } {
    if (input.minimumGroupSize !== undefined && input.minimumGroupSize !== 12) {
      return { error: "minimum_group_size must be 12" };
    }
    const bounds = computeEventBoundaries(input.startsAt);
    const event: EventRecord = {
      id: randomUUID(),
      venueId: input.venueId,
      status: "draft",
      audienceDescription: input.audienceDescription,
      startsAt: bounds.startsAt,
      endsAt: bounds.endsAt,
      timezone: "America/New_York",
      capacity: 16,
      minimumGroupSize: 12,
      courtCount: 3,
      decisionDueAt: bounds.e24h,
      createdByAuthUserId: input.createdByAuthUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.events.set(event.id, event);
    return event;
  }

  assignEventStaff(row: Omit<EventStaffRecord, "id"> & { id?: string }) {
    const record: EventStaffRecord = {
      id: row.id ?? randomUUID(),
      ...row,
    };
    this.eventStaff.push(record);
    return record;
  }

  eventReadiness(eventId: string): { ok: boolean; reasons: string[] } {
    const event = this.events.get(eventId);
    if (!event) return { ok: false, reasons: ["missing_event"] };
    const reasons: string[] = [];
    if (!event.venueId) reasons.push("missing_venue");
    const staff = this.eventStaff.filter(
      (s) => s.eventId === eventId && !s.removedAt,
    );
    const hosts = staff.filter((s) => s.role === "host");
    const coaches = staff.filter((s) => s.isCoach);
    const leads = staff.filter((s) => s.role === "event_lead");
    if (leads.length < 1) reasons.push("missing_event_lead");
    if (hosts.length < 2) reasons.push("missing_hosts");
    if (coaches.length < 1) reasons.push("missing_coach");
    return { ok: reasons.length === 0, reasons };
  }

  canTransitionToInviting(eventId: string): boolean {
    return this.eventReadiness(eventId).ok;
  }

  getEvent(eventId: string): EventRecord | null {
    return this.events.get(eventId) ?? null;
  }

  listEvents(): EventRecord[] {
    return [...this.events.values()];
  }

  /** Test-only block helper (S5). */
  createBlockForTests(creatorMemberId: string, blockedMemberId: string, now = new Date()) {
    const row: BlockRecord = {
      id: randomUUID(),
      creatorMemberId,
      blockedMemberId,
      status: "active",
      source: "member",
      createdAt: now.toISOString(),
    };
    this.blocks.push(row);
    return row;
  }

  buildInviteList(eventId: string, createdByAuthUserId: string, now = new Date()) {
    const event = this.events.get(eventId);
    if (!event) return { ok: false as const, code: "missing_event" as const };
    const eventDateKey = atlantaDateKey(event.startsAt);
    const auth = getLocalAuthStore();
    const candidates = auth
      .getSnapshot()
      .members.filter((m) => this.isMemberInvitable(m.id, eventDateKey))
      .sort((a, b) => a.id.localeCompare(b.id));

    const list: InviteListRecord = {
      id: randomUUID(),
      eventId,
      status: "draft",
      targetCapacity: 16,
      lockedAt: null,
      createdByAuthUserId,
      lastCheckedAt: now.toISOString(),
      createdAt: now.toISOString(),
    };
    this.inviteLists.set(list.id, list);

    const entries: InviteListEntryRecord[] = [];
    let position = 1;
    for (const member of candidates) {
      const avail = [...this.availability.values()].find(
        (a) =>
          a.memberId === member.id &&
          !a.withdrawnAt &&
          a.eveningDates.includes(eventDateKey),
      );
      if (!avail) continue;
      entries.push({
        id: randomUUID(),
        inviteListId: list.id,
        memberId: member.id,
        qualifyingAvailabilityId: avail.id,
        position,
        statedCriteriaReason:
          "Reciprocal firm criteria and availability for this evening.",
        disposition: "eligible",
        recheckReasonCode: null,
        lastRecheckedAt: null,
      });
      position += 1;
    }
    this.inviteEntries.push(...entries);
    return { ok: true as const, list, entries };
  }

  lockInviteList(eventId: string, now = new Date()) {
    const list = [...this.inviteLists.values()].find((l) => l.eventId === eventId);
    if (!list) return { ok: false as const };
    list.status = "locked";
    list.lockedAt = now.toISOString();
    return { ok: true as const, list };
  }

  coverageForEntries(memberIds: string[]): boolean {
    const blocks = this.blocks;
    const facts = memberIds
      .map((id) => this.matchingFacts(id))
      .filter((f): f is MemberMatchingFacts => f !== null);
    const edges = new Set<string>();
    for (let i = 0; i < facts.length; i += 1) {
      for (let j = i + 1; j < facts.length; j += 1) {
        const a = facts[i]!;
        const b = facts[j]!;
        if (isReciprocallyEligible(a, b, blocks)) {
          edges.add(edgeKey(a.memberId, b.memberId));
        }
      }
    }
    return graphCoveragePasses(memberIds, edges);
  }

  sendInvitations(eventId: string, limit: number, now = new Date()) {
    const event = this.events.get(eventId);
    const list = [...this.inviteLists.values()].find(
      (l) => l.eventId === eventId && l.status === "locked",
    );
    if (!event || !list) return { ok: false as const, code: "not_ready" as const };

    const entries = this.inviteEntries
      .filter((e) => e.inviteListId === list.id && e.disposition === "eligible")
      .sort((a, b) => a.position - b.position);

    let sent = 0;
    for (const entry of entries) {
      if (sent >= limit) break;
      if (!this.isMemberInvitable(entry.memberId, atlantaDateKey(event.startsAt))) {
        entry.disposition = "held_recheck_failed";
        entry.recheckReasonCode = "member_no_longer_invitable";
        entry.lastRecheckedAt = now.toISOString();
        continue;
      }
      const idempotencyKey = `invitation:${eventId}:${entry.memberId}`;
      const existing = [...this.invitations.values()].find(
        (i) => i.eventId === eventId && i.memberId === entry.memberId,
      );
      if (existing) continue;

      const invitation: InvitationRecord = {
        id: randomUUID(),
        eventId,
        memberId: entry.memberId,
        inviteListEntryId: entry.id,
        status: "invited",
        sentAt: now.toISOString(),
        acceptanceDeadline: new Date(now.getTime() + REPLY_DEADLINE_MS).toISOString(),
        acceptedAt: null,
        reconfirmRequestedAt: null,
        confirmationDeadline: null,
        confirmedAt: null,
        releasedAt: null,
        icsSequence: 0,
        idempotencyKey,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      this.invitations.set(invitation.id, invitation);
      entry.disposition = "invited";
      this.productOutbox.push({
        id: randomUUID(),
        kind: "invitation_email",
        held: true,
        idempotencyKey,
        eventId,
        memberId: entry.memberId,
        createdAt: now.toISOString(),
        metadataRedacted: { template: "invitation_v1" },
      });
      sent += 1;
    }

    if (event.status === "draft" && sent > 0) {
      event.status = "inviting";
    }
    return { ok: true as const, sent };
  }

  occupiedCapacity(eventId: string): number {
    return [...this.invitations.values()].filter(
      (i) =>
        i.eventId === eventId &&
        (i.status === "accepted" || i.status === "confirmed" || i.status === "invited"),
    ).length;
  }

  acceptedCount(eventId: string): number {
    return [...this.invitations.values()].filter(
      (i) =>
        i.eventId === eventId &&
        (i.status === "accepted" || i.status === "confirmed"),
    ).length;
  }

  respondInvitation(input: {
    invitationId: string;
    memberId: string;
    response: "accept" | "decline";
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const invitation = this.invitations.get(input.invitationId);
    if (!invitation || invitation.memberId !== input.memberId) {
      return { ok: false as const, code: "not_found" as const };
    }
    if (invitation.status === "accepted" || invitation.status === "confirmed") {
      return { ok: true as const, idempotent: true as const, invitation };
    }
    if (invitation.status !== "invited") {
      return { ok: false as const, code: "closed" as const };
    }
    if (
      invitation.acceptanceDeadline &&
      new Date(invitation.acceptanceDeadline).getTime() < now.getTime()
    ) {
      invitation.status = "expired";
      return { ok: false as const, code: "expired" as const };
    }

    if (input.response === "decline") {
      invitation.status = "declined";
      invitation.updatedAt = now.toISOString();
      this.runReplacementScan(invitation.eventId, now);
      return { ok: true as const, invitation };
    }

    const event = this.events.get(invitation.eventId);
    if (!event) return { ok: false as const, code: "missing_event" as const };

    const accepted = this.acceptedCount(invitation.eventId);
    if (accepted >= event.capacity) {
      return { ok: false as const, code: "full" as const };
    }

    invitation.status = "accepted";
    invitation.acceptedAt = now.toISOString();
    invitation.updatedAt = now.toISOString();

    const participation: ParticipationRecord = {
      id: randomUUID(),
      eventId: invitation.eventId,
      memberId: invitation.memberId,
      invitationId: invitation.id,
      status: "expected",
      eventParticipantId: null,
      checkedInAt: null,
      createdAt: now.toISOString(),
    };
    this.participations.push(participation);

    const icsKey = `ics:${invitation.id}:accept`;
    const existingIcs = this.productOutbox.some((o) => o.idempotencyKey === icsKey);
    if (!existingIcs) {
      this.productOutbox.push({
        id: randomUUID(),
        kind: "acceptance_confirmation_ics",
        held: true,
        idempotencyKey: icsKey,
        eventId: invitation.eventId,
        memberId: invitation.memberId,
        createdAt: now.toISOString(),
        metadataRedacted: {
          uid: `event-${invitation.eventId}@atlanta-singles.local`,
          timezone: "America/New_York",
        },
      });
    }

    return { ok: true as const, invitation, participation };
  }

  listInvitationsForMember(memberId: string): InvitationRecord[] {
    return [...this.invitations.values()].filter((i) => i.memberId === memberId);
  }

  listInvitationsForEvent(eventId: string): InvitationRecord[] {
    return [...this.invitations.values()].filter((i) => i.eventId === eventId);
  }

  getActiveBlocks(): BlockRecord[] {
    return this.blocks.filter((b) => b.status === "active");
  }

  getInvitation(id: string): InvitationRecord | null {
    return this.invitations.get(id) ?? null;
  }

  getInviteListForEvent(eventId: string): InviteListRecord | null {
    return [...this.inviteLists.values()].find((l) => l.eventId === eventId) ?? null;
  }

  getInviteEntries(listId: string): InviteListEntryRecord[] {
    return this.inviteEntries
      .filter((e) => e.inviteListId === listId)
      .sort((a, b) => a.position - b.position);
  }

  /** Synthetic seed for curation tests (S5). */
  seedSyntheticMembers(count: number, now = new Date(), eveningDateKey?: string) {
    const auth = getLocalAuthStore();
    const zips = ["30307", "30308", "30309", "30312", "30317", "30030"];
    for (let i = 0; i < count; i += 1) {
      const email = `synthetic${i}@example.test`;
      if (auth.findAuthUserByEmail(email)) continue;
      const signup = auth.completeSignup(
        {
          chosenFirstName: `Syn${i}`,
          email,
          selfReportedAge: 25 + (i % 21),
          homeZip: zips[i % zips.length]!,
          source: "seed",
          noticeAcknowledged: true,
        },
        now,
      );
      if (!signup.ok) continue;
      const member = auth.findAuthUserByEmail(email);
      const m = member ? auth.findMemberByAuthUserId(member.id) : null;
      if (!m) continue;
      const identity = i % 2 === 0 ? "woman" : "man";
      const dating = identity === "woman" ? ["man"] : ["woman"];
      this.saveProfileSection({
        memberId: m.id,
        section: "gender",
        payload: { value: identity },
        firmness: "firm",
        now,
      });
      this.saveProfileSection({
        memberId: m.id,
        section: "dating-genders",
        payload: { values: dating },
        firmness: "firm",
        now,
      });
      this.saveProfileSection({
        memberId: m.id,
        section: "age-range",
        payload: { min: 25, max: 45 },
        firmness: "flexible",
        now,
      });
      this.saveProfileSection({
        memberId: m.id,
        section: "intention",
        payload: { value: "long_term" },
        firmness: "firm",
        now,
      });
      this.saveProfileSection({
        memberId: m.id,
        section: "structure",
        payload: { value: "monogamous" },
        firmness: "flexible",
        now,
      });
      this.saveProfileSection({
        memberId: m.id,
        section: "experience",
        payload: "casual",
        now,
      });
      const evening =
        eveningDateKey ??
        atlantaDateKey(new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000));
      this.saveAvailability({
        memberId: m.id,
        eveningDates: [evening],
        now,
      });
    }
  }

  grantStaffRole(authUserId: string, role: AppRole, now = new Date()) {
    getLocalAuthStore().grantRoleForTests(authUserId, role, now);
  }

  runReplacementScan(eventId: string, now = new Date()) {
    const event = this.events.get(eventId);
    const list = [...this.inviteLists.values()].find((l) => l.eventId === eventId);
    if (!event || !list) return { ok: false as const };
    if (invitationsPastGoNoGo(event)) {
      return { ok: true as const, sent: 0 };
    }
    const openSeats = event.capacity - this.acceptedCount(eventId);
    if (openSeats <= 0) return { ok: true as const, sent: 0 };
    return this.sendInvitations(eventId, openSeats, now);
  }

  confirmedCount(eventId: string): number {
    return [...this.invitations.values()].filter(
      (i) => i.eventId === eventId && i.status === "confirmed",
    ).length;
  }

  private boundaryState(eventId: string): EventBoundaryJobState {
    const existing = this.boundaryJobs.get(eventId);
    if (existing) return existing;
    const row: EventBoundaryJobState = {
      eventId,
      e72hReconfirmSentAt: null,
      e48hReleaseCompletedAt: null,
      e24hDecisionPendingAt: null,
    };
    this.boundaryJobs.set(eventId, row);
    return row;
  }

  private enqueueNotice(
    kind: string,
    idempotencyKey: string,
    eventId: string,
    memberId: string,
    now: Date,
    template: string,
  ) {
    if (this.productOutbox.some((o) => o.idempotencyKey === idempotencyKey)) return;
    this.productOutbox.push({
      id: randomUUID(),
      kind,
      held: true,
      idempotencyKey,
      eventId,
      memberId,
      createdAt: now.toISOString(),
      metadataRedacted: { template },
    });
  }

  runEventBoundaryReconciliation(now = new Date()) {
    const touched: string[] = [];
    for (const event of this.events.values()) {
      if (event.status === "canceled" || event.status === "closed") continue;
      const bounds = computeEventBoundaries(new Date(event.startsAt));
      const state = this.boundaryState(event.id);
      const nowMs = now.getTime();

      if (
        nowMs >= new Date(bounds.e72h).getTime() &&
        !state.e72hReconfirmSentAt &&
        (event.status === "inviting" || event.status === "go" || event.status === "smaller")
      ) {
        for (const inv of this.listInvitationsForEvent(event.id)) {
          if (inv.status !== "accepted") continue;
          inv.reconfirmRequestedAt = now.toISOString();
          inv.confirmationDeadline = bounds.e48h;
          inv.updatedAt = now.toISOString();
          this.enqueueNotice(
            "reconfirm_request",
            `reconfirm:${event.id}:${inv.id}`,
            event.id,
            inv.memberId,
            now,
            "reconfirm_v1",
          );
        }
        state.e72hReconfirmSentAt = now.toISOString();
        touched.push(event.id);
      }

      if (
        nowMs >= new Date(bounds.e48h).getTime() &&
        !state.e48hReleaseCompletedAt &&
        !invitationsPastGoNoGo(event)
      ) {
        for (const inv of this.listInvitationsForEvent(event.id)) {
          if (inv.status !== "accepted") continue;
          inv.status = "released";
          inv.releasedAt = now.toISOString();
          inv.updatedAt = now.toISOString();
          this.participations = this.participations.filter(
            (p) => p.invitationId !== inv.id,
          );
          this.enqueueNotice(
            "seat_released",
            `release:${event.id}:${inv.id}`,
            event.id,
            inv.memberId,
            now,
            "release_v1",
          );
        }
        state.e48hReleaseCompletedAt = now.toISOString();
        this.runReplacementScan(event.id, now);
        touched.push(event.id);
      }

      if (
        nowMs >= new Date(bounds.e24h).getTime() &&
        !state.e24hDecisionPendingAt &&
        event.status === "inviting"
      ) {
        event.status = "decision_pending";
        event.updatedAt = now.toISOString();
        state.e24hDecisionPendingAt = now.toISOString();
        touched.push(event.id);
      }
    }
    return { ok: true as const, touchedEventIds: touched };
  }

  confirmReconfirmation(input: {
    invitationId: string;
    memberId: string;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const invitation = this.invitations.get(input.invitationId);
    if (!invitation || invitation.memberId !== input.memberId) {
      return { ok: false as const, code: "not_found" as const };
    }
    if (invitation.status === "confirmed") {
      return { ok: true as const, idempotent: true as const, invitation };
    }
    if (invitation.status !== "accepted") {
      return { ok: false as const, code: "invalid_state" as const };
    }
    if (
      invitation.confirmationDeadline &&
      now.getTime() > new Date(invitation.confirmationDeadline).getTime()
    ) {
      return { ok: false as const, code: "deadline_passed" as const };
    }
    invitation.status = "confirmed";
    invitation.confirmedAt = now.toISOString();
    invitation.updatedAt = now.toISOString();
    return { ok: true as const, invitation };
  }

  recordEventDecision(input: {
    eventId: string;
    outcome: EventDecisionOutcome;
    actorAuthUserId: string;
    reason: string;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const event = this.events.get(input.eventId);
    if (!event) return { ok: false as const, code: "missing_event" as const };
    const confirmed = this.confirmedCount(input.eventId);
    const validation = validateEventDecision(confirmed, input.outcome);
    if (!validation.ok) {
      return { ok: false as const, code: validation.reason as "go_requires_16_confirmed" };
    }
    if (input.outcome === "go") event.status = "go";
    else if (input.outcome === "smaller") event.status = "smaller";
    else if (input.outcome === "rescheduled") event.status = "rescheduled";
    else event.status = "canceled";
    event.updatedAt = now.toISOString();

    const decision: EventDecisionRecord = {
      id: randomUUID(),
      eventId: input.eventId,
      outcome: input.outcome,
      confirmedCount: confirmed,
      actorAuthUserId: input.actorAuthUserId,
      reason: input.reason,
      createdAt: now.toISOString(),
    };
    this.eventDecisions.push(decision);

    for (const inv of this.listInvitationsForEvent(input.eventId)) {
      if (
        inv.status === "accepted" ||
        inv.status === "confirmed" ||
        inv.status === "invited"
      ) {
        this.enqueueNotice(
          "event_decision",
          `decision:${decision.id}:${inv.id}`,
          input.eventId,
          inv.memberId,
          now,
          `decision_${input.outcome}_v1`,
        );
      }
    }
    if (input.outcome === "go" || input.outcome === "smaller") {
      this.assignEventParticipantIds(input.eventId, now);
    }
    return { ok: true as const, decision, event };
  }

  rescheduleEvent(input: {
    eventId: string;
    newStartsAt: Date;
    actorAuthUserId: string;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const event = this.events.get(input.eventId);
    if (!event) return { ok: false as const, code: "missing_event" as const };
    if (!canRescheduleEvent(event)) {
      return { ok: false as const, code: "event_started" as const };
    }
    const bounds = computeEventBoundaries(input.newStartsAt);
    event.startsAt = bounds.startsAt;
    event.endsAt = bounds.endsAt;
    event.decisionDueAt = bounds.e24h;
    event.status = eventStatusAfterMaterialChange(event.status);
    event.updatedAt = now.toISOString();
    this.boundaryJobs.delete(event.id);

    const toRemoveParticipation = new Set<string>();
    for (const inv of this.listInvitationsForEvent(input.eventId)) {
      const result = applyMaterialTimeChangeToInvitation(inv, now);
      if (result.removeParticipation) {
        toRemoveParticipation.add(inv.id);
      }
      if (result.changed) {
        this.enqueueNotice(
          "material_change",
          `material:${event.id}:${inv.id}:${inv.icsSequence}`,
          event.id,
          inv.memberId,
          now,
          "material_change_v1",
        );
      }
    }
    if (toRemoveParticipation.size > 0) {
      this.participations = this.participations.filter(
        (p) => !toRemoveParticipation.has(p.invitationId),
      );
    }
    return { ok: true as const, event };
  }

  assignEventParticipantIds(eventId: string, now = new Date()) {
    for (const p of this.participations.filter((x) => x.eventId === eventId)) {
      if (!p.eventParticipantId) {
        p.eventParticipantId = `PEEP-${randomUUID().slice(0, 6).toUpperCase()}`;
      }
    }
    return this.participations.filter((p) => p.eventId === eventId);
  }

  listParticipationsForEvent(eventId: string): ParticipationRecord[] {
    return this.participations.filter((p) => p.eventId === eventId);
  }

  markCheckedIn(input: {
    participationId: string;
    actorAuthUserId: string;
    markLate?: boolean;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const participation = this.participations.find((p) => p.id === input.participationId);
    if (!participation) return { ok: false as const, code: "not_found" as const };
    const event = this.events.get(participation.eventId);
    if (!event) return { ok: false as const, code: "missing_event" as const };
    if (event.status !== "in_progress" && event.status !== "go" && event.status !== "smaller") {
      return { ok: false as const, code: "invalid_event_state" as const };
    }
    if (participation.status === "absent") {
      return { ok: false as const, code: "absent" as const };
    }
    participation.status = input.markLate ? "late" : "checked_in";
    participation.checkedInAt = now.toISOString();
    if (!participation.eventParticipantId) {
      participation.eventParticipantId = `PEEP-${randomUUID().slice(0, 6).toUpperCase()}`;
    }
    return { ok: true as const, participation };
  }

  markAbsent(input: { participationId: string; now?: Date }) {
    const now = input.now ?? new Date();
    const participation = this.participations.find((p) => p.id === input.participationId);
    if (!participation) return { ok: false as const, code: "not_found" as const };
    const event = this.events.get(participation.eventId);
    if (!event) return { ok: false as const, code: "missing_event" as const };
    const startMs = new Date(event.startsAt).getTime();
    if (now.getTime() < startMs + NO_SHOW_GUARD_MS) {
      return { ok: false as const, code: "too_early" as const };
    }
    participation.status = "absent";
    return { ok: true as const, participation };
  }

  startEvent(eventId: string, now = new Date()) {
    const event = this.events.get(eventId);
    if (!event) return { ok: false as const, code: "missing_event" as const };
    if (event.status !== "go" && event.status !== "smaller") {
      return { ok: false as const, code: "invalid_state" as const };
    }
    event.status = "in_progress";
    event.updatedAt = now.toISOString();
    this.assignEventParticipantIds(eventId, now);
    return { ok: true as const, event };
  }

  findOpenFollowUpEventIdForMember(memberId: string, now: Date): string | null {
    const nowMs = now.getTime();
    for (const participation of this.participations) {
      if (participation.memberId !== memberId) continue;
      if (!participationEligibleForFollowUp(participation)) continue;
      const event = this.events.get(participation.eventId);
      if (!event || event.status !== "completed") continue;
      const window = this.followUpWindows.get(participation.eventId);
      if (!window || nowMs > new Date(window.closesAt).getTime()) continue;
      return participation.eventId;
    }
    return null;
  }

  completeEvent(eventId: string, now = new Date()) {
    const event = this.events.get(eventId);
    if (!event) return { ok: false as const, code: "missing_event" as const };
    event.status = "completed";
    event.updatedAt = now.toISOString();
    const window: FollowUpWindowRecord = {
      eventId,
      opensAt: now.toISOString(),
      closesAt: new Date(now.getTime() + FOLLOW_UP_WINDOW_MS).toISOString(),
      reminderSentAt: null,
    };
    this.followUpWindows.set(eventId, window);
    for (const p of this.participations.filter((x) => x.eventId === eventId)) {
      if (!participationEligibleForFollowUp(p)) continue;
      this.enqueueNotice(
        "follow_up_link",
        `followup:${eventId}:${p.memberId}`,
        eventId,
        p.memberId,
        now,
        "follow_up_v1",
      );
    }
    return { ok: true as const, event, window };
  }

  resolveParticipationByEventParticipantId(
    eventParticipantId: string,
  ): ParticipationRecord | null {
    const normalized = eventParticipantId.trim().toUpperCase();
    return (
      this.participations.find(
        (p) => p.eventParticipantId?.toUpperCase() === normalized,
      ) ?? null
    );
  }

  createPrivateSelection(input: {
    eventId: string;
    selectorMemberId: string;
    targetEventParticipantId: string;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const window = this.followUpWindows.get(input.eventId);
    if (!window || now.getTime() > new Date(window.closesAt).getTime()) {
      return { ok: false as const, code: "window_closed" as const };
    }
    const selectorParticipation = this.participations.find(
      (p) => p.eventId === input.eventId && p.memberId === input.selectorMemberId,
    );
    if (!selectorParticipation || !participationEligibleForFollowUp(selectorParticipation)) {
      return { ok: false as const, code: "not_eligible" as const };
    }
    const target = this.resolveParticipationByEventParticipantId(
      input.targetEventParticipantId,
    );
    if (!target || target.eventId !== input.eventId) {
      return { ok: false as const, code: "unknown_id" as const };
    }
    if (target.memberId === input.selectorMemberId) {
      return { ok: false as const, code: "unknown_id" as const };
    }
    if (!participationEligibleForFollowUp(target)) {
      return { ok: false as const, code: "unknown_id" as const };
    }
    if (
      pairBlocked(input.selectorMemberId, target.memberId, this.blocks)
    ) {
      return { ok: false as const, code: "unknown_id" as const };
    }

    const existing = this.privateSelections.find(
      (s) =>
        s.eventId === input.eventId &&
        s.selectorMemberId === input.selectorMemberId &&
        s.status === "active",
    );
    if (existing) {
      return { ok: true as const, idempotent: true as const, selection: existing };
    }

    const selection: PrivateSelectionRecord = {
      id: randomUUID(),
      eventId: input.eventId,
      selectorMemberId: input.selectorMemberId,
      targetParticipationId: target.id,
      targetEventParticipantId: target.eventParticipantId ?? input.targetEventParticipantId,
      status: "active",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    this.privateSelections.push(selection);

    const reciprocal = findReciprocalSelection(
      this.privateSelections,
      this.participations,
      selection,
    );
    if (reciprocal) {
      this.openConnectionFromReciprocal(selection, reciprocal, now);
    }
    return { ok: true as const, selection };
  }

  private openConnectionFromReciprocal(
    a: PrivateSelectionRecord,
    b: PrivateSelectionRecord,
    now: Date,
  ) {
    const memberA = a.selectorMemberId;
    const memberB = b.selectorMemberId;
    if (pairBlocked(memberA, memberB, this.blocks)) return;
    const [canonA, canonB] = canonicalMemberPair(memberA, memberB);
    const existing = this.connections.find(
      (c) =>
        c.eventId === a.eventId &&
        c.memberAId === canonA &&
        c.memberBId === canonB &&
        c.status !== "lapsed" &&
        c.status !== "withdrawn",
    );
    if (existing) return;

    const notifiedAt = now.toISOString();
    const connection: ConnectionRecord = {
      id: randomUUID(),
      eventId: a.eventId,
      memberAId: canonA,
      memberBId: canonB,
      status: "mutual_notified",
      mutualNotifiedAt: notifiedAt,
      authorizationDeadline: new Date(
        now.getTime() + CONNECTION_AUTH_MS,
      ).toISOString(),
      reminderSentAt: null,
      memberAAuthorizedAt: null,
      memberBAuthorizedAt: null,
      createdAt: notifiedAt,
      updatedAt: notifiedAt,
    };
    this.connections.push(connection);
    for (const memberId of [memberA, memberB]) {
      this.enqueueNotice(
        "mutual_match",
        `mutual:${connection.id}:${memberId}`,
        a.eventId,
        memberId,
        now,
        "mutual_match_v1",
      );
    }
  }

  listConnectionsForMember(memberId: string): ConnectionRecord[] {
    return this.connections.filter(
      (c) => c.memberAId === memberId || c.memberBId === memberId,
    );
  }

  authorizeConnection(input: {
    connectionId: string;
    memberId: string;
    contactField: "verified_email";
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    if (input.contactField !== "verified_email") {
      return { ok: false as const, code: "invalid_field" as const };
    }
    const connection = this.connections.find((c) => c.id === input.connectionId);
    if (!connection) return { ok: false as const, code: "not_found" as const };
    if (
      connection.status === "released" ||
      connection.status === "lapsed" ||
      connection.status === "withdrawn"
    ) {
      return { ok: false as const, code: "closed" as const };
    }
    if (connectionReleaseBlocked(connection, this.blocks)) {
      connection.status = "withdrawn";
      connection.updatedAt = now.toISOString();
      return { ok: false as const, code: "blocked" as const };
    }

    const isA = connection.memberAId === input.memberId;
    const isB = connection.memberBId === input.memberId;
    if (!isA && !isB) return { ok: false as const, code: "not_found" as const };

    if (now.getTime() > new Date(connection.authorizationDeadline).getTime()) {
      connection.status = "lapsed";
      connection.updatedAt = now.toISOString();
      return { ok: false as const, code: "deadline_passed" as const };
    }

    if (isA && connection.memberAAuthorizedAt) {
      return { ok: true as const, idempotent: true as const, connection };
    }
    if (isB && connection.memberBAuthorizedAt) {
      return { ok: true as const, idempotent: true as const, connection };
    }

    if (isA) connection.memberAAuthorizedAt = now.toISOString();
    if (isB) connection.memberBAuthorizedAt = now.toISOString();
    connection.status = "awaiting_authorization";
    connection.updatedAt = now.toISOString();

    const bothApproved =
      connection.memberAAuthorizedAt !== null &&
      connection.memberBAuthorizedAt !== null;
    if (bothApproved && !connectionReleaseBlocked(connection, this.blocks)) {
      connection.status = "released";
      connection.updatedAt = now.toISOString();
      for (const memberId of [connection.memberAId, connection.memberBId]) {
        this.enqueueNotice(
          "contact_released",
          `release_contact:${connection.id}:${memberId}`,
          connection.eventId,
          memberId,
          now,
          "contact_released_v1",
        );
      }
    }
    return { ok: true as const, connection };
  }

  runConnectionDeadlineJobs(now = new Date()) {
    let lapsed = 0;
    for (const connection of this.connections) {
      if (
        connection.status === "released" ||
        connection.status === "lapsed" ||
        connection.status === "withdrawn"
      ) {
        continue;
      }
      const notifiedMs = new Date(connection.mutualNotifiedAt).getTime();
      if (
        !connection.reminderSentAt &&
        now.getTime() >= notifiedMs + CONNECTION_REMINDER_MS
      ) {
        connection.reminderSentAt = now.toISOString();
        for (const memberId of [connection.memberAId, connection.memberBId]) {
          const approved =
            memberId === connection.memberAId
              ? connection.memberAAuthorizedAt
              : connection.memberBAuthorizedAt;
          if (approved) continue;
          this.enqueueNotice(
            "connection_reminder",
            `conn_reminder:${connection.id}:${memberId}`,
            connection.eventId,
            memberId,
            now,
            "connection_reminder_v1",
          );
        }
      }
      if (now.getTime() >= new Date(connection.authorizationDeadline).getTime()) {
        const both =
          connection.memberAAuthorizedAt && connection.memberBAuthorizedAt;
        if (!both || connectionReleaseBlocked(connection, this.blocks)) {
          connection.status = "lapsed";
          connection.memberAAuthorizedAt = null;
          connection.memberBAuthorizedAt = null;
          connection.updatedAt = now.toISOString();
          lapsed += 1;
        }
      }
    }
    return { ok: true as const, lapsed };
  }

  withdrawConnection(connectionId: string, memberId: string, now = new Date()) {
    const connection = this.connections.find((c) => c.id === connectionId);
    if (!connection) return { ok: false as const, code: "not_found" as const };
    if (connection.memberAId !== memberId && connection.memberBId !== memberId) {
      return { ok: false as const, code: "not_found" as const };
    }
    if (connection.status === "released") {
      return { ok: false as const, code: "already_released" as const };
    }
    connection.status = "withdrawn";
    connection.updatedAt = now.toISOString();
    return { ok: true as const, connection };
  }

  createMemberBlock(input: {
    creatorMemberId: string;
    targetEventParticipantId: string;
    eventId: string;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const target = this.resolveParticipationByEventParticipantId(
      input.targetEventParticipantId,
    );
    if (!target || target.eventId !== input.eventId) {
      return { ok: false as const, code: "unknown_id" as const };
    }
    const row: BlockRecord = {
      id: randomUUID(),
      creatorMemberId: input.creatorMemberId,
      blockedMemberId: target.memberId,
      status: "active",
      source: "member",
      createdAt: now.toISOString(),
    };
    this.blocks.push(row);
    return { ok: true as const, block: row };
  }

  submitIncidentReport(input: {
    reporterMemberId: string;
    eventId: string | null;
    involvedEventParticipantId: string | null;
    narrative: string;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const report: IncidentReportRecord = {
      id: randomUUID(),
      eventId: input.eventId,
      reporterMemberId: input.reporterMemberId,
      involvedEventParticipantId: input.involvedEventParticipantId,
      narrative: input.narrative,
      status: "submitted",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    this.incidentReports.push(report);
    this.enqueueNotice(
      "incident_report_received",
      `incident:${report.id}`,
      input.eventId ?? "community",
      input.reporterMemberId,
      now,
      "incident_ack_v1",
    );
    return { ok: true as const, reportId: report.id };
  }

  getIncidentReportForSafetyOwner(reportId: string): IncidentReportRecord | null {
    return this.incidentReports.find((r) => r.id === reportId) ?? null;
  }

  submitFeedback(input: {
    participationId: string;
    memberId: string;
    wouldAttendAgain: boolean;
    comment?: string;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const participation = this.participations.find((p) => p.id === input.participationId);
    if (!participation || participation.memberId !== input.memberId) {
      return { ok: false as const, code: "not_found" as const };
    }
    if (!participationEligibleForFollowUp(participation)) {
      return { ok: false as const, code: "not_eligible" as const };
    }
    const window = this.followUpWindows.get(participation.eventId);
    if (!window || now.getTime() > new Date(window.closesAt).getTime()) {
      return { ok: false as const, code: "window_closed" as const };
    }
    if (this.feedback.some((f) => f.participationId === input.participationId)) {
      return { ok: true as const, idempotent: true as const };
    }
    this.feedback.push({
      id: randomUUID(),
      eventId: participation.eventId,
      participationId: input.participationId,
      memberId: input.memberId,
      wouldAttendAgain: input.wouldAttendAgain,
      comment: input.comment ?? null,
      createdAt: now.toISOString(),
    });
    return { ok: true as const };
  }

  buildCourtRotations(eventId: string): {
    ok: true;
    rotations: CourtRotationAssignment[];
    repeatPartnerFlags: string[];
  } | { ok: false; code: "invalid_size" } {
    const event = this.events.get(eventId);
    if (!event) return { ok: false, code: "invalid_size" };
    const players = this.participations
      .filter((p) => p.eventId === eventId && p.status !== "absent")
      .map((p) => p.memberId);
    if (players.length !== 12 && players.length !== 16) {
      return { ok: false, code: "invalid_size" };
    }
    const courts = 3;
    const playing = 12;
    const resting = players.length - playing;
    const partnerHistory = new Set<string>();
    const repeatPartnerFlags: string[] = [];
    const rotations: CourtRotationAssignment[] = [];
    for (let r = 0; r < 5; r += 1) {
      const shuffled = [...players].sort((a, b) => a.localeCompare(b));
      const offset = r % shuffled.length;
      const ordered = shuffled.map((_, i) => shuffled[(i + offset) % shuffled.length]!);
      const courtMemberIds = ordered.slice(0, playing);
      const restingMemberIds = ordered.slice(playing, playing + resting);
      for (let c = 0; c < courts; c += 1) {
        const courtPlayers = courtMemberIds.slice(c * 4, c * 4 + 4);
        for (let i = 0; i < courtPlayers.length; i += 1) {
          for (let j = i + 1; j < courtPlayers.length; j += 1) {
            const key = [courtPlayers[i], courtPlayers[j]].sort().join(":");
            if (partnerHistory.has(key)) repeatPartnerFlags.push(key);
            partnerHistory.add(key);
          }
        }
      }
      rotations.push({
        rotationIndex: r,
        courtIndex: 0,
        memberIds: courtMemberIds,
        restingMemberIds,
      });
    }
    return { ok: true, rotations, repeatPartnerFlags };
  }

  processMemberDeletion(memberId: string, now = new Date()) {
    const member = this.memberById(memberId);
    if (!member || member.status !== "deletion_requested") {
      return { ok: false as const, code: "not_pending" as const };
    }
    const auth = getLocalAuthStore();
    auth.revokeSessionsForMember(memberId);
    this.matchingItems.forEach((item, id) => {
      if (item.memberId === memberId) this.matchingItems.delete(id);
    });
    this.availability.forEach((row, id) => {
      if (row.memberId === memberId) this.availability.delete(id);
    });
    this.invitations.forEach((inv, id) => {
      if (inv.memberId === memberId) this.invitations.delete(id);
    });
    this.participations = this.participations.filter((p) => p.memberId !== memberId);
    this.privateSelections = this.privateSelections.filter(
      (s) => s.selectorMemberId !== memberId,
    );
    this.connections = this.connections.filter(
      (c) => c.memberAId !== memberId && c.memberBId !== memberId,
    );
    this.feedback = this.feedback.filter((f) => f.memberId !== memberId);
    auth.removeMemberForTests(memberId);
    return { ok: true as const, reportsRetained: this.incidentReports.length };
  }
}

declare global {
  var __atlAppStore: AppStore | undefined;
}

export function getAppStore(): AppStore {
  if (!globalThis.__atlAppStore) {
    globalThis.__atlAppStore = new AppStore();
  }
  return globalThis.__atlAppStore;
}

export function resetAllStoresForTests(): void {
  getAppStore().resetForTests();
}
