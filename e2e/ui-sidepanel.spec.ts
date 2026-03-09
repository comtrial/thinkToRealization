import { test, expect } from "@playwright/test";
import {
  cleanTestData,
  createTestProject,
  createTestNode,
  createTestDecision,
  selectProjectInSidebar,
} from "./helpers";

const API = "http://localhost:3333/api";

test.describe("UI: Side panel interactions", () => {
  let projectId: string;
  let nodeId: string;

  test.beforeEach(async ({ page }) => {
    await cleanTestData();
    const project = await createTestProject("Panel Project");
    projectId = project.id;

    const node = await createTestNode(projectId, {
      title: "Panel Test Node",
      type: "feature",
      canvasX: 0,
      canvasY: 0,
    });
    nodeId = node.id;

    await selectProjectInSidebar(page, "Panel Project");

    // Switch to canvas and wait for node to render
    await page.getByRole("navigation").getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });

    // Wait for nodes to load with retries
    const nodeEl = page.locator(".react-flow__node");
    await expect(nodeEl).toBeVisible({ timeout: 15000 });
    await nodeEl.click();

    const panel = page.getByTestId("side-panel");
    await expect(panel).toBeVisible({ timeout: 5000 });
  });

  test("Side panel shows node title", async ({ page }) => {
    const panel = page.getByTestId("side-panel");
    await expect(panel).toContainText("Panel Test Node", { timeout: 5000 });
  });

  test("Side panel has tabs: Overview, Sessions", async ({ page }) => {
    const panel = page.getByTestId("side-panel");
    await expect(panel.getByText("개요")).toBeVisible();
    await expect(panel.getByText("세션")).toBeVisible();
  });

  test("Overview tab shows node property selectors", async ({ page }) => {
    const panel = page.getByTestId("side-panel");
    // Should show status, priority, type selectors
    await expect(panel.locator("select")).toHaveCount(3, { timeout: 5000 });
  });

  test("Close panel with close button", async ({ page }) => {
    const closeBtn = page.getByTestId("panel-close-btn");
    await closeBtn.click();
    await expect(page.getByTestId("side-panel")).toBeHidden({ timeout: 3000 });
  });

  test("Close panel with Escape key", async ({ page }) => {
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("side-panel")).toBeHidden({ timeout: 3000 });
  });

  test("Toggle fullscreen mode", async ({ page }) => {
    const fullscreenBtn = page.getByTestId("panel-fullscreen-btn");
    await expect(fullscreenBtn).toBeVisible({ timeout: 3000 });

    await fullscreenBtn.click();

    const panel = page.getByTestId("side-panel");
    await expect(panel).toBeVisible();

    // Press Escape to go back to peek
    await page.keyboard.press("Escape");
    await expect(panel).toBeVisible(); // still visible in peek mode
  });

  test("Switch panel tabs", async ({ page }) => {
    const panel = page.getByTestId("side-panel");

    await panel.getByText("세션").click();
    await page.waitForTimeout(500);

    await panel.getByText("개요").click();
    await page.waitForTimeout(500);

    await expect(panel).toBeVisible();
  });

  test("Overview tab shows decisions when present", async ({ page }) => {
    await createTestDecision(nodeId, "Use TypeScript for type safety");
    await createTestDecision(nodeId, "Adopt Zustand for state management");

    await page.reload();
    await page.waitForLoadState("networkidle");

    await page.getByRole("navigation").getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });
    const nodeEl = page.locator(".react-flow__node");
    await expect(nodeEl).toBeVisible({ timeout: 10000 });
    await nodeEl.click();

    const panel = page.getByTestId("side-panel");
    await expect(panel).toBeVisible({ timeout: 5000 });
    await expect(panel).toContainText("결정사항", { timeout: 5000 });
    await expect(panel).toContainText("Use TypeScript", { timeout: 5000 });
    await expect(panel).toContainText("Adopt Zustand", { timeout: 5000 });
  });

  test("Overview tab shows creation date", async ({ page }) => {
    const panel = page.getByTestId("side-panel");
    await expect(panel).toContainText("년", { timeout: 5000 });
  });
});
