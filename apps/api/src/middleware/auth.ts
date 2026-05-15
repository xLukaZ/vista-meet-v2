import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { jwtVerify } from "jose";

export type AuthUser = {
  userId: string;
  email: string;
};

// Falls back to "" so jwtVerify fails with an invalid-key error rather than accepting any forged token
const secret = new TextEncoder().encode(process.env["JWT_SECRET"] ?? "");

export const authMiddleware = createMiddleware<{
  Variables: { user: AuthUser };
}>(async (c, next) => {
  const token = getCookie(c, "access_token");

  if (!token) {
    return c.json({ code: "UNAUTHORIZED", message: "Missing access token" }, 401);
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    c.set("user", {
      userId: payload["sub"] as string,
      email: payload["email"] as string,
    });
    return await next();
  } catch {
    return c.json({ code: "TOKEN_EXPIRED", message: "Invalid or expired token" }, 401);
  }
});
