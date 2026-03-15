import { test, expect } from "@playwright/test";

const hasAuthTestUser = Boolean(process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD);

test.describe("Authentication", () => {
  test("redirects a protected route to login when unauthenticated", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login$/);
  });

  test("renders the login form", async ({ page }) => {
    await page.goto("/login");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in|log in|login/i })).toBeVisible();
  });

  test.describe("Authenticated smoke", () => {
    test.skip(
      !hasAuthTestUser,
      "Set TEST_USER_EMAIL and TEST_USER_PASSWORD to enable authenticated smoke tests."
    );
    test.use({
      storageState: ".playwright/.auth/user.json",
    });

    test("loads the dashboard for an authenticated user", async ({ page }) => {
      await page.goto("/dashboard");

      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
      await expect(
        page.getByRole("link", { name: /profile/i }).or(page.getByText(/@/))
      ).toBeVisible();
    });

    test("logs out and returns to login", async ({ page }) => {
      await page.goto("/dashboard");

      await page.getByRole("button", { name: /log out|sign out|logout/i }).click();

      await expect(page).toHaveURL(/\/login$/);
    });
  });
});
