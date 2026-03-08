import { test, expect } from "@playwright/test";
import { cleanTestData } from "./helpers";

const API = "http://localhost:3333/api";

test.describe("UI: Project creation dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("Create project dialog shows title and description fields", async ({ page }) => {
    const createBtn = page.getByTestId("create-project-btn");
    await createBtn.click();

    // Dialog should appear
    await expect(page.getByText("새 프로젝트")).toBeVisible({ timeout: 3000 });

    // Title input should be visible
    const titleInput = page.getByPlaceholder("예: 새 프로젝트");
    await expect(titleInput).toBeVisible();

    // Description input should be visible
    const descInput = page.getByPlaceholder("프로젝트에 대한 간단한 설명");
    await expect(descInput).toBeVisible();
  });

  test("Project creation with title only works end-to-end", async ({ page }) => {
    const ts = Date.now();
    const uniqueTitle = `Browser Project ${ts}`;

    const createBtn = page.getByTestId("create-project-btn");
    await createBtn.click();

    // Fill title only (slug is auto-generated)
    await page.getByPlaceholder("예: 새 프로젝트").fill(uniqueTitle);

    // Submit
    await page.getByRole("button", { name: "생성" }).click();
    await expect(page.getByText("새 프로젝트")).toBeHidden({ timeout: 5000 });

    // Verify project was created
    const res = await fetch(`${API}/projects`);
    const json = await res.json();
    const created = json.data.find(
      (p: { title: string }) => p.title === uniqueTitle
    );
    expect(created).toBeDefined();
    expect(created.title).toBe(uniqueTitle);
  });

  test("Project creation with title and description", async ({ page }) => {
    const ts = Date.now();
    const uniqueTitle = `Described Project ${ts}`;

    const createBtn = page.getByTestId("create-project-btn");
    await createBtn.click();

    await page.getByPlaceholder("예: 새 프로젝트").fill(uniqueTitle);
    await page
      .getByPlaceholder("프로젝트에 대한 간단한 설명")
      .fill("A test project with description");

    // Submit
    await page.getByRole("button", { name: "생성" }).click();
    await expect(page.getByText("새 프로젝트")).toBeHidden({ timeout: 5000 });

    // Verify created via API
    const res = await fetch(`${API}/projects`);
    const json = await res.json();
    const created = json.data.find((p: { title: string }) => p.title === uniqueTitle);
    expect(created).toBeDefined();
    expect(created.description).toBe("A test project with description");
  });
});
