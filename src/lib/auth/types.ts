export const APP_ROLES = [
  "member",
  "curation_lead",
  "event_lead",
  "host",
  "safety_owner",
  "community_lead",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const STAFF_ROLES: readonly AppRole[] = [
  "curation_lead",
  "event_lead",
  "host",
  "safety_owner",
  "community_lead",
];

export interface AuthUserRecord {
  id: string;
  email: string;
  createdAt: string;
}

export interface MemberRecord {
  id: string;
  authUserId: string;
  chosenFirstName: string;
  selfReportedAge: number;
  source: string;
  homeZip: string;
  isInServiceArea: boolean;
  status: "active" | "paused" | "deletion_requested";
  profileStatus: "draft" | "complete";
  availabilityCadence: "weekly" | "every_other_week";
  pickleballExperience: "never_played" | "casual" | "regular" | null;
  profileCompletedAt: string | null;
  pausedAt: string | null;
  deletionRequestedAt: string | null;
  lastMemberActivityAt: string;
  createdAt: string;
}

export interface RoleGrantRecord {
  id: string;
  authUserId: string;
  role: AppRole;
  grantedAt: string;
  revokedAt: string | null;
}

export interface MagicLinkRecord {
  token: string;
  authUserId: string;
  expiresAt: string;
  usedAt: string | null;
}

export interface AuthStoreSnapshot {
  authUsers: AuthUserRecord[];
  members: MemberRecord[];
  roleGrants: RoleGrantRecord[];
  magicLinks: MagicLinkRecord[];
  outbox: unknown[];
  audit: unknown[];
  rateLimits: { emailHash: string; lastSentAt: string }[];
}

export interface VerifiedSession {
  authUserId: string;
  email: string;
  memberId: string | null;
  roles: AppRole[];
}

export type MagicLinkSendResult =
  | { ok: true; neutralMessage: string }
  | { ok: false; code: "rate_limited"; retryAfterSeconds: number };

export interface AuthProvider {
  getSnapshot(): AuthStoreSnapshot;
  resetForTests(): void;
  findAuthUserByEmail(email: string): AuthUserRecord | null;
  findMemberByAuthUserId(authUserId: string): MemberRecord | null;
  sendMagicLinkForSignIn(email: string, now?: Date): MagicLinkSendResult;
  verifyMagicLink(token: string, now?: Date): VerifiedSession | null;
  completeSignup(input: SignupCommandInput, now?: Date): SignupCommandResult;
}

export interface SignupCommandInput {
  chosenFirstName: string;
  email: string;
  selfReportedAge: number;
  homeZip: string;
  source: string;
  noticeAcknowledged: boolean;
}

export type SignupCommandResult =
  | { ok: true; neutralMessage: string }
  | { ok: false; code: "age_refused"; message: string }
  | { ok: false; code: "validation"; fieldErrors: Record<string, string> }
  | { ok: false; code: "rate_limited"; retryAfterSeconds: number };
