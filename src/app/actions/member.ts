"use server";

import { redirect } from "next/navigation";

import { readSessionCookie } from "@/lib/auth/session";
import { getAppStore } from "@/lib/product/app-store";
import type { ProfileSectionId } from "@/lib/product/types";

async function requireMemberSession() {
  const session = await readSessionCookie();
  if (!session?.memberId) {
    redirect("/sign-in?next=/home");
  }
  return session;
}

export async function saveProfileSectionAction(formData: FormData) {
  const session = await requireMemberSession();
  const section = String(formData.get("section")) as ProfileSectionId;
  const firmnessRaw = formData.get("firmness");
  const firmness =
    firmnessRaw === "firm" || firmnessRaw === "flexible" ? firmnessRaw : "flexible";

  let payload: unknown;
  switch (section) {
    case "gender":
      payload = { value: String(formData.get("genderIdentity") ?? "") };
      break;
    case "dating-genders":
      payload = {
        values: formData
          .getAll("datingGenders")
          .map((v) => String(v))
          .filter(Boolean),
      };
      break;
    case "age-range":
      payload = {
        min: Number(formData.get("ageMin")),
        max: Number(formData.get("ageMax")),
      };
      break;
    case "intention":
      payload = { value: String(formData.get("intention") ?? "") };
      break;
    case "structure":
      payload = { value: String(formData.get("structure") ?? "") };
      break;
    case "experience":
      payload = String(formData.get("experience") ?? "");
      break;
    default:
      redirect("/profile/setup/gender?error=validation");
  }

  const store = getAppStore();
  const result = store.saveProfileSection({
    memberId: session.memberId!,
    section,
    payload,
    firmness: section === "experience" ? undefined : firmness,
  });

  if (!result.ok) {
    redirect(`/profile/setup/${section}?error=${result.code}`);
  }

  const order: ProfileSectionId[] = [
    "gender",
    "dating-genders",
    "age-range",
    "intention",
    "experience",
    "structure",
  ];
  const idx = order.indexOf(section);
  const next = order[idx + 1];
  if (next) {
    redirect(`/profile/setup/${next}?saved=1`);
  }
  redirect("/profile?saved=1");
}

export async function saveAvailabilityAction(formData: FormData) {
  const session = await requireMemberSession();
  const dates = formData
    .getAll("evening")
    .map((v) => String(v))
    .filter(Boolean);
  const store = getAppStore();
  const result = store.saveAvailability({
    memberId: session.memberId!,
    eveningDates: dates,
  });
  if (!result.ok) {
    redirect("/availability?error=save");
  }
  redirect("/availability?saved=1");
}

export async function saveAvailabilityNoneAction() {
  const session = await requireMemberSession();
  const result = getAppStore().saveAvailability({
    memberId: session.memberId!,
    eveningDates: [],
  });
  if (!result.ok) redirect("/availability?error=save");
  redirect("/availability?saved=1");
}

export async function saveCadenceAction(formData: FormData) {
  const session = await requireMemberSession();
  const cadence = String(formData.get("cadence"));
  if (cadence !== "weekly" && cadence !== "every_other_week") {
    redirect("/settings?error=cadence");
  }
  getAppStore().setCadence(session.memberId!, cadence);
  redirect("/settings?saved=1");
}

export async function pauseMemberAction() {
  const session = await requireMemberSession();
  const result = getAppStore().pauseMember(session.memberId!);
  if (!result.ok) redirect("/settings?error=pause");
  redirect("/settings?paused=1");
}

export async function resumeMemberAction() {
  const session = await requireMemberSession();
  const result = getAppStore().resumeMember(session.memberId!);
  if (!result.ok) redirect("/settings?error=resume");
  redirect("/settings?resumed=1");
}

export async function requestDeletionAction() {
  const session = await requireMemberSession();
  getAppStore().requestDeletion(session.memberId!);
  redirect("/settings?deletion=1");
}

export async function cancelDeletionRequestAction() {
  const session = await requireMemberSession();
  const result = getAppStore().cancelDeletionRequest(session.memberId!);
  if (!result.ok) redirect("/settings?error=deletion_cancel");
  redirect("/settings?deletion_canceled=1");
}

export async function respondInvitationAction(formData: FormData) {
  const session = await requireMemberSession();
  const invitationId = String(formData.get("invitationId") ?? "");
  const response = String(formData.get("response") ?? "");
  if (response !== "accept" && response !== "decline") {
    redirect("/invitations?error=response");
  }
  const result = getAppStore().respondInvitation({
    invitationId,
    memberId: session.memberId!,
    response,
  });
  if (!result.ok) {
    if (result.code === "full") {
      redirect(`/invitations/${invitationId}?error=full`);
    }
    redirect(`/invitations/${invitationId}?error=${result.code}`);
  }
  redirect(`/invitations/${invitationId}?saved=1`);
}

export async function confirmReconfirmationAction(formData: FormData) {
  const session = await requireMemberSession();
  const invitationId = String(formData.get("invitationId") ?? "");
  const result = getAppStore().confirmReconfirmation({
    invitationId,
    memberId: session.memberId!,
  });
  if (!result.ok) {
    redirect(`/invitations/${invitationId}?error=${result.code}`);
  }
  redirect(`/invitations/${invitationId}?confirmed=1`);
}

export async function createPrivateSelectionAction(formData: FormData) {
  const session = await requireMemberSession();
  const eventId = String(formData.get("eventId") ?? "");
  const targetEventParticipantId = String(formData.get("targetEventParticipantId") ?? "");
  const result = getAppStore().createPrivateSelection({
    eventId,
    selectorMemberId: session.memberId!,
    targetEventParticipantId,
  });
  if (!result.ok) redirect(`/follow-up?error=${result.code}`);
  redirect("/follow-up?saved=1");
}

export async function authorizeConnectionAction(formData: FormData) {
  const session = await requireMemberSession();
  const connectionId = String(formData.get("connectionId") ?? "");
  const result = getAppStore().authorizeConnection({
    connectionId,
    memberId: session.memberId!,
    contactField: "verified_email",
  });
  if (!result.ok) redirect(`/connections?error=${result.code}`);
  redirect("/connections?saved=1");
}

export async function submitIncidentReportAction(formData: FormData) {
  const session = await requireMemberSession();
  const narrative = String(formData.get("narrative") ?? "").trim();
  if (narrative.length < 10) redirect("/safety/report?error=short");
  getAppStore().submitIncidentReport({
    reporterMemberId: session.memberId!,
    eventId: null,
    involvedEventParticipantId: null,
    narrative,
  });
  redirect("/safety/report?saved=1");
}
