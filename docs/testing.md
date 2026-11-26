# Testing guide

## API integration tests

Set `DATABASE_URL` to a dedicated PostgreSQL test database and provide `JWT_SECRET`, `RECEIPT_SIGNING_SECRET`, and `CLIENT_ORIGINS` (comma-separated; `http://localhost:5173` is always allowed). Apply migrations before the suite. Tests must not point at production or a personal development database because setup may insert records.

`npm test` runs server Vitest/Supertest tests and client Vitest tests. Database-backed tests are skipped when `DATABASE_URL` is absent; set it to a dedicated migrated and seeded PostgreSQL database to run them. The CI workflow provisions PostgreSQL 16, migrates and seeds it, builds all workspaces, then runs suites.

## Browser tests

With PostgreSQL migrated and seeded, run `npm run test:e2e`; Playwright starts both app workspaces and reuses the root `.env`. Install the browser once with `npx playwright install chromium`. The end-to-end path registers a student, browses the seeded React challenge, completes the assessment, and checks the result.
