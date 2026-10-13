"use server";

import { redirect } from "next/navigation";

import { getAuthProvider } from "@/lib/auth/local-auth-store";
import { writeSessionCookie } from "@/lib/auth/session";
import type { SignupCommandInput } from "@/lib/auth/types";

export async function signupAction(formData: FormData) {
  const input: SignupCommandInput = {
    chosenFirstName: String(formData.get("chosenFirstName") ?? ""),
    email: String(formData.get("email") ?? ""),
    selfReportedAge: Number(formData.get("selfReportedAge")),
    homeZip: String(formData.get("homeZip") ?? ""),
    source: String(formData.get("source") ?? ""),
    noticeAcknowledged: formData.get("noticeAcknowledged") === "on",
  };

  const auth = getAuthProvider();
  const result = auth.completeSignup(input);
  if (!result.ok) {
    if (result.code === "age_refused") {
      redirect("/signup?refusal=age");
    }
    redirect("/signup?error=validation");
  }
  redirect("/signup/complete");
}

export async function requestSignInLinkAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const auth = getAuthProvider();
  const result = auth.sendMagicLinkForSignIn(email);
  if (!result.ok) {
    redirect(`/sign-in?rate=${result.retryAfterSeconds}`);
  }
  redirect("/signup/complete");
}

export async function establishSessionFromMagicLink(token: string) {
  const auth = getAuthProvider();
  const session = auth.verifyMagicLink(token);
  if (!session) {
    return { ok: false as const, code: "expired" as const };
  }
  await writeSessionCookie(session);
  return { ok: true as const };
}
