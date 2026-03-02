import { test, expect } from "@playwright/test";
import { cleanDatabase, createTestProject } from "./helpers";

test.describe("Project Management", () => {
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  test.afterAll(async () => {
    await cleanDatabase();
  });

  test("shows empty state when no project selected", async ({ page }) => {
    // Navigate after cleanDatabase has run
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Wait for ProjectProvider to finish loading (it fetches on mount)
    // Then verify either the empty state or the project selector shows no project
    const emptyState = page.getByTestId("empty-no-project");
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    if (!hasEmptyState) {
      // If stale data from a previous run, reload to clear
      await page.reload();
      await page.waitForLoadState("networkidle");
    }

    await expect(emptyState).toBeVisible({ timeout: 10000 });
  });

  test("create new project via sidebar + button", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Click the "+" button in sidebar
    await page.getByTestId("create-project-btn").click();

    // Dialog should appear
    const dialog = page.getByTestId("create-project-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("새 프로젝트");

    // Fill out the form (use English title so slug auto-generates correctly)
    await page.getByTestId("project-title-input").fill("My Test Project");
    await page.getByTestId("project-dir-input").fill("/tmp/test-project");

    // Submit
    await page.getByTestId("create-project-submit").click();

    // Dialog should close
    await expect(dialog).toBeHidden({ timeout: 10000 });

    // Project should appear in sidebar
    const projectList = page.getByTestId("project-list");
    await expect(projectList).toContainText("My Test Project", { timeout: 5000 });

    // Dashboard should load (no longer showing empty state)
    await expect(page.getByTestId("empty-no-project")).toBeHidden();
  });

  test("project appears in sidebar after creation via API", async ({
    page,
  }) => {
    await createTestProject("API 프로젝트");

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Project should appear in sidebar (auto-fetched on mount)
    const projectList = page.getByTestId("project-list");
    await expect(projectList).toContainText("API 프로젝트");
  });

  test("select project loads dashboard", async ({ page }) => {
    await createTestProject("프로젝트 A", "project-a");
    await createTestProject("프로젝트 B", "project-b");

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // First project should be auto-selected
    await expect(page.getByTestId("empty-no-project")).toBeHidden();

    // Click second project
    const projectList = page.getByTestId("project-list");
    await projectList.getByText("프로젝트 A").click();

    // Should show dashboard content (or empty dashboard)
    await expect(page.locator("main")).not.toContainText(
      "프로젝트를 선택",
    );
  });

  test("project selector in header works", async ({ page }) => {
    await createTestProject("헤더 테스트", "header-test");

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Header should show project name
    const selectorBtn = page.locator("header button", {
      hasText: "헤더 테스트",
    });
    await expect(selectorBtn).toBeVisible();

    // Click to open popover
    await selectorBtn.click();

    // Popover should show the project
    const popover = page.locator("[data-radix-popper-content-wrapper]");
    await expect(popover).toBeVisible();
    await expect(popover).toContainText("헤더 테스트");
  });

  test("switch between projects", async ({ page }) => {
    await createTestProject("Project Alpha", "project-alpha");
    await createTestProject("Project Beta", "project-beta");

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Wait for projects to load in sidebar
    const projectList = page.getByTestId("project-list");
    await expect(projectList).toContainText("Project Alpha", { timeout: 5000 });
    await expect(projectList).toContainText("Project Beta", { timeout: 5000 });

    // Click Alpha
    await projectList.getByText("Project Alpha").click();

    // Verify header selector shows Alpha
    await expect(
      page.locator("header button", { hasText: "Project Alpha" }),
    ).toBeVisible({ timeout: 5000 });

    // Switch to Beta
    await projectList.getByText("Project Beta").click();

    // Verify header selector shows Beta
    await expect(
      page.locator("header button", { hasText: "Project Beta" }),
    ).toBeVisible({ timeout: 5000 });
  });
});
