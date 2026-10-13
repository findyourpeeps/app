import { NextResponse } from "next/server";

import { establishSessionFromMagicLink } from "@/app/actions/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/sign-in?error=missing", url.origin));
  }

  const result = await establishSessionFromMagicLink(token);
  if (!result.ok) {
    return NextResponse.redirect(new URL("/sign-in?error=expired", url.origin));
  }

  return NextResponse.redirect(new URL("/home", url.origin));
}
