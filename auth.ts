import "server-only";

import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

import {
  fixedScheduleRedirect,
  isAllowedScheduleGithubAccount,
} from "@/features/auth/server/schedule-auth-policy";

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
    maxAge: 8 * 60 * 60,
    updateAge: 60 * 60,
  },
  trustHost: process.env.NODE_ENV !== "production"
    || process.env.AUTH_TRUST_HOST === "true",
  useSecureCookies: process.env.NODE_ENV === "production",
  callbacks: {
    signIn({ account }) {
      return account?.provider === "github"
        && isAllowedScheduleGithubAccount(
          account.providerAccountId,
          process.env,
        );
    },
    jwt({ token, account }) {
      if (account) {
        if (
          account.provider === "github"
          && isAllowedScheduleGithubAccount(account.providerAccountId, process.env)
        ) {
          token.scheduleProviderAccountId = account.providerAccountId;
        } else {
          delete token.scheduleProviderAccountId;
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.scheduleAccess = isAllowedScheduleGithubAccount(
          typeof token.scheduleProviderAccountId === "string"
            ? token.scheduleProviderAccountId
            : undefined,
          process.env,
        );
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
