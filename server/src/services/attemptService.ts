import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { attempts, challenges, questions, skillReceipts, skills, userSkills } from "../db/schema.js";
import { signReceipt } from "./receiptService.js";
export function calculateScore(qs: Array<{ id: string; prompt: string; correctAnswer: number; points: number; explanation: string }>, answers: Record<string, number>) {
  const maxScore = qs.reduce((sum, q) => sum + q.points, 0);
  const score = qs.reduce((sum, q) => sum + (answers[q.id] === q.correctAnswer ? q.points : 0), 0);
  const feedback = qs.map(q => `${q.prompt}: ${answers[q.id] === q.correctAnswer ? "Correct." : `Review: ${q.explanation}`}`).join("\n");
  return { score, maxScore, feedback };
}
export async function startAttempt(userId: string, challengeId: string) {
  const [challenge] = await db.select().from(challenges).where(and(eq(challenges.id, challengeId), eq(challenges.published, true))).limit(1);
  if (!challenge) throw Object.assign(new Error("Challenge not found."), { status: 404 });
  const [existing] = await db.select().from(attempts).where(and(eq(attempts.userId, userId), eq(attempts.challengeId, challengeId), eq(attempts.status, "IN_PROGRESS"))).limit(1);
  if (existing) return { attempt: existing, questions: await publicQuestions(challengeId) };
  const [attempt] = await db.insert(attempts).values({ userId, challengeId }).returning();
  return { attempt, questions: await publicQuestions(challengeId) };
}
async function publicQuestions(challengeId: string) { return db.select({ id: questions.id, prompt: questions.prompt, options: questions.options, position: questions.position, points: questions.points }).from(questions).where(eq(questions.challengeId, challengeId)).orderBy(questions.position); }
export async function submitAttempt(userId: string, attemptId: string, answers: Record<string, number>) {
  return db.transaction(async tx => {
    const [attempt] = await tx.select().from(attempts).where(and(eq(attempts.id, attemptId), eq(attempts.userId, userId))).for("update").limit(1);
    if (!attempt) throw Object.assign(new Error("Attempt not found."), { status: 404 });
    if (attempt.status === "SUBMITTED") throw Object.assign(new Error("This assessment has already been submitted."), { status: 409 });
    const qs = await tx.select().from(questions).where(eq(questions.challengeId, attempt.challengeId));
    if (!qs.length) throw Object.assign(new Error("This challenge has no questions yet."), { status: 422 });
    for (const [qid, answer] of Object.entries(answers)) { const q = qs.find(x => x.id === qid); if (!q || !Number.isInteger(answer) || answer < 0 || answer >= q.options.length) throw Object.assign(new Error("One or more answers are invalid."), { status: 400 }); }
    const { score, maxScore, feedback } = calculateScore(qs, answers);
    const [challenge] = await tx.select({ technology: challenges.technology }).from(challenges).where(eq(challenges.id, attempt.challengeId));
    if (challenge) {
      const level = Math.round(score * 100 / maxScore);
      await tx.insert(skills).values({ name: challenge.technology }).onConflictDoNothing();
      const [skill] = await tx.select({ id: skills.id }).from(skills).where(eq(skills.name, challenge.technology)).limit(1);
      if (skill) await tx.insert(userSkills).values({ userId, skillId: skill.id, level, updatedAt: new Date() }).onConflictDoUpdate({ target: [userSkills.userId, userSkills.skillId], set: { level: sql`greatest(${userSkills.level}, excluded.level)`, updatedAt: new Date() } });
    }
    const [updated] = await tx.update(attempts).set({ status: "SUBMITTED", answers, score, maxScore, feedback, submittedAt: new Date() }).where(and(eq(attempts.id, attemptId), eq(attempts.status, "IN_PROGRESS"))).returning();
    if (!updated) throw Object.assign(new Error("This assessment has already been submitted."), { status: 409 });
    let receipt = null;
    if (score / maxScore >= 0.7) {
      const [candidate] = await tx.insert(skillReceipts).values({ userId, challengeId: attempt.challengeId, attemptId, score: Math.round(score * 100 / maxScore), signature: "pending" }).returning();
      const signature = signReceipt({ id: candidate!.id, userId, challengeId: attempt.challengeId, score: candidate!.score, issuedAt: candidate!.issuedAt });
      [receipt] = await tx.update(skillReceipts).set({ signature }).where(eq(skillReceipts.id, candidate!.id)).returning();
    }
    return { attempt: updated, receipt };
  });
}

