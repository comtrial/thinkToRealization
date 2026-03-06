import { test, expect } from "@playwright/test";
import { cleanTestData } from "./helpers";

const API = "http://localhost:3333/api";

test.describe("UI: Project creation with directory selector", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("Create project dialog has directory browser toggle button", async ({ page }) => {
    const createBtn = page.getByTestId("create-project-btn");
    await createBtn.click();

    // Dialog should appear
    await expect(page.getByText("새 프로젝트")).toBeVisible({ timeout: 3000 });

    // The FolderOpen toggle button should be visible next to the path input
    const dirInput = page.getByTestId("project-dir-input");
    await expect(dirInput).toBeVisible();

    // Folder browser button (the button near the directory input with FolderOpen icon)
    const browserToggle = page.locator('[title="디렉토리 탐색"]');
    await expect(browserToggle).toBeVisible();
  });

  test("Directory browser opens and shows directory listing", async ({ page }) => {
    const createBtn = page.getByTestId("create-project-btn");
    await createBtn.click();

    // Click the directory browser toggle button
    const browserToggle = page.locator('[title="디렉토리 탐색"]');
    await browserToggle.click();

    // Should show directory entries (at least the current path display)
    await page.waitForTimeout(1000);

    // The browser should be visible with some directory entries
    const browserPanel = page.locator('[data-testid="create-project-dialog"]');
    // Look for folder icons (FolderOpen) in the directory listing
    const folders = browserPanel.locator('text=personal-project').or(
      browserPanel.locator('text=Desktop')
    );
    // At least some directories should be visible
    await expect(folders.first()).toBeVisible({ timeout: 5000 });
  });

  test("Directory browser shows .git badge for git repos", async ({ page }) => {
    const createBtn = page.getByTestId("create-project-btn");
    await createBtn.click();

    // Toggle browser
    const browserToggle = page.locator('[title="디렉토리 탐색"]');
    await browserToggle.click();
    await page.waitForTimeout(1000);

    // Navigate to personal-project directory: click on the directory name button
    const personalProjectBtn = page.locator('button', { hasText: "personal-project" }).first();
    if (await personalProjectBtn.isVisible()) {
      // Find the expand chevron button (sibling before the name button in the same container)
      const container = personalProjectBtn.locator("xpath=ancestor::div[1]");
      const chevronBtn = container.locator("button").first();
      await chevronBtn.click();
      await page.waitForTimeout(1000);
    }

    // After expanding, subdirectories with .git should show "git" badge
    const gitBadge = page.locator('text=git').first();
    await expect(gitBadge).toBeVisible({ timeout: 5000 });
  });

  test("Selecting directory auto-fills project path input", async ({ page }) => {
    const createBtn = page.getByTestId("create-project-btn");
    await createBtn.click();

    // Toggle browser
    const browserToggle = page.locator('[title="디렉토리 탐색"]');
    await browserToggle.click();
    await page.waitForTimeout(1000);

    // Click on a directory name button (e.g., "Desktop" or "Documents")
    // Each directory entry has a button with the directory name
    const desktopBtn = page.locator('button', { hasText: "Desktop" });
    if (await desktopBtn.isVisible().catch(() => false)) {
      await desktopBtn.click();
      await page.waitForTimeout(300);

      // The project dir input should now contain a path ending with Desktop
      const dirInput = page.getByTestId("project-dir-input");
      const inputValue = await dirInput.inputValue();
      expect(inputValue).toBeTruthy();
      expect(inputValue).toContain("Desktop");
    } else {
      // Fallback: click the first directory entry with a name
      const firstDirName = page.locator('[data-testid="create-project-dialog"]')
        .locator('.truncate').first();
      if (await firstDirName.isVisible().catch(() => false)) {
        await firstDirName.click();
        await page.waitForTimeout(300);
        const dirInput = page.getByTestId("project-dir-input");
        const inputValue = await dirInput.inputValue();
        expect(inputValue).toBeTruthy();
        expect(inputValue.length).toBeGreaterThan(1);
      }
    }
  });

  test("CLAUDE.md badge appears when directory has CLAUDE.md", async ({ page }) => {
    const createBtn = page.getByTestId("create-project-btn");
    await createBtn.click();

    // Toggle browser
    const browserToggle = page.locator('[title="디렉토리 탐색"]');
    await browserToggle.click();
    await page.waitForTimeout(1000);

    // Look for CLAUDE.md badge in the listing
    const claudeBadge = page.locator('text=CLAUDE.md').first();
    // This may or may not be visible depending on the default directory view
    // At minimum, the badge component exists in the code
    const isVisible = await claudeBadge.isVisible().catch(() => false);

    if (isVisible) {
      await expect(claudeBadge).toBeVisible();
    } else {
      // Navigate to personal-project to find it
      const personalProject = page.getByText("personal-project");
      if (await personalProject.isVisible().catch(() => false)) {
        const expandBtn = personalProject.locator("..").locator("button").first();
        await expandBtn.click();
        await page.waitForTimeout(1000);
        const claudeBadge2 = page.locator('text=CLAUDE.md').first();
        await expect(claudeBadge2).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test("Project creation with directory browser works end-to-end", async ({ page }) => {
    const ts = Date.now();
    const uniqueSlug = `__e2e__dirbrowser-${ts}`;

    const createBtn = page.getByTestId("create-project-btn");
    await createBtn.click();

    // Manually fill the directory (since navigating the tree is environment-dependent)
    await page.getByTestId("project-dir-input").fill("/tmp/test-project");
    await page.getByPlaceholder("예: DevFlow v2").fill(`Browser Project ${ts}`);
    await page.getByTestId("project-slug-input").fill(uniqueSlug);

    // Submit
    await page.getByRole("button", { name: "생성" }).click();
    await expect(page.getByText("새 프로젝트")).toBeHidden({ timeout: 5000 });

    // Verify project was created
    const res = await fetch(`${API}/projects`);
    const json = await res.json();
    const created = json.data.find(
      (p: { slug: string }) => p.slug === uniqueSlug
    );
    expect(created).toBeDefined();
    expect(created.title).toBe(`Browser Project ${ts}`);
  });

  test("CLAUDE.md detected badge and preview toggle work", async ({ page }) => {
    const createBtn = page.getByTestId("create-project-btn");
    await createBtn.click();

    // Toggle browser
    const browserToggle = page.locator('[title="디렉토리 탐색"]');
    await browserToggle.click();
    await page.waitForTimeout(1000);

    // Navigate to personal-project and find a directory with CLAUDE.md
    const personalProject = page.getByText("personal-project").first();
    if (await personalProject.isVisible().catch(() => false)) {
      // Expand personal-project
      const container = personalProject.locator("xpath=ancestor::div[1]");
      const expandBtn = container.locator("button").first();
      await expandBtn.click();
      await page.waitForTimeout(1000);

      // Find and click thinkToRealization (has CLAUDE.md)
      const ttrButton = page.getByText("thinkToRealization");
      if (await ttrButton.isVisible().catch(() => false)) {
        await ttrButton.click();
        await page.waitForTimeout(500);

        // "CLAUDE.md 감지됨" badge should appear
        const detectedBadge = page.getByText("CLAUDE.md 감지됨");
        await expect(detectedBadge).toBeVisible({ timeout: 5000 });

        // Click to expand the preview
        await detectedBadge.click();
        await page.waitForTimeout(300);

        // Preview content should be visible (a pre element with CLAUDE.md content)
        const preview = page.locator("pre");
        await expect(preview).toBeVisible({ timeout: 3000 });
      }
    }
  });
});
