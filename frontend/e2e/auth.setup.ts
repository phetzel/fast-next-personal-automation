import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, "../.playwright/.auth/user.json");

/**
 * Authentication setup - runs before all tests.
 *
 * This creates an authenticated session that other tests can reuse.
 */
setup("authenticate", async ({ page }) => {
  const testEmail = process.env.TEST_USER_EMAIL || "test@example.com";
  const testPassword = process.env.TEST_USER_PASSWORD || "TestPassword123!";

  await page.goto("/login");
  await page.getByLabel(/email/i).fill(testEmail);
  await page.getByLabel(/password/i).fill(testPassword);
  await page.getByRole("button", { name: /sign in|log in|login/i }).click();

  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10000 });
  await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

  await page.context().storageState({ path: authFile });
});
