export type AppEnvironment = "local" | "preview" | "production";

export function getAppEnvironment(): AppEnvironment {
  const raw = process.env.APP_ENV ?? process.env.VERCEL_ENV ?? "local";
  if (raw === "production") return "production";
  if (raw === "preview") return "preview";
  return "local";
}

export function isProcessorHoldEnforced(): boolean {
  return process.env.PROCESSOR_HOLD !== "false";
}

export function getPublicAppName(): string {
  return process.env.NEXT_PUBLIC_APP_NAME ?? "Find Your Peeps";
}
