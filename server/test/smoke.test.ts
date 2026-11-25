import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("API behavior without database setup", () => {
  it("serves its health endpoint", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { status: "ok" } });
  });
  it("returns consistent validation, authentication, and not-found errors", async () => {
    const invalidRegistration = await request(app).post("/api/auth/register").send({ name: "x", email: "bad", password: "short" });
    expect(invalidRegistration.status).toBe(400);
    expect(invalidRegistration.body.error.code).toBe("VALIDATION_ERROR");
    const unauthenticated = await request(app).get("/api/dashboard");
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe("UNAUTHENTICATED");
    expect((await request(app).post("/api/auth/logout")).status).toBe(401);
    const invalidReceiptId = await request(app).get("/api/verify/not-a-uuid");
    expect(invalidReceiptId.status).toBe(400);
    const missingRoute = await request(app).get("/api/no-such-route");
    expect(missingRoute.status).toBe(404);
  });
});
