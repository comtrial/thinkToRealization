import { test, expect } from "@playwright/test";
import {
  cleanTestData,
  createTestProject,
  createTestNode,
  createTestDecision,
  createTestSession,
  selectProjectInSidebar,
} from "./helpers";

test.describe("UX Improvements: Side Panel", () => {
  let projectId: string;
  let nodeId: string;

  test.beforeEach(async ({ page }) => {
    await cleanTestData();
    const project = await createTestProject("UX Test Project");
    projectId = project.id;

    const node = await createTestNode(projectId, {
      title: "UX Test Node",
      type: "task",
      description: "**Bold text** and *italic text*",
      canvasX: 200,
      canvasY: 200,
    });
    nodeId = node.id;

    await selectProjectInSidebar(page, "UX Test Project");

    await page.getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });
    const nodeEl = page.locator(".react-flow__node");
    await expect(nodeEl).toBeVisible({ timeout: 15000 });
    await nodeEl.click();

    await expect(page.getByTestId("side-panel")).toBeVisible({ timeout: 5000 });
  });

  test("Description renders markdown via TiptapEditor", async ({ page }) => {
    // TiptapEditor renders markdown as rich text (HTML)
    const editor = page.getByTestId("tiptap-editor");
    await expect(editor).toBeVisible({ timeout: 5000 });
    // Tiptap converts **Bold text** to <strong> and *italic text* to <em>
    await expect(editor.locator("strong")).toContainText("Bold text");
    await expect(editor.locator("em")).toContainText("italic text");
  });

  test("TiptapEditor is always visible (inline editing)", async ({ page }) => {
    const editor = page.getByTestId("tiptap-editor");
    await expect(editor).toBeVisible({ timeout: 5000 });
    // Should have contenteditable area
    const contentEditable = editor.locator("[contenteditable]");
    await expect(contentEditable).toBeVisible();
  });

  test("Description auto-saves with debounce and persists", async ({
    page,
  }) => {
    const editor = page.getByTestId("tiptap-editor");
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Click into the editor and clear + type new content
    const contentEditable = editor.locator("[contenteditable]");
    await contentEditable.click();
    // Select all and type new content
    await page.keyboard.press("Meta+a");
    await page.keyboard.type("Auto-save description test");

    // Wait for debounce (500ms) + API round trip
    await page.waitForTimeout(2000);

    // Check save status indicator appeared
    const saveStatus = page.getByTestId("save-status");
    // It may show "저장됨" or have disappeared (idle after 2s)
    // Instead verify persistence via API directly
    const res = await page.evaluate(async (id: string) => {
      const r = await fetch(`/api/nodes/${id}`);
      return r.json();
    }, nodeId);

    expect(res.data.description).toContain("Auto-save description test");
  });

  test("Decision shows source label: session vs manual", async ({ page }) => {
    const session = await createTestSession(nodeId, "Alpha Session");
    await createTestDecision(nodeId, "Decision from session", session.id);
    await createTestDecision(nodeId, "Manual decision");

    await page.reload();
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });
    await page.locator(".react-flow__node").click();
    await expect(page.getByTestId("side-panel")).toBeVisible({ timeout: 5000 });

    // API returns createdAt desc → newest first
    const sources = page.getByTestId("decision-source");
    await expect(sources).toHaveCount(2, { timeout: 5000 });

    // Manual decision was created second → appears first (desc order)
    await expect(sources.nth(0)).toContainText("직접 추가");
    // Session-linked decision was created first → appears second
    await expect(sources.nth(1)).toContainText("세션:");
  });
});

test.describe("UX Improvements: Canvas", () => {
  test.beforeEach(async () => {
    await cleanTestData();
  });

  test("MiniMap has reduced size (120x80)", async ({ page }) => {
    const project = await createTestProject("MiniMap Project");
    await createTestNode(project.id, {
      title: "Node A",
      type: "task",
      canvasX: 100,
      canvasY: 100,
    });

    await selectProjectInSidebar(page, "MiniMap Project");

    await page.getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });

    const minimap = page.locator(".react-flow__minimap");
    await expect(minimap).toBeVisible({ timeout: 10000 });

    const box = await minimap.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeLessThanOrEqual(140);
    expect(box!.height).toBeLessThanOrEqual(100);
  });

  test("Dragging handle to empty space creates connected node", async ({
    page,
  }) => {
    const project = await createTestProject("Handle Drag Project");
    await createTestNode(project.id, {
      title: "Source Node",
      type: "task",
      canvasX: 200,
      canvasY: 200,
    });

    await selectProjectInSidebar(page, "Handle Drag Project");

    await page.getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".react-flow__node")).toBeVisible({
      timeout: 15000,
    });

    expect(await page.locator(".react-flow__node").count()).toBe(1);

    // Find the right source handle
    const sourceHandle = page.locator(
      '.react-flow__handle[data-handlepos="right"]',
    );
    await expect(sourceHandle.first()).toBeVisible({ timeout: 5000 });

    const handleBox = await sourceHandle.first().boundingBox();
    expect(handleBox).toBeTruthy();

    // Drag from handle to empty space (300px right)
    const startX = handleBox!.x + handleBox!.width / 2;
    const startY = handleBox!.y + handleBox!.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 300, startY, { steps: 10 });
    await page.mouse.up();

    // Wait for node creation
    await page.waitForTimeout(1500);

    // Should now have 2 nodes
    const finalNodeCount = await page.locator(".react-flow__node").count();
    expect(finalNodeCount).toBe(2);

    // Should have an edge
    const edges = page.locator(".react-flow__edge");
    await expect(edges).toHaveCount(1, { timeout: 5000 });
  });
});
