import type {
  MatchingItemRecord,
  RelationshipIntentionValue,
} from "@/lib/product/types";

export const ELIGIBLE_INTENTIONS: readonly RelationshipIntentionValue[] = [
  "long_term",
  "open_to_long_term",
] as const;

export interface MemberMatchingFacts {
  memberId: string;
  selfReportedAge: number;
  profileStatus: "draft" | "complete";
  status: "active" | "paused" | "deletion_requested";
  isInServiceArea: boolean;
  pickleballExperience: string | null;
  items: MatchingItemRecord[];
}

function item(
  items: MatchingItemRecord[],
  kind: MatchingItemRecord["kind"],
  key = "primary",
): MatchingItemRecord | undefined {
  return items.find((i) => i.kind === kind && i.itemKey === key && i.isActive);
}

function readString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && "value" in value) {
    const inner = (value as { value: unknown }).value;
    if (typeof inner === "string" && inner.trim()) return inner.trim();
  }
  return null;
}

function readStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
  }
  if (value && typeof value === "object" && "values" in value) {
    const inner = (value as { values: unknown }).values;
    if (Array.isArray(inner)) {
      return inner.filter((v): v is string => typeof v === "string" && v.trim() !== "");
    }
  }
  return [];
}

function readAgeRange(
  value: unknown,
): { min: number; max: number } | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as { min?: unknown; max?: unknown };
  if (typeof obj.min !== "number" || typeof obj.max !== "number") return null;
  if (obj.min > obj.max) return null;
  return { min: obj.min, max: obj.max };
}

export function readRelationshipIntentionValue(
  items: MatchingItemRecord[],
): RelationshipIntentionValue | null {
  const row = item(items, "relationship_intention");
  const raw = readString(row?.value);
  if (!raw || !(ELIGIBLE_INTENTIONS as readonly string[]).includes(raw)) {
    return null;
  }
  return raw as RelationshipIntentionValue;
}

export function intentionIsEligible(
  items: MatchingItemRecord[],
): boolean {
  return readRelationshipIntentionValue(items) !== null;
}

export function passesFirmGenderReciprocal(
  a: MemberMatchingFacts,
  b: MemberMatchingFacts,
): boolean {
  const aIdentity = readString(item(a.items, "gender_identity")?.value);
  const bIdentity = readString(item(b.items, "gender_identity")?.value);
  const aDates = readStringList(item(a.items, "dating_gender")?.value);
  const bDates = readStringList(item(b.items, "dating_gender")?.value);
  if (!aIdentity || !bIdentity || aDates.length === 0 || bDates.length === 0) {
    return false;
  }

  const aFirm = item(a.items, "dating_gender")?.firmness === "firm";
  const bFirm = item(b.items, "dating_gender")?.firmness === "firm";
  const aOk = !aFirm || aDates.includes(bIdentity);
  const bOk = !bFirm || bDates.includes(aIdentity);
  if (aFirm || bFirm) {
    return aOk && bOk && aDates.includes(bIdentity) && bDates.includes(aIdentity);
  }
  return aDates.includes(bIdentity) && bDates.includes(aIdentity);
}

export function passesFirmAgeReciprocal(
  a: MemberMatchingFacts,
  b: MemberMatchingFacts,
): boolean {
  const aRange = readAgeRange(item(a.items, "desired_age_range")?.value);
  const bRange = readAgeRange(item(b.items, "desired_age_range")?.value);
  if (!aRange || !bRange) return false;

  const aFirm = item(a.items, "desired_age_range")?.firmness === "firm";
  const bFirm = item(b.items, "desired_age_range")?.firmness === "firm";

  const aAgeOk =
    !aFirm ||
    (b.selfReportedAge >= aRange.min && b.selfReportedAge <= aRange.max);
  const bAgeOk =
    !bFirm ||
    (a.selfReportedAge >= bRange.min && a.selfReportedAge <= bRange.max);

  if (aFirm || bFirm) {
    return (
      aAgeOk &&
      bAgeOk &&
      b.selfReportedAge >= aRange.min &&
      b.selfReportedAge <= aRange.max &&
      a.selfReportedAge >= bRange.min &&
      a.selfReportedAge <= bRange.max
    );
  }
  return (
    b.selfReportedAge >= aRange.min &&
    b.selfReportedAge <= aRange.max &&
    a.selfReportedAge >= bRange.min &&
    a.selfReportedAge <= bRange.max
  );
}

export function passesFirmIntentionReciprocal(
  a: MemberMatchingFacts,
  b: MemberMatchingFacts,
): boolean {
  if (!intentionIsEligible(a.items) || !intentionIsEligible(b.items)) {
    return false;
  }
  return true;
}

export function hasActiveBlock(
  blocks: { creatorMemberId: string; blockedMemberId: string; status: string }[],
  aId: string,
  bId: string,
): boolean {
  return blocks.some(
    (bl) =>
      bl.status === "active" &&
      ((bl.creatorMemberId === aId && bl.blockedMemberId === bId) ||
        (bl.creatorMemberId === bId && bl.blockedMemberId === aId)),
  );
}

export function isReciprocallyEligible(
  a: MemberMatchingFacts,
  b: MemberMatchingFacts,
  blocks: { creatorMemberId: string; blockedMemberId: string; status: string }[],
): boolean {
  if (a.memberId === b.memberId) return false;
  if (a.profileStatus !== "complete" || b.profileStatus !== "complete") {
    return false;
  }
  if (a.status !== "active" || b.status !== "active") return false;
  if (hasActiveBlock(blocks, a.memberId, b.memberId)) return false;
  if (!passesFirmGenderReciprocal(a, b)) return false;
  if (!passesFirmAgeReciprocal(a, b)) return false;
  if (!passesFirmIntentionReciprocal(a, b)) return false;
  return true;
}

export function graphCoveragePasses(memberIds: string[], edges: Set<string>): boolean {
  if (memberIds.length === 0) return true;
  const degrees = new Map<string, number>();
  for (const id of memberIds) degrees.set(id, 0);
  for (const key of edges) {
    const [a, b] = key.split(":");
    if (!a || !b) continue;
    degrees.set(a, (degrees.get(a) ?? 0) + 1);
    degrees.set(b, (degrees.get(b) ?? 0) + 1);
  }
  return memberIds.every((id) => (degrees.get(id) ?? 0) >= 3);
}

export function edgeKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}
