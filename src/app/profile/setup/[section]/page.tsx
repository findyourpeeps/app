import Link from "next/link";
import { redirect } from "next/navigation";

import { saveProfileSectionAction } from "@/app/actions/member";
import { SiteHeader } from "@/components/site-header";
import { readSessionCookie } from "@/lib/auth/session";
import { getAppStore } from "@/lib/product/app-store";
import {
  PROFILE_SECTION_LABELS,
  PROFILE_SECTION_ORDER,
} from "@/lib/product/profile-sections";
import { readRelationshipIntentionValue } from "@/lib/product/matching";
import type { Firmness, ProfileSectionId } from "@/lib/product/types";

const VALID: ProfileSectionId[] = PROFILE_SECTION_ORDER;

export const instant = false;

export default async function ProfileSetupSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const session = await readSessionCookie();
  if (!session?.memberId) redirect("/sign-in?next=/profile/setup/gender");

  const { section: rawSection } = await params;
  if (!VALID.includes(rawSection as ProfileSectionId)) {
    redirect("/profile/setup/gender");
  }
  const section = rawSection as ProfileSectionId;
  const sp = await searchParams;

  const store = getAppStore();
  const member = store.getMemberProfileView(session.memberId);
  if (!member) redirect("/sign-in");
  if (member.status === "deletion_requested") {
    redirect("/profile");
  }

  const items = store.getMatchingItems(session.memberId);
  const progress = store.sectionProgress(member, items);
  const doneCount = PROFILE_SECTION_ORDER.filter((s) => progress[s] === "done").length;
  const savedIntention = readRelationshipIntentionValue(items);
  const intentionItem = items.find(
    (i) => i.kind === "relationship_intention" && i.itemKey === "primary" && i.isActive,
  );
  const intentionFirmness: Firmness = intentionItem?.firmness ?? "firm";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl flex-1 px-4 py-10">
        <p className="text-sm text-zinc-600">
          {doneCount} of {PROFILE_SECTION_ORDER.length} sections done
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          {PROFILE_SECTION_LABELS[section]}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Only the people who plan the nights see this section.
        </p>
        {sp.error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            We couldn&apos;t save this section. What you entered here is still on the page.
            Earlier sections are saved.
          </p>
        ) : null}
        {sp.saved ? (
          <p className="mt-4 text-sm text-green-800">Saved.</p>
        ) : null}

        <form action={saveProfileSectionAction} className="mt-8 space-y-6">
          <input type="hidden" name="section" value={section} />

          {section === "gender" ? (
            <>
              <label className="block text-sm font-medium text-zinc-800">
                Gender identity
                <input
                  name="genderIdentity"
                  required
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
                />
              </label>
              <FirmnessField defaultValue="flexible" />
            </>
          ) : null}

          {section === "dating-genders" ? (
            <>
              <fieldset>
                <legend className="text-sm font-medium text-zinc-800">
                  Genders you date
                </legend>
                {["woman", "man", "nonbinary"].map((g) => (
                  <label key={g} className="mt-2 flex items-center gap-2 text-sm">
                    <input type="checkbox" name="datingGenders" value={g} />
                    {g}
                  </label>
                ))}
              </fieldset>
              <FirmnessField defaultValue="flexible" />
            </>
          ) : null}

          {section === "age-range" ? (
            <>
              <div className="flex gap-4">
                <label className="block flex-1 text-sm font-medium text-zinc-800">
                  Minimum age
                  <input
                    name="ageMin"
                    type="number"
                    min={25}
                    max={45}
                    required
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
                  />
                </label>
                <label className="block flex-1 text-sm font-medium text-zinc-800">
                  Maximum age
                  <input
                    name="ageMax"
                    type="number"
                    min={25}
                    max={45}
                    required
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
                  />
                </label>
              </div>
              <FirmnessField defaultValue="flexible" />
            </>
          ) : null}

          {section === "intention" ? (
            <>
              <fieldset>
                <legend className="text-sm font-medium text-zinc-800">
                  Relationship intention
                </legend>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="intention"
                    value="long_term"
                    required
                    defaultChecked={savedIntention === "long_term"}
                  />
                  A serious relationship
                </label>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="intention"
                    value="open_to_long_term"
                    required
                    defaultChecked={savedIntention === "open_to_long_term"}
                  />
                  Open to something serious
                </label>
              </fieldset>
              <FirmnessField defaultValue={intentionFirmness} />
            </>
          ) : null}

          {section === "experience" ? (
            <fieldset>
              <legend className="text-sm font-medium text-zinc-800">
                Pickleball experience
              </legend>
              <p className="text-sm text-zinc-600">
                We only use this to balance the courts.
              </p>
              {(
                [
                  ["never_played", "Never played"],
                  ["casual", "Casual"],
                  ["regular", "Regular"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="mt-2 flex items-center gap-2 text-sm">
                  <input type="radio" name="experience" value={value} required />
                  {label}
                </label>
              ))}
            </fieldset>
          ) : null}

          {section === "structure" ? (
            <>
              <label className="block text-sm font-medium text-zinc-800">
                Relationship structure
                <input
                  name="structure"
                  required
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
                />
              </label>
              <FirmnessField defaultValue="flexible" />
            </>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-4">
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
            >
              Save and continue
            </button>
            <Link
              href="/home"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm"
            >
              Save and finish later
            </Link>
          </div>
        </form>

        {section === "structure" ? (
          <Link href="/profile" className="mt-6 inline-block text-sm underline">
            Review your profile
          </Link>
        ) : null}
      </main>
    </>
  );
}

function FirmnessField({ defaultValue }: { defaultValue: "firm" | "flexible" }) {
  return (
    <fieldset className="mt-4">
      <legend className="text-sm font-medium text-zinc-800">Firm or flexible</legend>
      <p className="text-sm text-zinc-600">
        Firm means we won&apos;t invite you to a night that doesn&apos;t fit this. Flexible
        means we prefer this, but we might invite you anyway.
      </p>
      <label className="mt-2 flex items-center gap-2 text-sm">
        <input type="radio" name="firmness" value="firm" defaultChecked={defaultValue === "firm"} />
        Firm
      </label>
      <label className="mt-2 flex items-center gap-2 text-sm">
        <input
          type="radio"
          name="firmness"
          value="flexible"
          defaultChecked={defaultValue === "flexible"}
        />
        Flexible
      </label>
    </fieldset>
  );
}
