import { test, expect } from "@playwright/test";
test("register, log in, and complete a challenge", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.test`;
  await page.goto("/register");
  await page.getByLabel("Full name").fill("E2E Student");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill("e2e-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.locator("nav").getByRole("link", { name: /Challenges/ }).click();
  await page.getByRole("link", { name: /React Fundamentals/ }).click();
  await page.getByRole("button", { name: /Start challenge/ }).click();
  const choices = ["useState", "A unique key for each element", "Whenever the next state depends on the previous state", "An input whose value is driven by React state", "Render can happen more than once"];
  for (const choice of choices) await page.getByText(choice, { exact: true }).click();
  await page.getByRole("button", { name: /Submit assessment/ }).click();
  await expect(page.getByText("Proof earned.")).toBeVisible();
  await page.getByRole("link", { name: /Back to dashboard/ }).click();
  await page.getByRole("button", { name: /Sign out/ }).click();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill("e2e-password-123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/dashboard/);
});

test("logout blocks browser back and allows login after a revoked-session 401", async ({ page }) => {
  const email = `auth-e2e-${Date.now()}@example.test`;
  let authMeRequests = 0;
  page.on("request", request => {
    if (new URL(request.url()).pathname === "/api/auth/me") authMeRequests += 1;
  });

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Auth Lifecycle Student");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill("auth-e2e-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/dashboard/);

  const staleSession = (await page.context().cookies()).find(cookie => cookie.name === "skillproof");
  if (!staleSession) throw new Error("Login did not set the HttpOnly session cookie.");
  expect(staleSession.httpOnly).toBe(true);

  await page.locator("nav").getByRole("link", { name: /Challenges/ }).click();
  await page.getByRole("button", { name: /Sign out/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.context().cookies()).some(cookie => cookie.name === "skillproof")).toBe(false);

  await page.goBack();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  expect(authMeRequests).toBe(0);

  await page.context().addCookies([staleSession]);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  expect(authMeRequests).toBe(1);

  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill("auth-e2e-password-123");
  const freshLoginResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/auth/login");
  const dashboardResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/dashboard");
  await page.getByRole("button", { name: "Log in" }).click();
  expect((await freshLoginResponse).status()).toBe(200);
  expect((await dashboardResponse).status()).toBe(200);
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByRole("link", { name: "Overview" })).toBeVisible();
  await expect(page.getByText("Please sign in.")).toHaveCount(0);
  expect(authMeRequests).toBe(1);
});

