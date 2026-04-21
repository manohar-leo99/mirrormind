import crypto from "crypto";
import jwt from "jsonwebtoken";

import type { JwtClaims, TeamRole } from "../types/auth";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }
  return secret;
}

export function signAccessToken(payload: {
  userId: string;
  teamId: string | null;
  role: TeamRole;
}): string {
  const options: jwt.SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN ??
      "15m") as jwt.SignOptions["expiresIn"],
  };

  return jwt.sign(
    {
      ...payload,
      type: "access",
    },
    getJwtSecret(),
    options,
  );
}

export function signRefreshToken(payload: {
  userId: string;
  teamId: string | null;
  role: TeamRole;
}): string {
  const options: jwt.SignOptions = {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ??
      "7d") as jwt.SignOptions["expiresIn"],
  };

  return jwt.sign(
    {
      ...payload,
      type: "refresh",
    },
    getJwtSecret(),
    options,
  );
}

export function verifyToken(token: string): JwtClaims {
  return jwt.verify(token, getJwtSecret()) as JwtClaims;
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function decodeExpiry(token: string): Date {
  const decoded = jwt.decode(token) as JwtClaims | null;
  if (!decoded?.exp) {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  return new Date(decoded.exp * 1000);
}
