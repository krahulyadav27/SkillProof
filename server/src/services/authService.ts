import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import type { AuthUser } from "../middleware/auth.js";
export async function register(name: string, email: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(users).values({ name, email: email.toLowerCase(), passwordHash }).returning({ id: users.id, name: users.name, email: users.email, role: users.role, sessionVersion: users.sessionVersion });
  return user;
}
export async function login(email: string, password: string): Promise<AuthUser | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;
  return { id: user.id, email: user.email, role: user.role, sessionVersion: user.sessionVersion };
}
