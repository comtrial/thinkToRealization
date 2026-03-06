import { test, expect } from "@playwright/test";
import {
  cleanTestData,
  createTestProject,
  createTestNode,
  createTestEdge,
  selectProjectInSidebar,
} from "./helpers";

const API = "http://localhost:3333/api";

test.describe("UI: Sub-issue canvas interactions", () => {
  let projectId: string;
  let parentNodeId: string;
  let projectTitle: string;

  test.beforeEach(async ({ page }) => {
    const ts = Date.now();
    projectTitle = `Sub-Issue UI ${ts}`;
    const project = await createTestProject(projectTitle, `__e2e__sub-issue-ui-${ts}`);
    projectId = project.id;
    const parentNode = await createTestNode(projectId, {
      type: "issue",
      title: "Parent Issue",
      description: "Main issue with sub-issues",
      canvasX: 300,
      canvasY: 100,
    });
    parentNodeId = parentNode.id;
    await selectProjectInSidebar(page, projectTitle);
  });

  test("Canvas context menu has 'New issue' option", async ({ page }) => {
    // Switch to canvas tab
    await page.keyboard.press("Meta+2");
    await page.waitForTimeout(1000);

    // Wait for react-flow pane to be ready
    const pane = page.locator(".react-flow__pane");
    await expect(pane).toBeVisible({ timeout: 10000 });

    // Right-click on the pane (empty canvas area)
    await pane.click({ button: "right", position: { x: 100, y: 100 } });
    await page.waitForTimeout(500);

    // Context menu should have the issue creation option
    const issueOption = page.getByText("새 이슈");
    await expect(issueOption).toBeVisible({ timeout: 5000 });
  });

  test("Side panel shows sub-issue button for issue type nodes", async ({ page }) => {
    // Switch to canvas tab
    await page.keyboard.press("Meta+2");
    await page.waitForTimeout(1000);

    // Click the issue node to select it and open side panel
    const node = page.locator(`[data-id="${parentNodeId}"]`);
    await expect(node).toBeVisible({ timeout: 10000 });
    await node.click();

    // Wait for side panel to open and load node details
    await page.waitForTimeout(1000);

    // Side panel should show the "하위 이슈 추가" button
    const subIssueBtn = page.getByText("하위 이슈 추가");
    await expect(subIssueBtn).toBeVisible({ timeout: 10000 });
  });

  test("Sub-issue button not shown for non-issue type nodes", async ({ page }) => {
    // Create a task node (not issue)
    const taskNode = await createTestNode(projectId, {
      type: "task",
      title: "Regular Task",
      canvasX: 600,
      canvasY: 100,
    });

    // Refresh and re-select project to pick up new node
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Navigate to project via sidebar — retry with page reload if needed
    const projectList = page.getByTestId("project-list");
    try {
      await projectList.getByText(projectTitle).waitFor({ timeout: 5000 });
    } catch {
      // Project might not be in the list yet, try reloading
      await page.reload();
      await page.waitForLoadState("networkidle");
      await projectList.getByText(projectTitle).waitFor({ timeout: 15000 });
    }
    await projectList.getByText(projectTitle).click();
    await page.waitForTimeout(500);

    // Switch to canvas and select task node
    await page.keyboard.press("Meta+2");
    await page.waitForTimeout(1000);
    const node = page.locator(`[data-id="${taskNode.id}"]`);
    await expect(node).toBeVisible({ timeout: 10000 });
    await node.click();
    await page.waitForTimeout(500);

    // Sub-issue button should NOT be visible
    const subIssueBtn = page.getByText("하위 이슈 추가");
    await expect(subIssueBtn).toBeHidden({ timeout: 3000 });
  });
});

test.describe("API: Sub-issue creation and linking", () => {
  let projectId: string;
  let parentNodeId: string;

  test.beforeEach(async () => {
    const ts = Date.now();
    const project = await createTestProject(`Sub-Issue API ${ts}`, `__e2e__sub-issue-api-${ts}`);
    projectId = project.id;
    const parentNode = await createTestNode(projectId, {
      type: "issue",
      title: "Parent Issue",
      description: "Main issue with sub-issues",
      canvasX: 300,
      canvasY: 100,
    });
    parentNodeId = parentNode.id;
  });

  test("Sub-issue creation via API creates child with parentNodeId and edge", async () => {
    const childRes = await fetch(`${API}/projects/${projectId}/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "issue",
        title: "Sub Issue 1",
        status: "backlog",
        parentNodeId,
        canvasX: 300,
        canvasY: 300,
      }),
    });
    expect(childRes.status).toBe(201);
    const childJson = await childRes.json();
    const child = childJson.data;
    expect(child).toBeDefined();
    expect(child.parentNodeId).toBe(parentNodeId);

    // Create dependency edge
    const edgeRes = await fetch(`${API}/edges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromNodeId: parentNodeId,
        toNodeId: child.id,
        type: "dependency",
      }),
    });
    expect(edgeRes.status).toBe(201);
    const edge = (await edgeRes.json()).data;
    expect(edge.type).toBe("dependency");
  });

  test("Multiple sub-issues under same parent via API", async () => {
    const children = [];
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${API}/projects/${projectId}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "issue",
          title: `Sub Issue ${i + 1}`,
          status: "backlog",
          parentNodeId,
          canvasX: 300,
          canvasY: 300 + i * 200,
        }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      const child = json.data;
      expect(child).toBeDefined();
      children.push(child);

      const edgeRes = await fetch(`${API}/edges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromNodeId: parentNodeId,
          toNodeId: child.id,
          type: "dependency",
        }),
      });
      expect(edgeRes.status).toBe(201);
    }

    // Verify all 3 children exist with correct parentNodeId
    for (const child of children) {
      const nodeRes = await fetch(`${API}/nodes/${child.id}`);
      expect(nodeRes.ok).toBe(true);
      const nodeJson = await nodeRes.json();
      expect(nodeJson.data.parentNodeId).toBe(parentNodeId);
    }

    // Verify 3 edges from parent
    const canvasRes = await fetch(`${API}/projects/${projectId}/canvas`);
    expect(canvasRes.ok).toBe(true);
    const canvas = (await canvasRes.json()).data;
    const parentEdges = canvas.edges.filter(
      (e: { fromNodeId: string }) => e.fromNodeId === parentNodeId
    );
    expect(parentEdges.length).toBe(3);
  });

  test("Sub-issue inherits parent project context", async () => {
    const childRes = await fetch(`${API}/projects/${projectId}/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "issue",
        title: "Context Child",
        status: "backlog",
        parentNodeId,
        canvasX: 300,
        canvasY: 300,
      }),
    });
    expect(childRes.status).toBe(201);
    const childJson = await childRes.json();
    const child = childJson.data;
    expect(child).toBeDefined();
    expect(child.projectId).toBe(projectId);
  });
});
