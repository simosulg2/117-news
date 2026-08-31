import type { NextRequest } from "next/server";

import { handlers } from "@/auth";
import { getScheduleAuthState } from "@/features/auth/server/schedule-auth-policy";

export const dynamic = "force-dynamic";

function authenticationUnavailable(): Response {
  return new Response("Authentication is unavailable.", {
    status: 503,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export function GET(request: NextRequest): Response | Promise<Response> {
  if (!getScheduleAuthState(process.env).configured) {
    return authenticationUnavailable();
  }
  return handlers.GET(request);
}

export function POST(request: NextRequest): Response | Promise<Response> {
  if (!getScheduleAuthState(process.env).configured) {
    return authenticationUnavailable();
  }
  return handlers.POST(request);
}
