import { test, expect } from "@playwright/test";
import { cleanTestData, createTestProject, createTestNode, selectProjectInSidebar } from "./helpers";

test.describe("Keyboard Shortcuts", () => {
  test.beforeEach(async ({ page }) => {
    await cleanTestData();
    await createTestProject("단축키 테스트");
    await selectProjectInSidebar(page, "단축키 테스트");
  });

  test.afterAll(async () => {
    await cleanTestData();
  });

  test("Cmd+1 switches to dashboard tab", async ({ page }) => {
    // Switch to canvas first
    await page.getByRole("navigation").getByRole("button", { name: "캔버스" }).click();
    await expect(
      page.locator("header button[data-active='true']", { hasText: "캔버스" }),
    ).toBeVisible();

    // Cmd+1 to switch to dashboard
    await page.keyboard.press("Meta+1");

    await expect(
      page.locator("header button[data-active='true']", { hasText: "대시보드" }),
    ).toBeVisible();
  });

  test("Cmd+2 switches to canvas tab", async ({ page }) => {
    // Dashboard is default
    await expect(
      page.locator("header button[data-active='true']", { hasText: "대시보드" }),
    ).toBeVisible();

    // Cmd+2 to switch to canvas
    await page.keyboard.press("Meta+2");

    await expect(
      page.locator("header button[data-active='true']", { hasText: "캔버스" }),
    ).toBeVisible();
  });

  test("[ key toggles sidebar", async ({ page }) => {
    // Sidebar should be visible with "Workspace"
    const sidebar = page.locator("aside").first();
    await expect(sidebar).toContainText("Workspace");

    // Press [ to toggle sidebar
    await page.keyboard.press("[");

    // Sidebar should collapse (Workspace hidden)
    await expect(sidebar.getByText("Workspace")).toBeHidden();

    // Press [ again to reopen
    await page.keyboard.press("[");

    // Sidebar should show "Workspace" again
    await expect(sidebar.getByText("Workspace")).toBeVisible();
  });

  test("Cmd+K opens command palette", async ({ page }) => {
    // Cmd+K
    await page.keyboard.press("Meta+k");

    // Command palette should open
    const palette = page.locator("[cmdk-root]");
    await expect(palette).toBeVisible();

    // ESC to close
    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();
  });

  test("ESC closes side panel from peek mode", async ({ page }) => {
    // Get the test project to add a node
    const res = await fetch("http://localhost:3333/api/projects");
    const json = await res.json();
    const project = json.data.find((p: { slug: string }) => p.slug.startsWith("__e2e__"));
    await createTestNode(project.id, { title: "ESC 테스트 노드", canvasX: 200, canvasY: 200 });

    // Switch to canvas and click node
    await page.getByRole("navigation").getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });
    const nodeEl = page.locator(".react-flow__node").first();
    await expect(nodeEl).toBeVisible({ timeout: 10000 });
    await nodeEl.click();

    // Panel should be open
    const panel = page.getByTestId("side-panel");
    await expect(panel).toBeVisible({ timeout: 5000 });

    // ESC to close
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden({ timeout: 3000 });
  });

  test("ESC from full mode goes to peek mode", async ({ page }) => {
    // Get the test project to add a node
    const res = await fetch("http://localhost:3333/api/projects");
    const json = await res.json();
    const project = json.data.find((p: { slug: string }) => p.slug.startsWith("__e2e__"));
    await createTestNode(project.id, { title: "풀모드 노드", canvasX: 200, canvasY: 200 });

    // Switch to canvas and click node
    await page.getByRole("navigation").getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });
    const nodeEl = page.locator(".react-flow__node").first();
    await expect(nodeEl).toBeVisible({ timeout: 10000 });
    await nodeEl.click();

    const panel = page.getByTestId("side-panel");
    await expect(panel).toBeVisible();

    // Expand to full mode
    await page.getByTestId("panel-fullscreen-btn").click();
    await expect(panel).toHaveClass(/w-\[80%\]/);

    // ESC should go back to peek, not close
    await page.keyboard.press("Escape");
    await expect(panel).toBeVisible();
    await expect(panel).toHaveClass(/w-\[40%\]/);
  });
});
