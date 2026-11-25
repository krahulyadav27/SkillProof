import { describe, expect, it } from "vitest";
import { calculateScore } from "./attemptService.js";
import { signReceipt, verifySignature } from "./receiptService.js";

describe("assessment scoring", () => {
  it("calculates weighted points and feedback on the server", () => {
    const qs = [
      { id: "a", prompt: "State hook", correctAnswer: 1, points: 2, explanation: "Use state." },
      { id: "b", prompt: "List key", correctAnswer: 0, points: 1, explanation: "Keys track items." }
    ];
    expect(calculateScore(qs, { a: 1, b: 1 })).toEqual({ score: 2, maxScore: 3, feedback: "State hook: Correct.\nList key: Review: Keys track items." });
  });
});

describe("signed achievement receipts", () => {
  const receipt = { id: "receipt-1", userId: "student-1", challengeId: "challenge-1", score: 90, issuedAt: new Date("2026-11-25T10:00:00.000Z") };
  it("verifies an authentic signature and rejects modified record data", () => {
    process.env.RECEIPT_SIGNING_SECRET = "test-receipt-signing-secret-with-32-chars";
    const signature = signReceipt(receipt);
    expect(verifySignature(receipt, signature)).toBe(true);
    expect(verifySignature({ ...receipt, score: 91 }, signature)).toBe(false);
  });
});
