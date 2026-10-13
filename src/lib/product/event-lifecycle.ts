import type {
  ConnectionRecord,
  EventDecisionOutcome,
  EventRecord,
  EventStatus,
  InvitationRecord,
  ParticipationRecord,
  PrivateSelectionRecord,
} from "@/lib/product/types";

export const REPLY_DEADLINE_MS = 48 * 60 * 60 * 1000;
export const CONNECTION_AUTH_MS = 72 * 60 * 60 * 1000;
export const CONNECTION_REMINDER_MS = 48 * 60 * 60 * 1000;
export const FOLLOW_UP_WINDOW_MS = 48 * 60 * 60 * 1000;
export const NO_SHOW_GUARD_MS = 60 * 60 * 1000;

export function invitationsPastGoNoGo(event: EventRecord): boolean {
  return (
    event.status === "go" ||
    event.status === "smaller" ||
    event.status === "canceled" ||
    event.status === "in_progress" ||
    event.status === "completed" ||
    event.status === "closed"
  );
}

export function canRescheduleEvent(event: EventRecord): boolean {
  switch (event.status) {
    case "draft":
    case "inviting":
    case "decision_pending":
    case "go":
    case "smaller":
    case "rescheduled":
      return true;
    case "in_progress":
    case "completed":
    case "closed":
    case "canceled":
      return false;
    default: {
      const _exhaustive: never = event.status;
      return _exhaustive;
    }
  }
}

export function validateEventDecision(
  confirmedCount: number,
  outcome: EventDecisionOutcome,
): { ok: true } | { ok: false; reason: string } {
  switch (outcome) {
    case "go":
      if (confirmedCount !== 16) {
        return { ok: false, reason: "go_requires_16_confirmed" };
      }
      return { ok: true };
    case "smaller":
      if (confirmedCount < 12 || confirmedCount > 15) {
        return { ok: false, reason: "smaller_requires_12_to_15" };
      }
      return { ok: true };
    case "rescheduled":
    case "canceled":
      return { ok: true };
    default: {
      const _exhaustive: never = outcome;
      return _exhaustive;
    }
  }
}

export function allowedDecisionsAtCount(
  confirmedCount: number,
): EventDecisionOutcome[] {
  const options: EventDecisionOutcome[] = [];
  if (confirmedCount === 16) options.push("go");
  if (confirmedCount >= 12 && confirmedCount <= 15) options.push("smaller");
  if (confirmedCount < 12) {
    options.push("rescheduled", "canceled");
  } else {
    options.push("rescheduled", "canceled");
  }
  return options;
}

export function applyMaterialTimeChangeToInvitation(
  invitation: InvitationRecord,
  now: Date,
): { changed: boolean; removeParticipation: boolean } {
  switch (invitation.status) {
    case "accepted":
    case "confirmed":
      invitation.status = "invited";
      invitation.acceptedAt = null;
      invitation.confirmedAt = null;
      invitation.reconfirmRequestedAt = null;
      invitation.confirmationDeadline = null;
      invitation.releasedAt = null;
      invitation.acceptanceDeadline = new Date(
        now.getTime() + REPLY_DEADLINE_MS,
      ).toISOString();
      invitation.icsSequence += 1;
      invitation.updatedAt = now.toISOString();
      return { changed: true, removeParticipation: true };
    case "invited":
      invitation.acceptanceDeadline = new Date(
        now.getTime() + REPLY_DEADLINE_MS,
      ).toISOString();
      invitation.icsSequence += 1;
      invitation.updatedAt = now.toISOString();
      return { changed: true, removeParticipation: false };
    case "declined":
    case "expired":
    case "released":
    case "canceled":
    case "not_sent":
      return { changed: false, removeParticipation: false };
    default: {
      const _exhaustive: never = invitation.status;
      return _exhaustive;
    }
  }
}

export function eventStatusAfterMaterialChange(status: EventStatus): EventStatus {
  if (status === "go" || status === "smaller") {
    return "inviting";
  }
  return status;
}

export function pairBlocked(
  memberA: string,
  memberB: string,
  blocks: { creatorMemberId: string; blockedMemberId: string; status: string }[],
): boolean {
  return blocks.some(
    (b) =>
      b.status === "active" &&
      ((b.creatorMemberId === memberA && b.blockedMemberId === memberB) ||
        (b.creatorMemberId === memberB && b.blockedMemberId === memberA)),
  );
}

export function findReciprocalSelection(
  selections: PrivateSelectionRecord[],
  participations: ParticipationRecord[],
  incoming: PrivateSelectionRecord,
): PrivateSelectionRecord | null {
  const targetParticipation = participations.find(
    (p) => p.id === incoming.targetParticipationId,
  );
  if (!targetParticipation) return null;
  return (
    selections.find(
      (s) =>
        s.status === "active" &&
        s.eventId === incoming.eventId &&
        s.selectorMemberId === targetParticipation.memberId &&
        s.id !== incoming.id &&
        participations.find((p) => p.id === s.targetParticipationId)?.memberId ===
          incoming.selectorMemberId,
    ) ?? null
  );
}

export function canonicalMemberPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function connectionReleaseBlocked(
  connection: ConnectionRecord,
  blocks: { creatorMemberId: string; blockedMemberId: string; status: string }[],
): boolean {
  return pairBlocked(connection.memberAId, connection.memberBId, blocks);
}

export function participationEligibleForFollowUp(
  participation: ParticipationRecord,
): boolean {
  return participation.status === "checked_in" || participation.status === "late";
}
