import { getAppEnvironment, isProcessorHoldEnforced } from "@/lib/env";

export async function GET() {
  return Response.json({
    status: "ok",
    environment: getAppEnvironment(),
    processorHold: isProcessorHoldEnforced(),
    auth: "local-stub",
  });
}
