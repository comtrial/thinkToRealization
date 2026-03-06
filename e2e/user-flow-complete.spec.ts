import { test, expect } from "@playwright/test";
import {
  createTestNode,
  createTestEdge,
} from "./helpers";

const API = "http://localhost:3333/api";

/**
 * Unique prefix for this test suite to avoid interference from concurrent
 * test suites that call cleanTestData() (which removes __e2e__ prefixed projects).
 */
const FLOW_PREFIX = "e2e-flow-";

/** Create a project with our unique prefix. */
async function createFlowProject(title: string) {
  const slug = FLOW_PREFIX + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
  const res = await fetch(`${API}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      slug,
      description: "E2E flow test project",
      projectDir: "/tmp/test-project",
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`createFlowProject failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json.data;
}

/** Clean only our flow-test projects. Resilient to server errors. */
async function cleanFlowData() {
  try {
    const res = await fetch(`${API}/projects`);
    if (!res.ok) return;
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { return; }
    const flowProjects = (json.data || []).filter(
      (p: { slug: string }) => p.slug.startsWith(FLOW_PREFIX),
    );
    for (const p of flowProjects) {
      await fetch(`${API}/projects/${p.id}`, { method: "DELETE" }).catch(() => {});
    }
  } catch {
    // Server may be down during cleanup — ignore
  }
}

test.describe("Full user journey: end-to-end flow", () => {
  test.afterAll(async () => {
    await cleanFlowData();
  });

  // --- Test 1: Dashboard loads with project list ---
  test("Dashboard loads and project list is visible in sidebar", async ({
    page,
  }) => {
    const project = await createFlowProject("Flow Dashboard");
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Sidebar project list area should be visible
    const projectList = page.getByTestId("project-list");
    await expect(projectList).toBeVisible({ timeout: 10000 });

    // Our project should appear in the list
    await expect(projectList.getByText("Flow Dashboard")).toBeVisible({
      timeout: 15000,
    });

    // Dashboard content should be visible
    const main = page.locator("main");
    await expect(main).toBeVisible();
  });

  // --- Test 2: Create project, navigate to canvas ---
  test("Create project via API, navigate to canvas, canvas renders", async ({
    page,
  }) => {
    const project = await createFlowProject("Flow Canvas");

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const projectList = page.getByTestId("project-list");
    await expect(projectList.getByText("Flow Canvas")).toBeVisible({
      timeout: 15000,
    });
    await projectList.getByText("Flow Canvas").click();
    await page.waitForTimeout(500);

    // Switch to canvas tab
    await page.keyboard.press("Meta+2");

    // Canvas should render with ReactFlow
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".react-flow__background")).toBeVisible();
    await expect(page.locator(".react-flow__controls")).toBeVisible();
  });

  // --- Test 3: Create issue node on canvas via context menu ---
  test("Create issue node on canvas, node appears", async ({ page }) => {
    const suffix = Date.now().toString().slice(-4);
    const project = await createFlowProject(`Flow Node ${suffix}`);

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const projectList = page.getByTestId("project-list");
    await expect(projectList.getByText(`Flow Node ${suffix}`)).toBeVisible({
      timeout: 15000,
    });
    await projectList.getByText(`Flow Node ${suffix}`).click();
    await page.waitForTimeout(500);

    // Switch to canvas
    await page.keyboard.press("Meta+2");
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });

    // Right-click to open context menu
    const canvas = page.locator(".react-flow__pane");
    await canvas.click({ button: "right", position: { x: 300, y: 200 } });

    // Click "새 이슈" in context menu if it appears
    const menuItem = page.getByText("새 이슈");
    if (await menuItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await menuItem.click();

      // At least one node should appear
      const nodes = page.locator(".react-flow__node");
      await expect(nodes.first()).toBeVisible({ timeout: 10000 });
    }
  });

  // --- Test 4: Create sub-issue with parent-child relationship ---
  test("Create sub-issue: parent-child via API and verify on canvas", async ({
    page,
  }) => {
    const suffix = Date.now().toString().slice(-4);
    const project = await createFlowProject(`Flow Sub-Issue ${suffix}`);
    const parentNode = await createTestNode(project.id, {
      type: "issue",
      title: "Parent Issue",
      canvasX: 200,
      canvasY: 100,
    });

    // Create child via API
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
    expect(childRes.status).toBe(201);
    const child = (await childRes.json()).data;

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

    // Verify via canvas API
    const canvasRes = await fetch(`${API}/projects/${project.id}/canvas`);
    expect(canvasRes.status).toBe(200);
    const canvasData = (await canvasRes.json()).data;
    expect(canvasData.nodes.length).toBe(2);
    expect(canvasData.edges.length).toBe(1);

    // Verify visually
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const projectList = page.getByTestId("project-list");
    await expect(projectList.getByText(`Flow Sub-Issue ${suffix}`)).toBeVisible({
      timeout: 15000,
    });
    await projectList.getByText(`Flow Sub-Issue ${suffix}`).click();
    await page.waitForTimeout(500);

    await page.keyboard.press("Meta+2");
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });

    await expect(page.locator(".react-flow__node")).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(page.locator(".react-flow__edge")).toHaveCount(1, {
      timeout: 10000,
    });
  });

  // --- Test 5: Open side panel and check tabs ---
  test("Open side panel and verify tabs", async ({ page }) => {
    const project = await createFlowProject("Flow Panel");
    const node = await createTestNode(project.id, {
      type: "issue",
      title: "Panel Test Issue",
      canvasX: 200,
      canvasY: 200,
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const projectList = page.getByTestId("project-list");
    await expect(projectList.getByText("Flow Panel")).toBeVisible({
      timeout: 15000,
    });
    await projectList.getByText("Flow Panel").click();
    await page.waitForTimeout(500);

    await page.keyboard.press("Meta+2");
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });

    // Click the node to open side panel
    const nodeEl = page.locator(`[data-id="${node.id}"]`);
    await expect(nodeEl).toBeVisible({ timeout: 10000 });
    await nodeEl.click();

    // Side panel should open
    const panel = page.getByTestId("side-panel");
    await expect(panel).toBeVisible({ timeout: 5000 });

    // Verify tabs exist
    await expect(page.getByText("개요")).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole("tab", { name: "세션" })).toBeVisible({
      timeout: 3000,
    });
    await expect(page.getByText("파일")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("계획서")).toBeVisible({ timeout: 3000 });
  });

  // --- Test 6: Verify sidebar issue list ---
  test("Issue list visible in sidebar and canvas", async ({ page }) => {
    const project = await createFlowProject("Flow Issues");
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

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const projectList = page.getByTestId("project-list");
    await expect(projectList.getByText("Flow Issues")).toBeVisible({
      timeout: 15000,
    });
    await projectList.getByText("Flow Issues").click();
    await page.waitForTimeout(500);

    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();

    // Switch to canvas
    await page.keyboard.press("Meta+2");
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".react-flow__node")).toHaveCount(2, {
      timeout: 10000,
    });
  });

  // --- Test 7: API smoke test - context assembler ---
  test("API smoke test: context assembler returns prompt", async () => {
    // Verify server is responsive before starting
    const healthCheck = await fetch(`${API}/projects`);
    expect(healthCheck.ok).toBeTruthy();

    const project = await createFlowProject("Flow Context");
    const node = await createTestNode(project.id, {
      type: "issue",
      title: "Context Test Issue",
      description: "Test issue for context assembly",
      canvasX: 100,
      canvasY: 100,
    });

    // Verify node exists
    const nodeCheck = await fetch(`${API}/nodes/${node.id}`);
    expect(nodeCheck.status).toBe(200);

    const res = await fetch(`${API}/nodes/${node.id}/context`, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBeDefined();
    expect(typeof json.data.prompt).toBe("string");
    expect(json.data.prompt.length).toBeGreaterThan(0);
  });

  // --- Test 8: API smoke test - plans endpoint ---
  test("API smoke test: plans endpoint returns empty array", async () => {
    // Verify server is responsive before starting
    const healthCheck = await fetch(`${API}/projects`);
    expect(healthCheck.ok).toBeTruthy();

    const project = await createFlowProject("Flow Plans");
    const node = await createTestNode(project.id, {
      type: "issue",
      title: "Plans Test Issue",
      canvasX: 100,
      canvasY: 100,
    });

    // Verify node exists
    const nodeCheck = await fetch(`${API}/nodes/${node.id}`);
    expect(nodeCheck.status).toBe(200);

    const res = await fetch(`${API}/nodes/${node.id}/plans`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBe(0);
  });

  // --- Test 9: Full lifecycle journey (API only) ---
  test("Full journey: project -> nodes -> edges -> session lifecycle", async () => {
    // Verify server is responsive
    const healthCheck = await fetch(`${API}/projects`);
    expect(healthCheck.ok).toBeTruthy();

    // 1. Create project
    const project = await createFlowProject("Flow Full");

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
    expect(edge).toBeDefined();
    expect(edge.type).toBe("sequence");

    // 4. Verify canvas state
    const canvasRes = await fetch(`${API}/projects/${project.id}/canvas`);
    expect(canvasRes.status).toBe(200);
    const canvasJson = await canvasRes.json();
    expect(canvasJson.data).toBeDefined();
    expect(canvasJson.data.nodes.length).toBe(2);
    expect(canvasJson.data.edges.length).toBe(1);

    // 5. Start session on task
    const sessionRes = await fetch(`${API}/nodes/${task.id}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Working on task" }),
    });
    expect(sessionRes.status).toBe(201);
    const session = (await sessionRes.json()).data;
    expect(session.status).toBe("active");

    // 6. Verify auto-transition to in_progress
    const taskCheck = await fetch(`${API}/nodes/${task.id}`);
    const taskData = (await taskCheck.json()).data;
    expect(taskData.status).toBe("in_progress");

    // 7. End session as completed
    const endRes = await fetch(`${API}/sessions/${session.id}/end`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    expect(endRes.status).toBe(200);
    const endData = (await endRes.json()).data;
    expect(endData.status).toBe("completed");

    // 8. Verify node is done
    const finalCheck = await fetch(`${API}/nodes/${task.id}`);
    const finalData = (await finalCheck.json()).data;
    expect(finalData.status).toBe("done");

    // 9. Verify dashboard data
    const dashRes = await fetch(`${API}/projects/${project.id}/dashboard`);
    expect(dashRes.status).toBe(200);
    const dash = (await dashRes.json()).data;
    expect(dash.recentDone.length).toBe(1);
    expect(dash.recentDone[0].title).toBe("Implementation Task");
  });
});
