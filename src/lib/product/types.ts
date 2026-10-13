import type { AppRole } from "@/lib/auth/types";

export type Firmness = "firm" | "flexible";

export type ProfileSectionId =
  | "gender"
  | "dating-genders"
  | "age-range"
  | "intention"
  | "experience"
  | "structure";

export type MatchingItemKind =
  | "gender_identity"
  | "dating_gender"
  | "desired_age_range"
  | "relationship_intention"
  | "relationship_structure";

export type RelationshipIntentionValue = "long_term" | "open_to_long_term";

export type PickleballExperience = "never_played" | "casual" | "regular";

export type AvailabilityCadence = "weekly" | "every_other_week";

export interface MatchingItemRecord {
  id: string;
  memberId: string;
  kind: MatchingItemKind;
  itemKey: string;
  value: unknown;
  firmness: Firmness;
  isActive: boolean;
  displayOrder: number;
  updatedAt: string;
}

export interface AvailabilityRecord {
  id: string;
  memberId: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  expiresAt: string;
  withdrawnAt: string | null;
  /** Evening dates (YYYY-MM-DD) the member is free within the window. */
  eveningDates: string[];
  createdAt: string;
  updatedAt: string;
}

export interface VenueRecord {
  id: string;
  name: string;
  area: string;
  zip: string;
  streetAddress: string;
  arrivalInstructions: string;
  accessibilityNotes: string;
  capacity: number;
  courtCount: number;
  isIndoorOrCovered: boolean;
  isActive: boolean;
  waiverNotes: string;
  createdAt: string;
  updatedAt: string;
}

export type EventStatus =
  | "draft"
  | "inviting"
  | "decision_pending"
  | "go"
  | "smaller"
  | "rescheduled"
  | "in_progress"
  | "completed"
  | "closed"
  | "canceled";

export interface EventRecord {
  id: string;
  venueId: string | null;
  status: EventStatus;
  audienceDescription: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  capacity: number;
  minimumGroupSize: number;
  courtCount: number;
  decisionDueAt: string;
  createdByAuthUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventStaffRecord {
  id: string;
  eventId: string;
  authUserId: string;
  role: "event_lead" | "host" | "safety_owner";
  isCoach: boolean;
  removedAt: string | null;
}

export type InviteListStatus = "draft" | "locked";

export interface InviteListRecord {
  id: string;
  eventId: string;
  status: InviteListStatus;
  targetCapacity: number;
  lockedAt: string | null;
  createdByAuthUserId: string;
  lastCheckedAt: string | null;
  createdAt: string;
}

export type InviteEntryDisposition =
  | "pending"
  | "eligible"
  | "held_recheck_failed"
  | "invited"
  | "removed";

export interface InviteListEntryRecord {
  id: string;
  inviteListId: string;
  memberId: string;
  qualifyingAvailabilityId: string;
  position: number;
  statedCriteriaReason: string;
  disposition: InviteEntryDisposition;
  recheckReasonCode: string | null;
  lastRecheckedAt: string | null;
}

export type InvitationStatus =
  | "not_sent"
  | "invited"
  | "accepted"
  | "confirmed"
  | "declined"
  | "expired"
  | "canceled"
  | "released";

export interface InvitationRecord {
  id: string;
  eventId: string;
  memberId: string;
  inviteListEntryId: string;
  status: InvitationStatus;
  sentAt: string | null;
  acceptanceDeadline: string | null;
  acceptedAt: string | null;
  reconfirmRequestedAt: string | null;
  confirmationDeadline: string | null;
  confirmedAt: string | null;
  releasedAt: string | null;
  icsSequence: number;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ParticipationStatus = "expected" | "checked_in" | "late" | "absent";

export interface ParticipationRecord {
  id: string;
  eventId: string;
  memberId: string;
  invitationId: string;
  status: ParticipationStatus;
  eventParticipantId: string | null;
  checkedInAt: string | null;
  createdAt: string;
}

export interface EventBoundaryJobState {
  eventId: string;
  e72hReconfirmSentAt: string | null;
  e48hReleaseCompletedAt: string | null;
  e24hDecisionPendingAt: string | null;
}

export type EventDecisionOutcome = "go" | "smaller" | "rescheduled" | "canceled";

export interface EventDecisionRecord {
  id: string;
  eventId: string;
  outcome: EventDecisionOutcome;
  confirmedCount: number;
  actorAuthUserId: string;
  reason: string;
  createdAt: string;
}

export interface FollowUpWindowRecord {
  eventId: string;
  opensAt: string;
  closesAt: string;
  reminderSentAt: string | null;
}

export type PrivateSelectionStatus = "active" | "withdrawn" | "expired";

export interface PrivateSelectionRecord {
  id: string;
  eventId: string;
  selectorMemberId: string;
  targetParticipationId: string;
  targetEventParticipantId: string;
  status: PrivateSelectionStatus;
  createdAt: string;
  updatedAt: string;
}

export type ConnectionStatus =
  | "mutual_notified"
  | "awaiting_authorization"
  | "released"
  | "withdrawn"
  | "lapsed";

export interface ConnectionRecord {
  id: string;
  eventId: string;
  memberAId: string;
  memberBId: string;
  status: ConnectionStatus;
  mutualNotifiedAt: string;
  authorizationDeadline: string;
  reminderSentAt: string | null;
  memberAAuthorizedAt: string | null;
  memberBAuthorizedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackRecord {
  id: string;
  eventId: string;
  participationId: string;
  memberId: string;
  wouldAttendAgain: boolean | null;
  comment: string | null;
  createdAt: string;
}

export type IncidentReportStatus = "submitted" | "triaged" | "closed";

export interface IncidentReportRecord {
  id: string;
  eventId: string | null;
  reporterMemberId: string;
  involvedEventParticipantId: string | null;
  narrative: string;
  status: IncidentReportStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CourtRotationAssignment {
  rotationIndex: number;
  courtIndex: number;
  memberIds: string[];
  restingMemberIds: string[];
}

export interface BlockRecord {
  id: string;
  creatorMemberId: string;
  blockedMemberId: string;
  status: "active" | "lifted";
  source: "member" | "staff";
  createdAt: string;
}

export interface CadenceAskRecord {
  id: string;
  memberId: string;
  windowStartsAt: string;
  windowEndsAt: string;
  sentAt: string;
  idempotencyKey: string;
}

export interface ProductOutboxRow {
  id: string;
  kind: string;
  held: boolean;
  idempotencyKey: string;
  eventId?: string;
  memberId?: string;
  createdAt: string;
  metadataRedacted: Record<string, string | number | boolean>;
}

export interface MemberProfileView {
  memberId: string;
  chosenFirstName: string;
  email?: string;
  selfReportedAge: number;
  homeZip: string;
  isInServiceArea: boolean;
  status: "active" | "paused" | "deletion_requested";
  profileStatus: "draft" | "complete";
  availabilityCadence: AvailabilityCadence;
  pickleballExperience: PickleballExperience | null;
  matchingItems: MatchingItemRecord[];
  sectionProgress: Record<ProfileSectionId, "not_started" | "in_progress" | "done">;
}

export interface StaffMemberProjection {
  role: AppRole;
  allowed: boolean;
  payload: Record<string, unknown> | null;
}
