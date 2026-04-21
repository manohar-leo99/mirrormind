import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user: DefaultSession["user"] & {
      id?: string;
      teamId?: string;
      role?: "admin" | "developer" | "viewer";
      isNewUser?: boolean;
    };
  }

  interface User {
    id?: string;
    teamId?: string;
    role?: "admin" | "developer" | "viewer";
    isNewUser?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    teamId?: string;
    role?: "admin" | "developer" | "viewer";
    isNewUser?: boolean;
    accessToken?: string;
  }
}
