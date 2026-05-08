export type TeamRole = "admin" | "developer" | "viewer";

export interface JwtClaims {
  userId: string;
  teamId: string | null;
  role: TeamRole;
  type: "access" | "refresh";
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  id: string;
  teamId: string | null;
  role: TeamRole;
  email: string;
  name: string | null;
  githubId: string | null;
  authToken?: string;
  githubToken?: string;
}
