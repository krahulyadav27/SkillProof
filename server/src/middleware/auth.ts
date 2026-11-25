import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "@skillproof/shared";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
export type AuthUser = { id: string; role: Role; email: string; sessionVersion: number };
// Express middleware adds these properties to each request.
// eslint-disable-next-line @typescript-eslint/no-namespace
declare global { namespace Express { interface Request { user?: AuthUser; cookies?: Record<string, string> } } }
const secret = () => { if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be set to at least 32 characters."); return process.env.JWT_SECRET; };
export function signToken(user: AuthUser) { return jwt.sign(user, secret(), { expiresIn: "8h" }); }
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.skillproof ?? req.headers.authorization?.replace(/^Bearer /, "");
  if (!token) return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Please sign in." } });
  let claims: AuthUser;
  try { claims = jwt.verify(token, secret()) as AuthUser; } catch { return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Your session has expired." } }); }
  db.select({ id: users.id, email: users.email, role: users.role, sessionVersion: users.sessionVersion }).from(users).where(eq(users.id, claims.id)).limit(1).then(([current]) => {
    if (!current) return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "This account is no longer available." } });
    if (claims.sessionVersion !== current.sessionVersion) return res.status(401).json({ error: { code: "SESSION_REVOKED", message: "This session has been signed out." } });
    req.user = current;
    next();
  }).catch(next);
}
export function requireRole(...roles: Role[]) { return (req: Request, res: Response, next: NextFunction) => req.user && roles.includes(req.user.role) ? next() : res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this resource." } }); }
