import type { ProfileSectionId } from "@/lib/product/types";

export const PROFILE_SECTION_ORDER: ProfileSectionId[] = [
  "gender",
  "dating-genders",
  "age-range",
  "intention",
  "experience",
  "structure",
];

export const PROFILE_SECTION_LABELS: Record<ProfileSectionId, string> = {
  gender: "How you describe your gender",
  "dating-genders": "Who you'd like to meet",
  "age-range": "Age range you'll date (within 25-45)",
  intention: "What you're hoping for",
  experience: "Pickleball experience",
  structure: "Relationship structure",
};
