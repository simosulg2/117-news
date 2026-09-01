import "server-only";

import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

import {
  fixedScheduleRedirect,
  getScheduleAuthState,
} from "@/features/auth/server/schedule-auth-policy";
import { takePendingScheduleInviteToken } from "@/features/auth/server/schedule-invite-cookie.server";
import { takePendingScheduleSessionPreference } from "@/features/auth/server/schedule-session-preference.server";
import {
  applyScheduleAccessToToken,
  beginScheduleSession,
  refreshScheduleSession,
} from "@/features/auth/server/schedule-session-token";
import {
  authorizeScheduleSignIn,
  findScheduleUserByProviderAccountId,
  getScheduleUserAccessById,
  type ScheduleUserAccess,
} from "@/features/auth/server/schedule-user-store.server";

export const { auth, handlers, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  ],
  pages: {
    signIn: "/sisene",
    error: "/sisene",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  trustHost: process.env.NODE_ENV !== "production"
    || process.env.AUTH_TRUST_HOST === "true",
  useSecureCookies: process.env.NODE_ENV === "production",
  callbacks: {
    async signIn({ account }) {
      if (
        account?.provider !== "github"
        || !getScheduleAuthState(process.env).configured
      ) return false;
      try {
        const invitation = await takePendingScheduleInviteToken();
        return Boolean(await authorizeScheduleSignIn(
          account.providerAccountId,
          invitation,
        ));
      } catch {
        return false;
      }
    },
    async jwt({ token, account }) {
      if (account?.provider === "github") {
        let remembered = false;
        try {
          remembered = await takePendingScheduleSessionPreference();
        } catch {
          // Missing preference fails safely to the short session.
        }
        beginScheduleSession(token, remembered);
      } else if (!refreshScheduleSession(token)) {
        return null;
      }

      let access: ScheduleUserAccess | null = null;
      try {
        access = account?.provider === "github"
          ? await findScheduleUserByProviderAccountId(account.providerAccountId)
          : await getScheduleUserAccessById(
            typeof token.scheduleUserId === "string"
              ? token.scheduleUserId
              : undefined,
          );
      } catch {
        access = null;
      }
      return applyScheduleAccessToToken(token, access);
    },
    session({ session, token }) {
      if (session.user) {
        const scheduleUserId = typeof token.scheduleUserId === "string"
          ? token.scheduleUserId
          : undefined;
        session.user.scheduleAccess = Boolean(scheduleUserId);
        session.user.scheduleUserId = scheduleUserId;
        session.user.scheduleIsAdmin = scheduleUserId
          ? token.scheduleIsAdmin === true
          : false;
      }
      return session;
    },
    redirect({ url, baseUrl }) {
      return fixedScheduleRedirect(url, baseUrl);
    },
  },
  logger: {
    error() {
      console.error("[schedule-auth] Authentication request failed.");
    },
    warn() {
      console.warn("[schedule-auth] Authentication warning.");
    },
    debug() {
      // Authentication details are intentionally not logged.
    },
  },
});
