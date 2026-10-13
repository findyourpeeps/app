import { randomBytes, randomUUID } from "node:crypto";

import {
  MAGIC_LINK_RESEND_COOLDOWN_SECONDS,
  MAGIC_LINK_VALIDITY_HOURS,
} from "@/lib/config/auth-copy";
import { isInServiceArea } from "@/lib/config/service-area";
import { evaluateAgeGate } from "@/lib/membership/age-gate";
import type {
  AuthProvider,
  AuthStoreSnapshot,
  AuthUserRecord,
  MagicLinkRecord,
  MagicLinkSendResult,
  MemberRecord,
  RoleGrantRecord,
  SignupCommandInput,
  SignupCommandResult,
  VerifiedSession,
} from "@/lib/auth/types";

const NEUTRAL_EMAIL_MESSAGE =
  "If an account exists for that email, check your inbox for a sign-in link.";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashEmail(email: string): string {
  return normalizeEmail(email);
}

class LocalAuthStore implements AuthProvider {
  private authUsers = new Map<string, AuthUserRecord>();
  private authUsersByEmail = new Map<string, string>();
  private members = new Map<string, MemberRecord>();
  private membersByAuthUser = new Map<string, string>();
  private roleGrants: RoleGrantRecord[] = [];
  private magicLinks = new Map<string, MagicLinkRecord>();
  private outbox: unknown[] = [];
  private audit: unknown[] = [];
  private lastMagicLinkSent = new Map<string, number>();

  getSnapshot(): AuthStoreSnapshot {
    return {
      authUsers: [...this.authUsers.values()],
      members: [...this.members.values()],
      roleGrants: [...this.roleGrants],
      magicLinks: [...this.magicLinks.values()],
      outbox: [...this.outbox],
      audit: [...this.audit],
      rateLimits: [...this.lastMagicLinkSent.entries()].map(
        ([emailHash, lastSentAt]) => ({
          emailHash,
          lastSentAt: new Date(lastSentAt).toISOString(),
        }),
      ),
    };
  }

  resetForTests(): void {
    this.authUsers.clear();
    this.authUsersByEmail.clear();
    this.members.clear();
    this.membersByAuthUser.clear();
    this.roleGrants = [];
    this.magicLinks.clear();
    this.outbox = [];
    this.audit = [];
    this.lastMagicLinkSent.clear();
  }

  findAuthUserByEmail(email: string): AuthUserRecord | null {
    const id = this.authUsersByEmail.get(normalizeEmail(email));
    if (!id) return null;
    return this.authUsers.get(id) ?? null;
  }

  findMemberByAuthUserId(authUserId: string): MemberRecord | null {
    const memberId = this.membersByAuthUser.get(authUserId);
    if (!memberId) return null;
    return this.members.get(memberId) ?? null;
  }

  sendMagicLinkForSignIn(email: string, now = new Date()): MagicLinkSendResult {
    const normalized = normalizeEmail(email);
    const user = this.findAuthUserByEmail(normalized);
    if (user) {
      const rate = this.checkResendCooldown(normalized, now);
      if (!rate.ok) return rate;
      this.issueMagicLink(user.id, now);
    }
    return { ok: true, neutralMessage: NEUTRAL_EMAIL_MESSAGE };
  }

  verifyMagicLink(token: string, now = new Date()): VerifiedSession | null {
    const link = this.magicLinks.get(token);
    if (!link || link.usedAt) return null;
    if (new Date(link.expiresAt).getTime() <= now.getTime()) return null;

    link.usedAt = now.toISOString();
    const user = this.authUsers.get(link.authUserId);
    if (!user) return null;

    return this.buildSession(user.id, user.email);
  }

  completeSignup(input: SignupCommandInput, now = new Date()): SignupCommandResult {
    const fieldErrors: Record<string, string> = {};
    const firstName = input.chosenFirstName.trim();
    if (!firstName) fieldErrors.chosenFirstName = "Enter your first name.";
    const email = normalizeEmail(input.email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fieldErrors.email = "Enter a valid email address.";
    }
    const zip = input.homeZip.trim();
    if (!/^[0-9]{5}$/.test(zip)) {
      fieldErrors.homeZip = "Enter a 5-digit ZIP code.";
    }
    const source = input.source.trim();
    if (!source) fieldErrors.source = "Tell us how you heard about us.";
    if (!input.noticeAcknowledged) {
      fieldErrors.noticeAcknowledged = "Acknowledge the privacy notice to continue.";
    }
    if (Object.keys(fieldErrors).length > 0) {
      return { ok: false, code: "validation", fieldErrors };
    }

    const ageGate = evaluateAgeGate(input.selfReportedAge);
    if (!ageGate.ok) {
      return { ok: false, code: "age_refused", message: ageGate.message };
    }

    const existing = this.findAuthUserByEmail(email);
    if (existing) {
      const rate = this.checkResendCooldown(email, now);
      if (!rate.ok) {
        return {
          ok: false,
          code: "rate_limited",
          retryAfterSeconds: rate.retryAfterSeconds,
        };
      }
      this.issueMagicLink(existing.id, now);
      return { ok: true, neutralMessage: NEUTRAL_EMAIL_MESSAGE };
    }

    const authUserId = randomUUID();
    const authUser: AuthUserRecord = {
      id: authUserId,
      email,
      createdAt: now.toISOString(),
    };
    this.authUsers.set(authUserId, authUser);
    this.authUsersByEmail.set(email, authUserId);

    const memberId = randomUUID();
    const member: MemberRecord = {
      id: memberId,
      authUserId,
      chosenFirstName: firstName,
      selfReportedAge: input.selfReportedAge,
      source,
      homeZip: zip,
      isInServiceArea: isInServiceArea(zip),
      status: "active",
      profileStatus: "draft",
      availabilityCadence: "weekly",
      pickleballExperience: null,
      profileCompletedAt: null,
      pausedAt: null,
      deletionRequestedAt: null,
      lastMemberActivityAt: now.toISOString(),
      createdAt: now.toISOString(),
    };
    this.members.set(memberId, member);
    this.membersByAuthUser.set(authUserId, memberId);

    this.roleGrants.push({
      id: randomUUID(),
      authUserId,
      role: "member",
      grantedAt: now.toISOString(),
      revokedAt: null,
    });

    this.issueMagicLink(authUserId, now);
    return { ok: true, neutralMessage: NEUTRAL_EMAIL_MESSAGE };
  }

  buildSession(authUserId: string, email: string): VerifiedSession {
    const member = this.findMemberByAuthUserId(authUserId);
    const roles = this.activeRoles(authUserId);
    return {
      authUserId,
      email,
      memberId: member?.id ?? null,
      roles,
    };
  }

  activeRoles(authUserId: string): VerifiedSession["roles"] {
    return this.roleGrants
      .filter((g) => g.authUserId === authUserId && g.revokedAt === null)
      .map((g) => g.role);
  }

  hasStaffAccess(authUserId: string): boolean {
    const roles = this.activeRoles(authUserId);
    return roles.some((r) => r !== "member");
  }

  grantRoleForTests(
    authUserId: string,
    role: RoleGrantRecord["role"],
    now = new Date(),
  ): void {
    this.roleGrants.push({
      id: randomUUID(),
      authUserId,
      role,
      grantedAt: now.toISOString(),
      revokedAt: null,
    });
  }

  revokeSessionsForMember(memberId: string): void {
    const member = this.members.get(memberId);
    if (!member) return;
    for (const link of this.magicLinks.values()) {
      if (link.authUserId === member.authUserId && !link.usedAt) {
        link.usedAt = new Date().toISOString();
      }
    }
  }

  removeMemberForTests(memberId: string): void {
    const member = this.members.get(memberId);
    if (!member) return;
    const authUser = this.authUsers.get(member.authUserId);
    this.members.delete(memberId);
    this.membersByAuthUser.delete(member.authUserId);
    if (authUser) {
      this.authUsersByEmail.delete(normalizeEmail(authUser.email));
    }
    this.authUsers.delete(member.authUserId);
    for (const [token, link] of this.magicLinks.entries()) {
      if (link.authUserId === member.authUserId) this.magicLinks.delete(token);
    }
    this.roleGrants = this.roleGrants.filter((g) => g.authUserId !== member.authUserId);
  }

  private checkResendCooldown(
    email: string,
    now: Date,
  ): MagicLinkSendResult | { ok: true } {
    const key = hashEmail(email);
    const last = this.lastMagicLinkSent.get(key);
    if (last !== undefined) {
      const elapsed = (now.getTime() - last) / 1000;
      if (elapsed < MAGIC_LINK_RESEND_COOLDOWN_SECONDS) {
        const retryAfterSeconds = Math.ceil(
          MAGIC_LINK_RESEND_COOLDOWN_SECONDS - elapsed,
        );
        return { ok: false, code: "rate_limited", retryAfterSeconds };
      }
    }
    return { ok: true };
  }

  private issueMagicLink(authUserId: string, now: Date): void {
    const user = this.authUsers.get(authUserId);
    if (!user) return;

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(
      now.getTime() + MAGIC_LINK_VALIDITY_HOURS * 60 * 60 * 1000,
    );
    this.magicLinks.set(token, {
      token,
      authUserId,
      expiresAt: expiresAt.toISOString(),
      usedAt: null,
    });
    this.lastMagicLinkSent.set(hashEmail(user.email), now.getTime());
    // Processor hold: no external email; synthetic sink only records intent.
    this.outbox.push({
      kind: "auth_magic_link",
      authUserId,
      held: true,
      createdAt: now.toISOString(),
    });
  }
}

declare global {
  var __atlLocalAuthStore: LocalAuthStore | undefined;
}

export function getLocalAuthStore(): LocalAuthStore {
  if (!globalThis.__atlLocalAuthStore) {
    globalThis.__atlLocalAuthStore = new LocalAuthStore();
  }
  return globalThis.__atlLocalAuthStore;
}

export function getAuthProvider(): AuthProvider {
  return getLocalAuthStore();
}
