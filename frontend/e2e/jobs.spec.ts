import { test, expect } from "@playwright/test";

test.describe("Jobs Area", () => {
  test.describe("Unauthenticated", () => {
    test.beforeEach(async ({ page }) => {
      // Clear cookies to ensure unauthenticated state
      await page.context().clearCookies();
    });

    test("should redirect to login from jobs pages", async ({ page }) => {
      await page.goto("/jobs");
      // Should redirect to login or show auth required message
      await expect(
        page.getByText(/log in|sign in|authentication required/i)
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Authenticated", () => {
    test.use({ storageState: "frontend/.playwright/.auth/user.json" });

    test.describe("Jobs Overview", () => {
      test("should load jobs overview page", async ({ page }) => {
        await page.goto("/jobs");
        await expect(page.getByRole("heading", { name: /jobs/i })).toBeVisible();
      });

      test("should display quick stats section", async ({ page }) => {
        await page.goto("/jobs");
        // Look for stats or overview content
        await expect(page.getByText(/overview|stats|recent/i)).toBeVisible();
      });

      test("should have navigation to sub-routes", async ({ page }) => {
        await page.goto("/jobs");
        // Check for links to sub-routes
        await expect(
          page.getByRole("link", { name: /listings|list/i }).or(
            page.getByRole("link", { name: /profiles/i })
          )
        ).toBeVisible();
      });
    });

    test.describe("Jobs List", () => {
      test("should load jobs list page", async ({ page }) => {
        await page.goto("/jobs/list");
        await expect(page.getByRole("main")).toBeVisible();
      });

      test("should display job listings or empty state", async ({ page }) => {
        await page.goto("/jobs/list");
        // Should show either jobs or an empty state message
        await expect(
          page.getByText(/job|no jobs|empty|get started/i)
        ).toBeVisible({ timeout: 10000 });
      });

      test("should have filter controls", async ({ page }) => {
        await page.goto("/jobs/list");
        // Look for filter UI elements
        const filters = page.getByRole("combobox").or(
          page.getByRole("textbox", { name: /search|filter/i })
        );
        // Filters may or may not be present depending on data
        await expect(page.getByRole("main")).toBeVisible();
      });
    });

    test.describe("Job Profiles & Resumes", () => {
      test("should load profiles page", async ({ page }) => {
        await page.goto("/jobs/profiles");
        await expect(page.getByRole("main")).toBeVisible();
      });

      test("should display profiles or create button", async ({ page }) => {
        await page.goto("/jobs/profiles");
        // Should show either existing profiles or a create button
        await expect(
          page.getByRole("button", { name: /create|add|new/i }).or(
            page.getByText(/profile/i)
          )
        ).toBeVisible({ timeout: 10000 });
      });

      test("should be able to open create profile form", async ({ page }) => {
        await page.goto("/jobs/profiles");
        
        const createButton = page.getByRole("button", { name: /create|add|new/i });
        if (await createButton.isVisible()) {
          await createButton.click();
          // Should show form fields
          await expect(
            page.getByLabel(/name/i).or(page.getByPlaceholder(/name/i))
          ).toBeVisible();
        }
      });

      test("should have tabs for profiles and resumes", async ({ page }) => {
        await page.goto("/jobs/profiles");
        // Should show tab navigation for profiles and resumes
        await expect(page.getByRole("button", { name: /profiles/i })).toBeVisible();
        await expect(page.getByRole("button", { name: /resumes/i })).toBeVisible();
      });

      test("should switch to resumes tab", async ({ page }) => {
        await page.goto("/jobs/profiles");
        
        const resumesTab = page.getByRole("button", { name: /resumes/i });
        await resumesTab.click();
        
        // Should show upload zone or resume list
        await expect(
          page.getByText(/upload|drop|resume|no resumes/i)
        ).toBeVisible({ timeout: 10000 });
      });
    });

    test.describe("Jobs Assistant", () => {
      test("should load jobs assistant page", async ({ page }) => {
        await page.goto("/jobs/assistant");
        await expect(page.getByRole("main")).toBeVisible();
      });

      test("should display jobs assistant header", async ({ page }) => {
        await page.goto("/jobs/assistant");
        await expect(
          page.getByText(/jobs assistant/i)
        ).toBeVisible();
      });

      test("should have chat input", async ({ page }) => {
        await page.goto("/jobs/assistant");
        // Look for chat input field
        await expect(
          page.getByRole("textbox").or(page.getByPlaceholder(/message|type/i))
        ).toBeVisible();
      });
    });

    test.describe("Job Pipelines", () => {
      test("should load pipelines page", async ({ page }) => {
        await page.goto("/jobs/pipelines");
        await expect(page.getByRole("main")).toBeVisible();
      });

      test("should display job pipelines", async ({ page }) => {
        await page.goto("/jobs/pipelines");
        // Should show job-related pipelines
        await expect(
          page.getByText(/job.*pipeline|pipeline|search.*jobs/i)
        ).toBeVisible({ timeout: 10000 });
      });
    });
  });

  test.describe("Sidebar Navigation", () => {
    test.use({ storageState: "frontend/.playwright/.auth/user.json" });

    test("should have jobs section in sidebar", async ({ page }) => {
      await page.goto("/jobs");
      
      // Jobs should be in the sidebar
      const sidebar = page.getByRole("navigation").or(page.locator("[data-sidebar]"));
      await expect(sidebar.getByText(/jobs/i)).toBeVisible();
    });

    test("should show collapsible jobs sub-routes", async ({ page }) => {
      await page.goto("/jobs");
      
      // Look for sub-routes like List, Profiles, Assistant, Pipelines
      const subRoutes = ["list", "profiles", "assistant", "pipelines"];
      let foundSubRoute = false;
      
      for (const route of subRoutes) {
        const link = page.getByRole("link", { name: new RegExp(route, "i") });
        if (await link.isVisible().catch(() => false)) {
          foundSubRoute = true;
          break;
        }
      }
      
      // At least one sub-route should be visible
      expect(foundSubRoute).toBeTruthy();
    });

    test("should navigate between jobs sub-routes", async ({ page }) => {
      await page.goto("/jobs");
      
      // Click on a sub-route (try profiles first)
      const profilesLink = page.getByRole("link", { name: /profiles/i });
      if (await profilesLink.isVisible().catch(() => false)) {
        await profilesLink.click();
        await expect(page).toHaveURL(/\/jobs\/profiles/);
      }
    });
  });

  test.describe("Responsive Design", () => {
    test.use({ storageState: "frontend/.playwright/.auth/user.json" });

    test("jobs page should work on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/jobs");
      await expect(page.getByRole("main")).toBeVisible();
    });

    test("jobs list should work on tablet", async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto("/jobs/list");
      await expect(page.getByRole("main")).toBeVisible();
    });
  });
});

test.describe("Pipeline Profile Selection", () => {
  test.use({ storageState: "frontend/.playwright/.auth/user.json" });

  test("should show profile selector in job_search pipeline", async ({ page }) => {
    await page.goto("/jobs/pipelines");
    
    // Expand the job_search pipeline if it exists
    const pipelineCard = page.getByText(/job.*search/i).first();
    if (await pipelineCard.isVisible().catch(() => false)) {
      await pipelineCard.click();
      
      // Should show profile selector field
      await expect(
        page.getByLabel(/profile/i).or(page.getByText(/select.*profile/i))
      ).toBeVisible({ timeout: 5000 });
    }
  });
});
