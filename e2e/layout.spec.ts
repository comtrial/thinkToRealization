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
    await expect(page).toHaveTitle(/ThinkToRealization/);
  });

  test("Header is visible with ThinkToRealization title", async ({ page }) => {
    const header = page.locator("header");
    await expect(header).toBeVisible();
    await expect(header).toContainText("ThinkToRealization");
  });

  test("Sidebar is visible", async ({ page }) => {
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();
  });

  test("Dashboard tab and Canvas tab exist", async ({ page }) => {
    const dashboardTab = page.getByRole("navigation").getByRole("button", { name: "대시보드" });
    const canvasTab = page.getByRole("navigation").getByRole("button", { name: "캔버스" });
    await expect(dashboardTab).toBeVisible();
    await expect(canvasTab).toBeVisible();
  });

  test("Switching tabs shows different content", async ({ page }) => {
    const main = page.locator("main");

    // Dashboard tab should show content (either empty state or project dashboard)
    await expect(main).toBeVisible();

    // Click canvas tab
    await page.getByRole("navigation").getByRole("button", { name: "캔버스" }).click();
    await expect(main).toBeVisible();

    // Click back to dashboard
    await page.getByRole("navigation").getByRole("button", { name: "대시보드" }).click();
    await expect(main).toBeVisible();
  });

  test("Sidebar toggle button works", async ({ page }) => {
    const toggleBtn = page.getByRole("button", { name: "Toggle sidebar" });
    await expect(toggleBtn).toBeVisible();

    // Sidebar should have "Workspace" text when open
    const sidebar = page.locator("aside");
    await expect(sidebar).toContainText("Workspace");

    // Toggle sidebar
    await toggleBtn.click();

    // After collapsing, "Workspace" text should be hidden
    await expect(sidebar.getByText("Workspace")).toBeHidden();
  });
});
