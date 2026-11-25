import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool } from "./db/index.js";
import { challenges, questions, skills, users } from "./db/schema.js";

async function seed() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@skillproof.local";
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 12) throw new Error("Set SEED_ADMIN_PASSWORD to a value with at least 12 characters before seeding.");
  let [admin] = await db.select().from(users).where(eq(users.email, email));
  if (!admin) [admin] = await db.insert(users).values({ name: "SkillProof Admin", email, passwordHash: await bcrypt.hash(password, 12), role: "ADMIN" }).returning();
  for (const name of ["React", "TypeScript", "SQL", "Node.js", "Accessibility"]) await db.insert(skills).values({ name }).onConflictDoNothing();
  const [existing] = await db.select().from(challenges).limit(1);
  if (!existing) {
    const [react] = await db.insert(challenges).values({ title: "React Fundamentals", description: "Show your understanding of components, state, props, and the rendering model behind modern React applications.", technology: "React", difficulty: "BEGINNER", published: true, createdBy: admin!.id }).returning();
    await db.insert(questions).values([
      { challengeId: react!.id, prompt: "Which hook is used to add state to a function component?", options: ["useEffect", "useState", "useMemo", "useRef"], correctAnswer: 1, explanation: "useState returns a state value and a setter for function components.", points: 1, position: 0 },
      { challengeId: react!.id, prompt: "What should a React component return when rendering a list of items?", options: ["An array of strings", "A unique key for each element", "A useEffect hook", "A Promise"], correctAnswer: 1, explanation: "Stable keys help React track list elements between renders.", points: 1, position: 1 },
      { challengeId: react!.id, prompt: "When should you use a functional state update?", options: ["Whenever the next state depends on the previous state", "Only in class components", "Only during initial render", "Whenever state is a string"], correctAnswer: 0, explanation: "The updater form receives the latest prior state and avoids stale state updates.", points: 1, position: 2 },
      { challengeId: react!.id, prompt: "What is a controlled input?", options: ["An input whose value is driven by React state", "An input with a required attribute", "An input hidden with CSS", "An input that only accepts numbers"], correctAnswer: 0, explanation: "A controlled input receives its value from state and updates through an event handler.", points: 1, position: 3 },
      { challengeId: react!.id, prompt: "Why should side effects not run directly during render?", options: ["Render can happen more than once", "JSX does not support functions", "State cannot change during render", "Effects require a class"], correctAnswer: 0, explanation: "Rendering should stay pure because React may invoke it repeatedly to produce the UI.", points: 1, position: 4 }
    ]);
  }
  console.log(`Seed complete. Admin account: ${email}`);
}
seed().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());

