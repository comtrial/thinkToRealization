import { test, expect } from "@playwright/test";
import {
  cleanDatabase,
  createTestProject,
  createTestSession,
  goToWorkspace,
} from "./helpers";

test.describe("Keyboard Shortcuts", () => {
  test.beforeEach(async ({ request }) => {
    await cleanDatabase(request);
  });

  test("Cmd+Backslash toggles focus mode (hides left panel)", async ({
    page,
    request,
  }) => {
    const project = await createTestProject(request);
    await goToWorkspace(page, project.id);

    // Stage panel should be visible initially (use first() since mobile layout also has one)
    await expect(page.getByTestId("stage-panel").first()).toBeVisible({ timeout: 10000 });

    // Toggle focus mode
    await page.keyboard.press("Meta+\\");
    await page.waitForTimeout(300);

    // Desktop stage panel should be hidden in focus mode (desktop wrapper has focus-mode-active testid)
    await expect(page.getByTestId("focus-mode-active")).toBeVisible();

    // Toggle back
    await page.keyboard.press("Meta+\\");
    await page.waitForTimeout(300);

    // Stage panel should be visible again
    await expect(page.getByTestId("stage-panel").first()).toBeVisible();
  });

  test("Cmd+Shift+Right moves to next stage", async ({ page, request }) => {
    const project = await createTestProject(request);
    await goToWorkspace(page, project.id);

    // Initially on first stage (use first() for mobile/desktop dual render)
    await expect(page.getByTestId("stage-panel").first().locator("h3")).toContainText("아이디어 발산");

    // Press Cmd+Shift+Right to trigger next stage (transition modal)
    await page.keyboard.press("Meta+Shift+ArrowRight");

    // Transition modal should appear
    await expect(page.getByTestId("transition-modal")).toBeVisible();
  });

  test("Cmd+Shift+Left moves to previous stage", async ({
    page,
    request,
  }) => {
    const project = await createTestProject(request);
    await goToWorkspace(page, project.id);

    // First move to second stage (use first() for mobile/desktop dual render)
    await page.getByTestId("next-stage-btn").first().click();
    await page.getByRole("button", { name: "건너뛰기" }).click();
    await page.waitForTimeout(500);

    // Should be on second stage now (use first() for mobile/desktop dual render)
    const stagePanel = page.getByTestId("stage-panel").first();
    await expect(stagePanel.locator("h3")).toContainText("문제 정의");

    // Press Cmd+Shift+Left
    await page.keyboard.press("Meta+Shift+ArrowLeft");
    await page.waitForTimeout(300);

    // Should go back to first stage
    await expect(stagePanel.locator("h3")).toContainText("아이디어 발산");
  });

  test("Cmd+Shift+N creates new session", async ({ page, request }) => {
    const project = await createTestProject(request);
    await goToWorkspace(page, project.id);

    // No sessions initially (scope to visible stage panel)
    const stagePanel = page.getByTestId("stage-panel").first();
    await expect(stagePanel).toBeVisible({ timeout: 10000 });
    await expect(stagePanel.getByText("아직 세션이 없습니다")).toBeVisible();

    // Press Cmd+Shift+N
    await page.keyboard.press("Meta+Shift+N");
    await page.waitForTimeout(500);

    // Session should be created
    await expect(stagePanel.getByText("아직 세션이 없습니다")).not.toBeVisible();
  });
});
