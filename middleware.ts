import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  getScheduleAuthState,
  hasAuthJsSessionCookie,
  SCHEDULE_PATH,
  SCHEDULE_SIGN_IN_PATH,
} from "@/features/auth/server/schedule-auth-policy";

function signInRedirect(request: NextRequest, configurationError: boolean): NextResponse {
  const destination = new URL(SCHEDULE_SIGN_IN_PATH, request.url);
  destination.searchParams.set("callbackUrl", SCHEDULE_PATH);
  if (configurationError) destination.searchParams.set("error", "Configuration");
  return NextResponse.redirect(destination);
}

export default function middleware(request: NextRequest): NextResponse {
  const state = getScheduleAuthState(process.env);
  if (state.developmentBypass) return NextResponse.next();
  if (!state.configured) return signInRedirect(request, true);

  const cookieNames = request.cookies.getAll().map((cookie) => cookie.name);
  if (!hasAuthJsSessionCookie(cookieNames)) return signInRedirect(request, false);

  // A cookie is only an optimistic signal. The page/data boundary must call
  // requireScheduleUser(), which validates the Auth.js session and membership.
  return NextResponse.next();
}

export const config = {
  matcher: ["/ajakava/:path*"],
};
