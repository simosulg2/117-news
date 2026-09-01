import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      scheduleAccess?: boolean;
      scheduleUserId?: string;
      scheduleIsAdmin?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    scheduleUserId?: string;
    scheduleIsAdmin?: boolean;
  }
}
