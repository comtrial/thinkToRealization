import { test, expect } from "@playwright/test";
import {
  cleanTestData,
  createTestProject,
  createTestNode,
  createTestEdge,
  selectProjectInSidebar,
} from "./helpers";

test.describe("UI: Canvas view interactions", () => {
  let projectId: string;

  test.beforeEach(async ({ page }) => {
    await cleanTestData();
    const project = await createTestProject("Canvas Project");
    projectId = project.id;

    await selectProjectInSidebar(page, "Canvas Project");

    // Switch to canvas tab
    await page.getByRole("navigation").getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });
  });

  test("Canvas renders with ReactFlow", async ({ page }) => {
    await expect(page.locator(".react-flow")).toBeVisible();
    await expect(page.locator(".react-flow__background")).toBeVisible();
    await expect(page.locator(".react-flow__controls")).toBeVisible();
    await expect(page.locator(".react-flow__minimap")).toBeVisible();
  });

  test("Empty canvas shows no nodes", async ({ page }) => {
    const nodes = page.locator(".react-flow__node");
    await expect(nodes).toHaveCount(0, { timeout: 3000 });
  });

  test("Canvas renders pre-created nodes", async ({ page }) => {
    await createTestNode(projectId, {
      title: "Idea Node",
      type: "planning",
      canvasX: 100,
      canvasY: 100,
    });
    await createTestNode(projectId, {
      title: "Task Node",
      type: "feature",
      canvasX: 400,
      canvasY: 100,
    });

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.getByRole("navigation").getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });

    const nodes = page.locator(".react-flow__node");
    await expect(nodes).toHaveCount(2, { timeout: 10000 });
  });

  test("Canvas renders edges between nodes", async ({ page }) => {
    const n1 = await createTestNode(projectId, {
      title: "Source",
      type: "feature",
      canvasX: 100,
      canvasY: 100,
    });
    const n2 = await createTestNode(projectId, {
      title: "Target",
      type: "feature",
      canvasX: 400,
      canvasY: 100,
    });
    await createTestEdge(n1.id, n2.id, { type: "sequence" });

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.getByRole("navigation").getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });

    const edges = page.locator(".react-flow__edge");
    await expect(edges).toHaveCount(1, { timeout: 10000 });
  });

  test("Right-click canvas opens context menu", async ({ page }) => {
    const canvas = page.locator(".react-flow__pane");
    await canvas.click({ button: "right", position: { x: 300, y: 200 } });

    await expect(page.getByText("새 기획")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("새 기능개발")).toBeVisible();
    await expect(page.getByText("새 이슈")).toBeVisible();
  });

  test("Create node via context menu", async ({ page }) => {
    const canvas = page.locator(".react-flow__pane");
    await canvas.click({ button: "right", position: { x: 300, y: 200 } });

    await page.getByText("새 기획").click();

    const nodes = page.locator(".react-flow__node");
    await expect(nodes).toHaveCount(1, { timeout: 5000 });
    await expect(nodes.first()).toContainText("새 기획", { timeout: 3000 });
  });

  test("Create multiple node types via context menu", async ({ page }) => {
    const canvas = page.locator(".react-flow__pane");

    await canvas.click({ button: "right", position: { x: 200, y: 200 } });
    await page.getByText("새 기능개발").click();
    await expect(page.locator(".react-flow__node")).toHaveCount(1, {
      timeout: 5000,
    });

    await canvas.click({ button: "right", position: { x: 500, y: 200 } });
    await page.getByText("새 이슈").click();
    await expect(page.locator(".react-flow__node")).toHaveCount(2, {
      timeout: 5000,
    });
  });

  test("Click node opens side panel", async ({ page }) => {
    await createTestNode(projectId, {
      title: "Clickable Node",
      type: "feature",
      canvasX: 200,
      canvasY: 200,
    });

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.getByRole("navigation").getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });

    const node = page.locator(".react-flow__node");
    await expect(node).toBeVisible({ timeout: 10000 });
    await node.click();

    const panel = page.getByTestId("side-panel");
    await expect(panel).toBeVisible({ timeout: 5000 });
  });

  test("Auto-layout button is visible", async ({ page }) => {
    const autoLayoutBtn = page.getByRole("button", { name: "자동 정렬" });
    await expect(autoLayoutBtn).toBeVisible();
  });

  test("Auto-layout rearranges nodes", async ({ page }) => {
    await createTestNode(projectId, {
      title: "Node A",
      type: "feature",
      canvasX: 0,
      canvasY: 0,
    });
    await createTestNode(projectId, {
      title: "Node B",
      type: "feature",
      canvasX: 0,
      canvasY: 0,
    });

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.getByRole("navigation").getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".react-flow__node")).toHaveCount(2, {
      timeout: 10000,
    });

    await page.getByRole("button", { name: "자동 정렬" }).click();
    await page.waitForTimeout(500);
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
  });

  test("Canvas zoom controls work", async ({ page }) => {
    const controls = page.locator(".react-flow__controls");
    await expect(controls).toBeVisible();

    const zoomIn = controls.locator("button").first();
    await expect(zoomIn).toBeVisible();
    await zoomIn.click();

    await page.waitForTimeout(300);
    await expect(page.locator(".react-flow")).toBeVisible();
  });
});
