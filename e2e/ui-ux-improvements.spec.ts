import { test, expect } from "@playwright/test";

test.describe("UX Improvements", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app — assumes a project with at least one node exists
    await page.goto("/");
    // Wait for the canvas to load
    await page.waitForSelector("[data-testid='auto-layout-btn']", {
      timeout: 15000,
    });
  });

  test("minimap should be reduced in size (120x80)", async ({ page }) => {
    const minimap = page.locator(".react-flow__minimap");
    await expect(minimap).toBeVisible();

    // Check that the minimap has the reduced dimensions
    const box = await minimap.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      // Allow small tolerance for borders/padding
      expect(box.width).toBeLessThanOrEqual(140);
      expect(box.height).toBeLessThanOrEqual(100);
    }
  });

  test("source handles should show + indicator on hover", async ({ page }) => {
    // Find a source handle (right-side handle)
    const sourceHandle = page.locator(".react-flow__handle-right").first();
    await expect(sourceHandle).toBeVisible();

    // Hover over it
    await sourceHandle.hover();

    // The "+" icon should appear near the handle
    // It's rendered as a sibling div with "+" text
    const plusIcon = page.locator("text=+").first();
    await expect(plusIcon).toBeVisible();
  });

  test.describe("Node Detail Panel", () => {
    test.beforeEach(async ({ page }) => {
      // Click on a node to open the detail panel
      const node = page.locator(".react-flow__node").first();
      await node.click();
      // Wait for panel to open
      await page.waitForTimeout(500);
    });

    test("description textarea should be always visible with 12 rows", async ({
      page,
    }) => {
      const textarea = page.locator('[data-testid="desc-textarea"]');
      await expect(textarea).toBeVisible();

      // Check that it has rows=12
      const rows = await textarea.getAttribute("rows");
      expect(rows).toBe("12");
    });

    test("description should render Markdown in preview", async ({ page }) => {
      const textarea = page.locator('[data-testid="desc-textarea"]');
      await expect(textarea).toBeVisible();

      // Type markdown content
      await textarea.fill("**bold text** and *italic text*");

      // Wait for debounce + rendering
      await page.waitForTimeout(600);

      // Check markdown preview renders properly
      const preview = page.locator('[data-testid="markdown-preview"]');
      await expect(preview).toBeVisible();

      // Bold text should be rendered as <strong>
      const bold = preview.locator("strong");
      await expect(bold).toHaveText("bold text");

      // Italic text should be rendered as <em>
      const italic = preview.locator("em");
      await expect(italic).toHaveText("italic text");
    });

    test("description should auto-save with debounce", async ({ page }) => {
      const textarea = page.locator('[data-testid="desc-textarea"]');
      await expect(textarea).toBeVisible();

      const testContent = `Auto-save test ${Date.now()}`;
      await textarea.fill(testContent);

      // Wait for debounce (500ms) + save
      await page.waitForTimeout(1000);

      // Save status indicator should show "저장됨"
      const saveStatus = page.locator('[data-testid="save-status"]');
      await expect(saveStatus).toHaveText("저장됨");
    });

    test("decisions should show source label", async ({ page }) => {
      // Check if there are any decisions displayed
      const decisionSources = page.locator('[data-testid="decision-source"]');
      const count = await decisionSources.count();

      if (count > 0) {
        // Each decision should have either "세션: ..." or "직접 추가" label
        for (let i = 0; i < count; i++) {
          const text = await decisionSources.nth(i).textContent();
          expect(text).toMatch(/^(세션: .+|직접 추가)$/);
        }
      }
    });
  });

  test("dragging handle to empty space should create new connected node", async ({
    page,
  }) => {
    // Count initial nodes
    const initialNodeCount = await page
      .locator(".react-flow__node")
      .count();

    // Find a source handle on the right side
    const sourceHandle = page
      .locator(".react-flow__handle-right")
      .first();
    await expect(sourceHandle).toBeVisible();

    const handleBox = await sourceHandle.boundingBox();
    if (!handleBox) return;

    // Drag from the handle to an empty area
    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;
    const endX = startX + 300;
    const endY = startY;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 10 });
    await page.mouse.up();

    // Wait for node creation API call
    await page.waitForTimeout(1000);

    // Should have one more node
    const finalNodeCount = await page
      .locator(".react-flow__node")
      .count();
    expect(finalNodeCount).toBe(initialNodeCount + 1);
  });
});
