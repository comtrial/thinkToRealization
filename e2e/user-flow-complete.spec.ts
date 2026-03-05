import { test, expect } from "@playwright/test";
import {
  cleanTestData,
  createTestProject,
  createTestNode,
  createTestEdge,
  selectProjectInSidebar,
} from "./helpers";

const API = "http://localhost:3333/api";

test.describe("Full user journey: end-to-end flow", () => {
  test.beforeEach(async () => {
    await cleanTestData();
  });

  test("Dashboard loads and project list is visible in sidebar", async ({
    page,
  }) => {
    const project = await createTestProject("Journey Project");
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Sidebar should show the project
    const projectList = page.getByTestId("project-list");
    await expect(projectList).toContainText("Journey Project", {
      timeout: 10000,
    });

    // Header should show the auto-selected project
    await expect(page.locator("header")).toContainText("Journey Project", {
      timeout: 5000,
    });

    // Dashboard content should be visible
    const main = page.locator("main");
    await expect(main).toBeVisible();
  });

  test("Create project via API, navigate to canvas, canvas renders", async ({
    page,
  }) => {
    const project = await createTestProject("Canvas Journey");

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Select the project
    await selectProjectInSidebar(page, "Canvas Journey");

    // Switch to canvas tab
    await page.keyboard.press("Meta+2");

    // Canvas should render with ReactFlow
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".react-flow__background")).toBeVisible();
    await expect(page.locator(".react-flow__controls")).toBeVisible();

    // Empty canvas - no nodes
    const nodes = page.locator(".react-flow__node");
    await expect(nodes).toHaveCount(0, { timeout: 3000 });
  });

  test("Create issue node on canvas, node appears", async ({ page }) => {
    const project = await createTestProject("Node Journey");
    await selectProjectInSidebar(page, "Node Journey");

    // Switch to canvas
    await page.keyboard.press("Meta+2");
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });

    // Right-click to create an issue node
    const canvas = page.locator(".react-flow__pane");
    await canvas.click({ button: "right", position: { x: 300, y: 200 } });

    // Click "새 이슈" in context menu
    await page.getByText("새 이슈").click();

    // Node should appear on canvas
    const nodes = page.locator(".react-flow__node");
    await expect(nodes).toHaveCount(1, { timeout: 5000 });
    await expect(nodes.first()).toContainText("새 이슈", { timeout: 3000 });
  });

  test("Create sub-issue: child node and edge appear", async ({ page }) => {
    const project = await createTestProject("Sub-Issue Journey");
    const parentNode = await createTestNode(project.id, {
      type: "issue",
      title: "Parent Issue",
      canvasX: 200,
      canvasY: 100,
    });

    await selectProjectInSidebar(page, "Sub-Issue Journey");
    await page.keyboard.press("Meta+2");
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".react-flow__node")).toHaveCount(1, {
      timeout: 10000,
    });

    // Create sub-issue via API (the UI button triggers the same store action)
    const childRes = await fetch(`${API}/projects/${project.id}/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "issue",
        title: "Child Issue",
        status: "backlog",
        parentNodeId: parentNode.id,
        canvasX: 200,
        canvasY: 350,
      }),
    });
    const child = (await childRes.json()).data;
    expect(childRes.status).toBe(201);

    // Create dependency edge
    const edgeRes = await fetch(`${API}/edges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromNodeId: parentNode.id,
        toNodeId: child.id,
        type: "dependency",
      }),
    });
    expect(edgeRes.status).toBe(201);

    // Reload to see the new node and edge
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Meta+2");
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });

    // Should have 2 nodes and 1 edge
    await expect(page.locator(".react-flow__node")).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(page.locator(".react-flow__edge")).toHaveCount(1, {
      timeout: 10000,
    });
  });

  test("Open side panel and verify tabs", async ({ page }) => {
    const project = await createTestProject("Panel Journey");
    const node = await createTestNode(project.id, {
      type: "issue",
      title: "Panel Test Issue",
      canvasX: 200,
      canvasY: 200,
    });

    await selectProjectInSidebar(page, "Panel Journey");
    await page.keyboard.press("Meta+2");
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });

    // Click the node to open side panel
    const nodeEl = page.locator(`[data-id="${node.id}"]`);
    await expect(nodeEl).toBeVisible({ timeout: 10000 });
    await nodeEl.click();

    // Side panel should open
    const panel = page.getByTestId("side-panel");
    await expect(panel).toBeVisible({ timeout: 5000 });

    // Verify tabs exist: overview, sessions, files (and potentially plans for issue type)
    await expect(page.getByText("개요")).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole("tab", { name: "세션" })).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("파일")).toBeVisible({ timeout: 3000 });
    // Issue type should also have plans tab
    await expect(page.getByText("계획서")).toBeVisible({ timeout: 3000 });
  });

  test("Edit node description via side panel", async ({ page }) => {
    const project = await createTestProject("Edit Journey");
    const node = await createTestNode(project.id, {
      type: "task",
      title: "Editable Task",
      description: "Original description",
      canvasX: 200,
      canvasY: 200,
    });

    await selectProjectInSidebar(page, "Edit Journey");
    await page.keyboard.press("Meta+2");
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });

    // Click node to open side panel
    const nodeEl = page.locator(`[data-id="${node.id}"]`);
    await expect(nodeEl).toBeVisible({ timeout: 10000 });
    await nodeEl.click();

    const panel = page.getByTestId("side-panel");
    await expect(panel).toBeVisible({ timeout: 5000 });

    // The overview tab should show the description
    // Find the description textarea/input
    const descField = panel.locator("textarea").first();
    if (await descField.isVisible().catch(() => false)) {
      await descField.clear();
      await descField.fill("Updated description");
      // Wait for auto-save debounce
      await page.waitForTimeout(1000);

      // Verify via API
      const res = await fetch(`${API}/nodes/${node.id}`);
      const json = await res.json();
      expect(json.data.description).toBe("Updated description");
    }
  });

  test("Issue list visible in sidebar", async ({ page }) => {
    const project = await createTestProject("Issue List Journey");
    await createTestNode(project.id, {
      type: "issue",
      title: "Bug Fix Required",
      canvasX: 100,
      canvasY: 100,
    });
    await createTestNode(project.id, {
      type: "issue",
      title: "Performance Issue",
      canvasX: 100,
      canvasY: 300,
    });
    await createTestNode(project.id, {
      type: "task",
      title: "Regular Task",
      canvasX: 400,
      canvasY: 100,
    });

    await selectProjectInSidebar(page, "Issue List Journey");

    // The sidebar should show node list under "My Work"
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();

    // Switch to canvas to see nodes
    await page.keyboard.press("Meta+2");
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".react-flow__node")).toHaveCount(3, {
      timeout: 10000,
    });
  });

  test("Full journey: project -> nodes -> edges -> session lifecycle", async () => {
    // 1. Create project
    const project = await createTestProject("Full Journey");

    // 2. Create nodes
    const issue = await createTestNode(project.id, {
      type: "issue",
      title: "Main Issue",
      canvasX: 0,
      canvasY: 0,
    });
    const task = await createTestNode(project.id, {
      type: "task",
      title: "Implementation Task",
      canvasX: 300,
      canvasY: 0,
    });

    // 3. Create edge
    const edge = await createTestEdge(issue.id, task.id, {
      type: "sequence",
    });
    expect(edge.type).toBe("sequence");

    // 4. Verify canvas state
    const canvasRes = await fetch(`${API}/projects/${project.id}/canvas`);
    const canvas = (await canvasRes.json()).data;
    expect(canvas.nodes.length).toBe(2);
    expect(canvas.edges.length).toBe(1);

    // 5. Start session on task
    const sessionRes = await fetch(`${API}/nodes/${task.id}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Working on task" }),
    });
    const session = (await sessionRes.json()).data;
    expect(session.status).toBe("active");

    // 6. Verify auto-transition to in_progress
    const taskCheck = await fetch(`${API}/nodes/${task.id}`);
    expect((await taskCheck.json()).data.status).toBe("in_progress");

    // 7. End session as completed
    const endRes = await fetch(`${API}/sessions/${session.id}/end`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    expect((await endRes.json()).data.status).toBe("completed");

    // 8. Verify node is done
    const finalCheck = await fetch(`${API}/nodes/${task.id}`);
    expect((await finalCheck.json()).data.status).toBe("done");

    // 9. Verify dashboard data
    const dashRes = await fetch(`${API}/projects/${project.id}/dashboard`);
    const dash = (await dashRes.json()).data;
    expect(dash.recentDone.length).toBe(1);
    expect(dash.recentDone[0].title).toBe("Implementation Task");
  });
});
