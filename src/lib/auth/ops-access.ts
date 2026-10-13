import { STAFF_ROLES, type AppRole, type VerifiedSession } from "@/lib/auth/types";

export function sessionHasStaffRole(session: VerifiedSession | null): boolean {
  if (!session) return false;
  return session.roles.some((role) =>
    (STAFF_ROLES as readonly AppRole[]).includes(role),
  );
}

/** Plain members must not reach `/ops` (S0/S1 route isolation). */
export function canAccessOpsRoutes(session: VerifiedSession | null): boolean {
  return sessionHasStaffRole(session);
}
