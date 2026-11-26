import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { pool } from "../src/db/index.js";

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `student-${suffix}@example.test`;
const password = "correct-horse-battery";
let student: ReturnType<typeof request.agent>;
let admin: ReturnType<typeof request.agent>;
let reviewer: ReturnType<typeof request.agent>;
let otherStudent: ReturnType<typeof request.agent>;
let studentId = "";
let savedStudentCookie = "";
let attemptId = "";
let receiptId = "";
let challengeId = "";
let submissionId = "";

describe.skipIf(!process.env.DATABASE_URL)("PostgreSQL API integration", () => {
  beforeAll(async () => {
    student = request.agent(app);
    admin = request.agent(app);
    const registration = await student.post("/api/auth/register").send({ name: "Test Student", email, password });
    expect(registration.status).toBe(201);
    studentId = registration.body.data.user.id;
    savedStudentCookie = registration.headers["set-cookie"].find((cookie: string) => cookie.startsWith("skillproof="))!.split(";", 1)[0];
    const adminLogin = await admin.post("/api/auth/login").send({ email: process.env.SEED_ADMIN_EMAIL ?? "admin@skillproof.local", password: process.env.SEED_ADMIN_PASSWORD });
    expect(adminLogin.status).toBe(200);
    const catalog = await request(app).get("/api/challenges?limit=50");
    const challenge = catalog.body.data.find((item: any) => item.title === "React Fundamentals");
    if (!challenge) throw new Error("Run db:seed before API integration tests.");
    challengeId = challenge.id;
    otherStudent = request.agent(app);
    const otherRegistration = await otherStudent.post("/api/auth/register").send({ name: "Other Student", email: `other-${suffix}@example.test`, password });
    expect(otherRegistration.status).toBe(201);
  });
  afterAll(async () => { await pool.end(); });

  it("registers, logs in, loads and updates a profile, and rejects invalid credentials", async () => {
    const login = await student.post("/api/auth/login").send({ email, password });
    expect(login.status).toBe(200);
    expect(login.headers["set-cookie"][0]).toMatch(/HttpOnly/i);
    expect((await student.get("/api/dashboard")).status).toBe(200);
    expect((await student.get("/api/auth/me")).body.data.user.id).toBe(studentId);
    const profile = await student.patch("/api/profile").send({ name: "Test Student Updated", bio: "Testing the profile endpoint." });
    expect(profile.status).toBe(200);
    expect(profile.body.data.user.bio).toBe("Testing the profile endpoint.");
    expect((await request(app).post("/api/auth/login").send({ email, password: "incorrect-password" })).status).toBe(401);
  });

  it("enforces roles and uses current database roles instead of stale JWT claims", async () => {
    expect((await request(app).post("/api/attempts").send({ challengeId })).status).toBe(401);
    expect((await student.get("/api/admin/stats")).status).toBe(403);
    const stats = await admin.get("/api/admin/stats");
    expect(stats.status).toBe(200);
    expect(stats.body.data).toHaveProperty("users");
    expect((await admin.get(`/api/admin/users?q=${encodeURIComponent(email)}`)).body.data[0].email).toBe(email);
    expect((await admin.patch(`/api/admin/users/${studentId}/role`).send({ role: "REVIEWER" })).status).toBe(200);
    expect((await student.get("/api/admin/stats")).status).toBe(403);
    expect((await admin.patch(`/api/admin/users/${studentId}/role`).send({ role: "STUDENT" })).status).toBe(200);
  });

  it("lists/filter/paginates challenges and hides correct answers from students", async () => {
    const catalog = await request(app).get("/api/challenges?technology=React&difficulty=BEGINNER&page=1&limit=5");
    expect(catalog.status).toBe(200);
    expect(catalog.body.pagination).toMatchObject({ page: 1, limit: 5 });
    const detail = await student.get(`/api/challenges/${challengeId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.questions.length).toBeGreaterThan(0);
    expect(detail.body.data.questions[0]).not.toHaveProperty("correctAnswer");
    expect(detail.body.data.questions[0]).not.toHaveProperty("explanation");
    expect((await request(app).get("/api/challenges?difficulty=INVALID")).status).toBe(400);
  });

  it("supports admin challenge and question CRUD and publication validation", async () => {
    const payload = { title: `Audit Challenge ${suffix}`, description: "A challenge created by the PostgreSQL audit integration test.", technology: `Audit-${suffix.slice(0, 8)}`, difficulty: "BEGINNER", published: false };
    expect((await student.post("/api/admin/challenges").send(payload)).status).toBe(403);
    expect((await admin.post("/api/admin/challenges").send({ ...payload, published: true })).status).toBe(422);
    const created = await admin.post("/api/admin/challenges").send(payload);
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect((await admin.get(`/api/admin/challenges/${id}/questions`)).body.data).toHaveLength(0);
    const questionInput = { prompt: "Which value is true?", options: ["true", "false"], correctAnswer: 0, explanation: "Boolean true is true.", points: 2, position: 0 };
    const question = await admin.post(`/api/admin/challenges/${id}/questions`).send(questionInput);
    expect(question.status).toBe(201);
    expect(question.body.data.correctAnswer).toBe(0);
    expect((await admin.patch(`/api/admin/questions/${question.body.data.id}`).send(questionInput)).status).toBe(200);
    expect((await admin.patch(`/api/admin/challenges/${id}`).send({ published: true })).status).toBe(200);
    expect((await request(app).get(`/api/challenges/${id}`)).body.data.questions).toHaveLength(1);
    expect((await admin.get(`/api/challenges?technology=${encodeURIComponent(payload.technology)}`)).status).toBe(200);
    expect((await admin.patch(`/api/admin/challenges/${id}`).send({ published: false })).status).toBe(200);
    expect((await admin.delete(`/api/admin/questions/${question.body.data.id}`)).status).toBe(200);
    expect((await admin.delete(`/api/admin/challenges/${id}`)).body.data.deleted).toBe(true);
    expect((await admin.get("/api/admin/challenges")).status).toBe(200);
  });

  it("starts and scores an assessment once, updates skill progress, and verifies its receipt", async () => {
    const started = await student.post("/api/attempts").send({ challengeId });
    expect(started.status).toBe(201);
    attemptId = started.body.data.attempt.id;
    const answers = Object.fromEntries(started.body.data.questions.map((q: any, i: number) => [q.id, [1, 1, 0, 0, 0][i]]));
    const submitted = await student.post(`/api/attempts/${attemptId}/submit`).send({ answers });
    expect(submitted.status).toBe(200);
    expect(submitted.body.data.attempt.score).toBe(submitted.body.data.attempt.maxScore);
    expect(submitted.body.data.receipt).toBeTruthy();
    receiptId = submitted.body.data.receipt.id;
    expect((await student.post(`/api/attempts/${attemptId}/submit`).send({ answers })).status).toBe(409);
    const dashboard = await student.get("/api/dashboard");
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data).toMatchObject({ total: 1, completed: 1, average: 100 });
    expect(dashboard.body.data.skills).toContainEqual({ name: "React", level: 100 });
    expect((await student.get("/api/receipts")).body.data[0]).toMatchObject({ id: receiptId, score: 100 });
    expect((await request(app).get(`/api/verify/${receiptId}`)).body.data).toMatchObject({ valid: true, status: "VERIFIED" });
    expect((await student.get("/api/attempts")).body.data[0]).toMatchObject({ id: attemptId, status: "SUBMITTED" });
    expect((await otherStudent.get("/api/attempts")).body.data.some((row: any) => row.id === attemptId)).toBe(false);
    expect((await otherStudent.get("/api/receipts")).body.data.some((row: any) => row.id === receiptId)).toBe(false);
    expect((await admin.delete(`/api/admin/challenges/${challengeId}`)).status).toBe(409);
  });

  it("accepts practical submissions and records reviewer decisions/history", async () => {
    const created = await student.post("/api/submissions").send({ challengeId, url: "https://github.com/example/project", notes: "Please review the component structure." });
    expect(created.status).toBe(201);
    submissionId = created.body.data.id;
    expect((await student.get("/api/submissions")).body.data[0]).toMatchObject({ id: submissionId, reviews: [] });
    expect((await otherStudent.get("/api/submissions")).body.data.some((row: any) => row.id === submissionId)).toBe(false);
    expect((await student.get("/api/reviewer/submissions")).status).toBe(403);
    expect((await admin.patch(`/api/admin/users/${studentId}/role`).send({ role: "REVIEWER" })).status).toBe(200);
    reviewer = request.agent(app);
    expect((await reviewer.post("/api/auth/login").send({ email, password })).status).toBe(200);
    expect((await reviewer.get("/api/reviewer/submissions")).body.data.some((row: any) => row.id === submissionId)).toBe(true);
    const decision = await reviewer.post(`/api/reviewer/submissions/${submissionId}/reviews`).send({ decision: "APPROVED", feedback: "Clear component boundaries and useful tests." });
    expect(decision.status).toBe(201);
    const history = await reviewer.get(`/api/reviewer/submissions/${submissionId}/reviews`);
    expect(history.body.data.some((row: any) => row.decision === "APPROVED" && row.feedback === "Clear component boundaries and useful tests.")).toBe(true);
    expect((await reviewer.post(`/api/reviewer/submissions/${submissionId}/reviews`).send({ decision: "REJECTED", feedback: "Please include a keyboard navigation test." })).status).toBe(201);
    const revisedHistory = await reviewer.get(`/api/reviewer/submissions/${submissionId}/reviews`);
    expect(revisedHistory.body.data.map((row: any) => row.decision)).toEqual(expect.arrayContaining(["APPROVED", "REJECTED"]));
    expect((await admin.patch(`/api/admin/users/${studentId}/role`).send({ role: "STUDENT" })).status).toBe(200);
    expect((await reviewer.get("/api/reviewer/submissions")).status).toBe(403);
    const studentView = await student.get("/api/submissions");
    expect(studentView.body.data[0].reviews.map((row: any) => row.decision)).toEqual(expect.arrayContaining(["APPROVED", "REJECTED"]));
    expect((await student.post("/api/auth/logout")).body.data.loggedOut).toBe(true);
    expect((await student.get("/api/dashboard")).status).toBe(401);
    expect((await request(app).get("/api/dashboard").set("Cookie", savedStudentCookie)).status).toBe(401);
    expect((await student.get("/api/auth/me")).status).toBe(401);
    const relogin = await student.post("/api/auth/login").send({ email, password });
    expect(relogin.status).toBe(200);
    expect((await student.get("/api/auth/me")).body.data.user.id).toBe(studentId);
    expect((await request(app).get("/api/auth/me").set("Cookie", savedStudentCookie)).status).toBe(401);
    expect((await student.post("/api/auth/logout")).body.data.loggedOut).toBe(true);
    expect((await student.get("/api/auth/me")).status).toBe(401);
  });
});
