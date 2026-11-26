import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./sessionCookie.js";

describe("session cookie options", () => {
  it("supports credentialed cross-site HTTPS requests in production", () => {
    expect(getSessionCookieOptions("production")).toEqual({
      httpOnly: true,
      sameSite: "none",
      secure: true,
      path: "/"
    });
  });

  it("keeps the local development cookie restricted to same-site requests", () => {
    expect(getSessionCookieOptions("development")).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/"
    });
  });
});
