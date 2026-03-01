import { test, expect } from "@playwright/test";
import { cleanDatabase, createTestProject } from "./helpers";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ request }) => {
    await cleanDatabase(request);
  });

  test("shows empty state when no projects exist", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByText("프로젝트가 없습니다")
    ).toBeVisible();
  });

  test("shows project list after creating projects", async ({
    page,
    request,
  }) => {
    await createTestProject(request, "프로젝트 A");
    await createTestProject(request, "프로젝트 B");

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Use project-card data-testid to scope within the grid
    const cards = page.getByTestId("project-card");
    await expect(cards).toHaveCount(2);
    await expect(cards.filter({ hasText: "프로젝트 A" })).toBeVisible();
    await expect(cards.filter({ hasText: "프로젝트 B" })).toBeVisible();
  });

  test("shows RecentActivityCard for most recent project", async ({
    page,
    request,
  }) => {
    await createTestProject(request, "최근 프로젝트");

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // RecentActivityCard has "이어서 작업" button
    await expect(page.getByRole("link", { name: /이어서 작업/ })).toBeVisible();
  });

  test("shows DevFlow logo and header", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("DevFlow")).toBeVisible();
  });
});
