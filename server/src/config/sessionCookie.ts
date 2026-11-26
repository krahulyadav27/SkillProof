import type { CookieOptions } from "express";

export function getSessionCookieOptions(nodeEnv = process.env.NODE_ENV): CookieOptions {
  const production = nodeEnv === "production";

  return {
    httpOnly: true,
    sameSite: production ? "none" : "lax",
    secure: production,
    path: "/"
  };
}
