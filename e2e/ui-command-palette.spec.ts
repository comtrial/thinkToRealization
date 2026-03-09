import { test, expect } from "@playwright/test";
import {
  cleanTestData,
  createTestProject,
  selectProjectInSidebar,
} from "./helpers";

test.describe("UI: Command palette and keyboard shortcuts", () => {
  test.beforeEach(async ({ page }) => {
    await cleanTestData();
    await createTestProject("Shortcut Project");
    await selectProjectInSidebar(page, "Shortcut Project");
  });

  test("Command palette opens with Cmd+K", async ({ page }) => {
    await page.keyboard.press("Meta+k");
    const paletteInput = page.getByPlaceholder("무엇을 할까요?");
    await expect(paletteInput).toBeVisible({ timeout: 3000 });
  });

  test("Command palette closes with Escape", async ({ page }) => {
    await page.keyboard.press("Meta+k");
    const paletteInput = page.getByPlaceholder("무엇을 할까요?");
    await expect(paletteInput).toBeVisible({ timeout: 3000 });

    await page.keyboard.press("Escape");
    await expect(paletteInput).toBeHidden({ timeout: 3000 });
  });

  test("Command palette closes by clicking overlay", async ({ page }) => {
    await page.keyboard.press("Meta+k");
    const paletteInput = page.getByPlaceholder("무엇을 할까요?");
    await expect(paletteInput).toBeVisible({ timeout: 3000 });

    // Click outside the palette dialog to close it
    await page.locator(".bg-surface-overlay").click({ force: true });
    await expect(paletteInput).toBeHidden({ timeout: 3000 });
  });

  test("Command palette shows action items", async ({ page }) => {
    await page.keyboard.press("Meta+k");
    await expect(page.getByPlaceholder("무엇을 할까요?")).toBeVisible({
      timeout: 3000,
    });

    await expect(page.getByText("새 노드 생성")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("자동 정렬")).toBeVisible();
    await expect(page.getByText("줌 맞춤")).toBeVisible();
    await expect(page.getByText("사이드바 토글")).toBeVisible();
  });

  test("Command palette search filters results", async ({ page }) => {
    await page.keyboard.press("Meta+k");
    const input = page.getByPlaceholder("무엇을 할까요?");
    await expect(input).toBeVisible({ timeout: 3000 });

    await input.fill("대시보드");
    // Use the command palette list item, not the header tab button
    const paletteItem = page.locator("[cmdk-item]", { hasText: "대시보드" });
    await expect(paletteItem).toBeVisible({ timeout: 3000 });
  });

  test("Command palette shows empty state for no results", async ({
    page,
  }) => {
    await page.keyboard.press("Meta+k");
    const input = page.getByPlaceholder("무엇을 할까요?");
    await input.fill("xyznonexistent");

    await expect(page.getByText("결과가 없습니다")).toBeVisible({
      timeout: 3000,
    });
  });

  test("Select dashboard from command palette", async ({ page }) => {
    // Switch to canvas first
    await page.getByRole("navigation").getByRole("button", { name: "캔버스" }).click();

    await page.keyboard.press("Meta+k");
    await expect(page.getByPlaceholder("무엇을 할까요?")).toBeVisible({
      timeout: 3000,
    });

    const input = page.getByPlaceholder("무엇을 할까요?");
    await input.fill("대시보드");
    await page.keyboard.press("Enter");

    // After selecting dashboard from palette, the dashboard tab should be active
    const dashTab = page.getByRole("navigation").getByRole("button", { name: "대시보드" });
    await expect(dashTab).toHaveAttribute("data-active", "true", {
      timeout: 5000,
    });
  });

  test("Keyboard shortcut Cmd+1 switches to dashboard", async ({ page }) => {
    // Switch to canvas first
    await page.getByRole("navigation").getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });

    await page.keyboard.press("Meta+1");

    const dashTab = page.getByRole("navigation").getByRole("button", { name: "대시보드" });
    await expect(dashTab).toHaveAttribute("data-active", "true", {
      timeout: 3000,
    });
  });

  test("Keyboard shortcut Cmd+2 switches to canvas", async ({ page }) => {
    await page.keyboard.press("Meta+2");
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });
  });

  test("Sidebar toggle with header button", async ({ page }) => {
    const toggleBtn = page.getByRole("button", { name: "Toggle sidebar" });
    await expect(toggleBtn).toBeVisible();

    const sidebar = page.locator("aside");
    await expect(sidebar).toContainText("Workspace");

    await toggleBtn.click();
    await expect(sidebar.getByText("Workspace")).toBeHidden({ timeout: 3000 });

    await toggleBtn.click();
    await expect(sidebar.getByText("Workspace")).toBeVisible({ timeout: 3000 });
  });

  test("Search button in header opens command palette", async ({ page }) => {
    const searchBtn = page.locator("header button", { hasText: "검색" });
    await searchBtn.click();

    const paletteInput = page.getByPlaceholder("무엇을 할까요?");
    await expect(paletteInput).toBeVisible({ timeout: 3000 });
  });
});
