import { SignJWT, jwtVerify } from "jose";
import { createHash } from "node:crypto";
import { generateId } from "@meet-vista/core";
import { db } from "../db/client.js";
import { refreshTokens } from "../db/schema.js";
import { eq, lt } from "drizzle-orm";

export type AccessTokenPayload = {
  sub: string;
  email: string;
};

const jwtSecret = process.env["JWT_SECRET"];
if (!jwtSecret) throw new Error("JWT_SECRET env var is required");
const secret = new TextEncoder().encode(jwtSecret);

const ACCESS_TTL = Number(process.env["JWT_ACCESS_TTL"] ?? 3600);
const REFRESH_TTL = Number(process.env["JWT_REFRESH_TTL"] ?? 604800);

export class TokenService {
  async createAccessToken(userId: string, email: string): Promise<string> {
    return new SignJWT({ email })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TTL}s`)
      .sign(secret);
  }

  async createRefreshToken(userId: string): Promise<string> {
    const token = generateId("rt");
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + REFRESH_TTL * 1000);

    await db.insert(refreshTokens).values({
      id: generateId(),
      userId,
      tokenHash,
      expiresAt,
    });

    return token;
  }

  async verifyRefreshToken(token: string): Promise<string | null> {
    const tokenHash = this.hashToken(token);
    const now = new Date();

    const [record] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash));

    if (!record || record.expiresAt < now) return null;

    // Rotation: delete used token
    await db.delete(refreshTokens).where(eq(refreshTokens.id, record.id));

    return record.userId;
  }

  async revokeUserTokens(userId: string): Promise<void> {
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  }

  async cleanExpired(): Promise<void> {
    await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, new Date()));
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
    try {
      const { payload } = await jwtVerify(token, secret);
      return { sub: payload["sub"] as string, email: payload["email"] as string };
    } catch {
      return null;
    }
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}

export const tokenService = new TokenService();
