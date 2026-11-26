import cors from "cors";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createCorsOptions } from "./cors.js";

const productionOrigin = "https://skillproof-xhka.onrender.com";

describe("credentialed CORS configuration", () => {
  it("allows configured production and local origins on credentialed preflight", async () => {
    const app = express();
    app.use(cors(createCorsOptions({ CLIENT_ORIGINS: productionOrigin, CLIENT_ORIGIN: "http://localhost:5173" })));
    app.post("/api/auth/login", (_req, res) => res.json({ ok: true }));

    for (const origin of [productionOrigin, "http://localhost:5173"]) {
      const response = await request(app)
        .options("/api/auth/login")
        .set("Origin", origin)
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "content-type");

      expect(response.status).toBe(204);
      expect(response.headers["access-control-allow-origin"]).toBe(origin);
      expect(response.headers["access-control-allow-credentials"]).toBe("true");
      expect(response.headers["access-control-allow-methods"]).toContain("POST");
      expect(response.headers["access-control-allow-headers"]).toContain("content-type");
    }
  });

  it("does not reflect unconfigured origins or allow wildcard credentials", async () => {
    const app = express();
    app.use(cors(createCorsOptions({ CLIENT_ORIGINS: "*,https://trusted.example.com" })));

    const response = await request(app)
      .options("/api/auth/login")
      .set("Origin", "https://attacker.example.com")
      .set("Access-Control-Request-Method", "POST");

    expect(response.status).toBe(404);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(response.headers["access-control-allow-credentials"]).toBeUndefined();
  });
});
