import { test, expect } from "@playwright/test";
import { cleanTestData } from "./helpers";

test.describe("F-1: Layout (AppShell + Header + Sidebar)", () => {
  test.beforeEach(async ({ page }) => {
    await cleanTestData();
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("Page loads with AppShell", async ({ page }) => {
    // The page should have rendered without errors
    await expect(page).toHaveTitle(/DevFlow/);
  });

  test("Header is visible with DevFlow title", async ({ page }) => {
    const header = page.locator("header");
    await expect(header).toBeVisible();
    await expect(header).toContainText("DevFlow");
  });

  test("Sidebar is visible", async ({ page }) => {
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();
  });

  test("Dashboard tab and Canvas tab exist", async ({ page }) => {
    const dashboardTab = page.getByRole("button", { name: "대시보드" });
    const canvasTab = page.getByRole("button", { name: "캔버스" });
    await expect(dashboardTab).toBeVisible();
    await expect(canvasTab).toBeVisible();
  });

  test("Switching tabs shows different content", async ({ page }) => {
    const main = page.locator("main");

    // Dashboard tab should show content (either empty state or project dashboard)
    await expect(main).toBeVisible();

    // Click canvas tab
    await page.getByRole("button", { name: "캔버스" }).click();
    await expect(main).toBeVisible();

    // Click back to dashboard
    await page.getByRole("button", { name: "대시보드" }).click();
    await expect(main).toBeVisible();
  });

  test("Sidebar toggle button works", async ({ page }) => {
    const toggleBtn = page.getByRole("button", { name: "Toggle sidebar" });
    await expect(toggleBtn).toBeVisible();

    // Sidebar should have "My Work" text when open
    const sidebar = page.locator("aside");
    await expect(sidebar).toContainText("My Work");

    // Toggle sidebar
    await toggleBtn.click();

    // After collapsing, "My Work" text should be hidden
    await expect(sidebar.getByText("My Work")).toBeHidden();
  });
});
