# Database architecture

PostgreSQL is the persistence layer. Drizzle schema definitions live in `server/src/db/schema.ts`; `server/drizzle.config.ts` and `npm run db:generate --workspace server` produce version-controlled migrations.

## Relationships

- `users` owns profile and password hash data, a role enum, and timestamps. Email is unique.
- `skills` is a canonical skill dictionary. `user_skills` joins users to skills and tracks a validated 0–100 level.
- `challenges` belongs to its author and has a publication state, technology, and difficulty.
- `questions` belongs to a challenge and stores answer options, scoring points, correct option index, explanation, and display order. Public challenge queries explicitly select only prompt/options/position/points.
- `challenge_attempts` belongs to a user and challenge and stores in-progress/submitted status, answers, score, feedback, and timestamps. Submission uses a row lock in a PostgreSQL transaction to prevent concurrent duplicate scoring.
- `submissions` records a student's practical-work URL and notes. `reviews` records each reviewer decision and feedback, preserving history.
- `skill_receipts` has a unique attempt reference and stores score, issue time, revocation status, and HMAC signature. Verification recomputes the signature with a server-only secret and uses constant-time comparison.

Indexes support catalogue filters, role lookup, question ordering, student attempt history, reviewer queue sorting, and receipt history. Foreign keys define deletion behavior where cascading is appropriate.

## Query patterns

Challenge catalogue uses a left join and grouped question count, filter predicates, ordering, limit, and offset. Dashboard statistics use filtered aggregates. Reviewer queue and receipt views use joins. User attempt history is scoped by authenticated user ID; admins/reviewers may filter by user ID.
