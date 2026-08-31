import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      scheduleAccess?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    scheduleProviderAccountId?: string;
  }
}
