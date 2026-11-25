import { createHmac, timingSafeEqual } from "node:crypto";
const secret = () => { if (!process.env.RECEIPT_SIGNING_SECRET || process.env.RECEIPT_SIGNING_SECRET.length < 32) throw new Error("RECEIPT_SIGNING_SECRET must be set to at least 32 characters."); return process.env.RECEIPT_SIGNING_SECRET; };
export function receiptPayload(r: { id: string; userId: string; challengeId: string; score: number; issuedAt: Date }) { return [r.id, r.userId, r.challengeId, r.score, r.issuedAt.toISOString()].join("|"); }
export function signReceipt(r: Parameters<typeof receiptPayload>[0]) { return createHmac("sha256", secret()).update(receiptPayload(r)).digest("hex"); }
export function verifySignature(r: Parameters<typeof receiptPayload>[0], signature: string) { const expected = Buffer.from(signReceipt(r), "hex"); let supplied: Buffer; try { supplied = Buffer.from(signature, "hex"); } catch { return false; } return supplied.length === expected.length && timingSafeEqual(supplied, expected); }
