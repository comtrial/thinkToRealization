import { test, expect } from "@playwright/test";
import { cleanTestData, createTestProject } from "./helpers";

const API = "http://localhost:3333/api";

test.describe("UI: Project creation and selection flow", () => {
  test.beforeEach(async ({ page }) => {
    await cleanTestData();
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("Page loads and main content is visible", async ({ page }) => {
    const main = page.locator("main");
    await expect(main).toBeVisible({ timeout: 5000 });
  });

  test("Header has project selector", async ({
    page,
  }) => {
    // Wait for loading to finish
    await page.waitForTimeout(1000);
    // The header should have the ProjectSelector button (contains ChevronDown SVG)
    // It shows either a project name or "프로젝트 선택"
    const selectorButton = page.locator("header button").filter({
      has: page.locator("svg"),
    });
    // At least one button with SVG should be visible in header
    await expect(selectorButton.first()).toBeVisible({ timeout: 5000 });
  });

  test("Create project via sidebar '+' button", async ({ page }) => {
    const ts = Date.now();
    const uniqueName = `Test Project ${ts}`;

    // Click the create project button in sidebar
    const createBtn = page.getByTestId("create-project-btn");
    await expect(createBtn).toBeVisible({ timeout: 5000 });
    await createBtn.click();

    // Dialog should appear
    const dialogTitle = page.getByText("새 프로젝트");
    await expect(dialogTitle).toBeVisible({ timeout: 3000 });

    // Fill in the form (slug is auto-generated from title)
    await page.getByPlaceholder("예: 새 프로젝트").fill(uniqueName);

    // Submit form
    await page.getByRole("button", { name: "생성" }).click();

    // Dialog should close and project should be selected
    await expect(dialogTitle).toBeHidden({ timeout: 5000 });

    // Project should appear in sidebar and be selected
    const projectList = page.getByTestId("project-list");
    await expect(projectList).toContainText(uniqueName, { timeout: 5000 });

    // Header should show the project name
    const header = page.locator("header");
    await expect(header).toContainText(uniqueName, { timeout: 5000 });

    // Main content should no longer show empty state
    const main = page.locator("main");
    await expect(main).not.toContainText("프로젝트를 선택", { timeout: 5000 });
  });

  test("Create project with description", async ({ page }) => {
    const ts = Date.now();
    const uniqueTitle = `Described Project ${ts}`;
    const createBtn = page.getByTestId("create-project-btn");
    await createBtn.click();

    await page.getByPlaceholder("예: 새 프로젝트").fill(uniqueTitle);
    await page
      .getByPlaceholder("프로젝트에 대한 간단한 설명")
      .fill("A test project with description");

    await page.getByRole("button", { name: "생성" }).click();
    await expect(page.getByText("새 프로젝트")).toBeHidden({ timeout: 5000 });

    // Verify created via API
    const res = await fetch(`${API}/projects`);
    const json = await res.json();
    const created = json.data.find((p: { title: string }) => p.title === uniqueTitle);
    expect(created).toBeDefined();
    expect(created.description).toBe("A test project with description");
  });

  test("Auto-selects first project on page load", async ({ page }) => {
    // Create project via API first
    await createTestProject("Auto Select Project");

    // Reload the page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Should auto-select some project (not show empty state)
    // Note: the auto-selected project may not be our newly created one
    // if other projects exist in the database
    const header = page.locator("header");
    await expect(header).not.toContainText("프로젝트 선택", {
      timeout: 5000,
    });

    // Verify our project appears in the sidebar
    const projectList = page.getByTestId("project-list");
    await expect(projectList).toContainText("Auto Select Project", {
      timeout: 5000,
    });
  });

  test("Switch between projects in sidebar", async ({ page }) => {
    // Create two projects via API with unique names
    const ts = Date.now();
    await createTestProject(`Alpha ${ts}`);
    await createTestProject(`Beta ${ts}`);

    await page.reload();
    await page.waitForLoadState("networkidle");

    // Wait for projects to load in sidebar
    const projectList = page.getByTestId("project-list");
    await expect(projectList).toContainText(`Alpha ${ts}`, { timeout: 5000 });
    await expect(projectList).toContainText(`Beta ${ts}`, { timeout: 5000 });

    // Click second project in sidebar
    await projectList.getByText(`Beta ${ts}`).click();

    // Header should update to show Beta project
    await expect(page.locator("header")).toContainText(`Beta ${ts}`, {
      timeout: 3000,
    });
  });

  test("Switch projects via header project selector popover", async ({
    page,
  }) => {
    await createTestProject("Project One");
    await createTestProject("Project Two");

    await page.reload();
    await page.waitForLoadState("networkidle");

    // Wait for first project to load
    await expect(page.locator("header")).toContainText("Project", {
      timeout: 5000,
    });

    // Click the project selector in header (button with ChevronDown icon)
    const selectorTrigger = page
      .locator("header")
      .locator("button", { hasText: /Project/ })
      .first();
    await selectorTrigger.click();

    // Popover should appear with project list
    const searchInput = page.getByPlaceholder("프로젝트 검색...");
    await expect(searchInput).toBeVisible({ timeout: 3000 });

    // Click second project in the popover list
    const popoverList = page.locator("ul");
    await popoverList.locator("button", { hasText: "Project Two" }).click();

    // Header should update
    await expect(page.locator("header")).toContainText("Project Two", {
      timeout: 3000,
    });
  });

  test("Project selector search filters projects", async ({ page }) => {
    await createTestProject("Alpha Project");
    await createTestProject("Beta Project");
    await createTestProject("Gamma Project");

    await page.reload();
    await page.waitForLoadState("networkidle");

    // Wait for projects to load
    await expect(page.locator("header")).toContainText("Project", {
      timeout: 5000,
    });

    // Open project selector
    const selectorTrigger = page
      .locator("header")
      .locator("button", { hasText: /Project/ })
      .first();
    await selectorTrigger.click();

    const searchInput = page.getByPlaceholder("프로젝트 검색...");
    await expect(searchInput).toBeVisible({ timeout: 3000 });
    await searchInput.fill("Beta");

    // Should only show Beta
    const listItems = page.locator("ul li button");
    await expect(listItems).toHaveCount(1, { timeout: 3000 });
    await expect(listItems.first()).toContainText("Beta Project");
  });

  test("Cancel create project dialog", async ({ page }) => {
    // Record initial project count
    const initialRes = await fetch(`${API}/projects`);
    const initialJson = await initialRes.json();
    const initialCount = initialJson.data.length;

    const createBtn = page.getByTestId("create-project-btn");
    await createBtn.click();

    // Dialog should be visible
    await expect(page.getByText("새 프로젝트")).toBeVisible({ timeout: 3000 });

    // Click cancel
    await page.getByRole("button", { name: "취소" }).click();

    // Dialog should close
    await expect(page.getByText("새 프로젝트")).toBeHidden({ timeout: 3000 });

    // No new projects should have been created
    const res = await fetch(`${API}/projects`);
    const json = await res.json();
    expect(json.data.length).toBe(initialCount);
  });

  test("Create project button disabled without required fields", async ({
    page,
  }) => {
    const createBtn = page.getByTestId("create-project-btn");
    await createBtn.click();

    const submitBtn = page.getByRole("button", { name: "생성" });
    // Should be disabled initially (no title)
    await expect(submitBtn).toBeDisabled();

    // Fill title — should now be enabled
    await page.getByPlaceholder("예: 새 프로젝트").fill("Test");
    await expect(submitBtn).toBeEnabled();
  });
});
