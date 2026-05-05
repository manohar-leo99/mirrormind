import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";

import { getBackendBaseUrl } from "@/lib/backendUrl";

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "github") {
        return true;
      }

      try {
        const response = await fetch(
          `${getBackendBaseUrl()}/api/auth/github/sync`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              githubId: (profile as { id?: string | number } | undefined)?.id,
              email: user.email,
              name: user.name,
              avatarUrl: user.image,
            }),
          },
        );

        if (response.ok) {
          const payload = (await response.json()) as {
            userId?: string;
            teamId?: string;
            role?: "admin" | "developer" | "viewer";
            isNewUser?: boolean;
            accessToken?: string;
          };
          user.id = payload.userId;
          user.teamId = payload.teamId;
          user.role = payload.role ?? "developer";
          user.isNewUser = payload.isNewUser ?? false;
          user.backendAccessToken = payload.accessToken;
          user.githubAccessToken = account?.access_token;
        }
      } catch {
        user.role = "developer";
      }

      return true;
    },
    async jwt({ token, user, account }) {
      if (user?.backendAccessToken) {
        token.backendAccessToken = user.backendAccessToken;
      }

      if (user?.githubAccessToken) {
        token.githubAccessToken = user.githubAccessToken;
      } else if (account?.access_token) {
        token.githubAccessToken = account.access_token;
      }

      token.accessToken =
        token.githubAccessToken ?? token.backendAccessToken ?? token.accessToken;

      if (user) {
        token.userId = user.id ?? token.sub;
        token.teamId = user.teamId;
        token.role = user.role ?? "developer";
        token.isNewUser = user.isNewUser ?? false;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId;
        session.user.teamId = token.teamId;
        session.user.role = token.role;
        session.user.isNewUser = token.isNewUser;
      }
      session.backendAccessToken = token.backendAccessToken;
      session.githubAccessToken = token.githubAccessToken;
      session.accessToken =
        token.githubAccessToken ?? token.backendAccessToken ?? token.accessToken;
      return session;
    },
  },
};
