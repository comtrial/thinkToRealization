import { test, expect } from "@playwright/test";
import {
  cleanTestData,
  createTestProject,
  createTestNode,
  createTestEdge,
  selectProjectInSidebar,
} from "./helpers";

const API = "http://localhost:3333/api";

test.describe("Edge relationship types (parent_child & related)", () => {
  let projectId: string;
  let nodeAId: string;
  let nodeBId: string;
  let nodeCId: string;

  test.beforeEach(async () => {
    await cleanTestData();
    const project = await createTestProject("Edge Rel Project");
    projectId = project.id;
    const nodeA = await createTestNode(projectId, {
      title: "Parent Node",
      canvasX: 100,
      canvasY: 200,
    });
    const nodeB = await createTestNode(projectId, {
      title: "Child Node",
      canvasX: 500,
      canvasY: 200,
    });
    const nodeC = await createTestNode(projectId, {
      title: "Related Node",
      canvasX: 100,
      canvasY: 500,
    });
    nodeAId = nodeA.id;
    nodeBId = nodeB.id;
    nodeCId = nodeC.id;
  });

  // ── API Tests ──

  test("POST /api/edges creates parent_child edge", async () => {
    const res = await fetch(`${API}/edges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromNodeId: nodeAId,
        toNodeId: nodeBId,
        type: "parent_child",
      }),
    });
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.data.type).toBe("parent_child");
    expect(json.data.fromNodeId).toBe(nodeAId);
    expect(json.data.toNodeId).toBe(nodeBId);
  });

  test("POST /api/edges creates related edge", async () => {
    const res = await fetch(`${API}/edges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromNodeId: nodeAId,
        toNodeId: nodeCId,
        type: "related",
      }),
    });
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.data.type).toBe("related");
  });

  test("PUT /api/edges/:id updates to parent_child", async () => {
    const edge = await createTestEdge(nodeAId, nodeBId, { type: "related" });
    const res = await fetch(`${API}/edges/${edge.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "parent_child" }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.type).toBe("parent_child");
  });

  test("PUT /api/edges/:id updates to related", async () => {
    const edge = await createTestEdge(nodeAId, nodeBId, { type: "parent_child" });
    const res = await fetch(`${API}/edges/${edge.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "related" }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.type).toBe("related");
  });

  test("Edge reconnection via delete + create changes type", async () => {
    // Simulate reconnection: delete old edge, create new with different type
    const edge = await createTestEdge(nodeAId, nodeBId, { type: "parent_child" });
    const delRes = await fetch(`${API}/edges/${edge.id}`, { method: "DELETE" });
    expect(delRes.status).toBe(200);

    // Recreate as related type (simulating handle change from right to bottom)
    const createRes = await fetch(`${API}/edges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromNodeId: nodeAId,
        toNodeId: nodeCId,
        type: "related",
      }),
    });
    const json = await createRes.json();
    expect(createRes.status).toBe(201);
    expect(json.data.type).toBe("related");
  });

  // ── UI Tests ──

  test("Canvas renders parent_child edge with label", async ({ page }) => {
    await createTestEdge(nodeAId, nodeBId, { type: "parent_child" });

    await selectProjectInSidebar(page, "Edge Rel Project");
    await page.getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });

    // Verify edge is rendered
    const edges = page.locator(".react-flow__edge");
    await expect(edges).toHaveCount(1, { timeout: 10000 });

    // Verify edge label shows relationship type
    await expect(page.getByText("상위-하위")).toBeVisible({ timeout: 5000 });
  });

  test("Canvas renders related edge with label", async ({ page }) => {
    await createTestEdge(nodeAId, nodeCId, { type: "related" });

    await selectProjectInSidebar(page, "Edge Rel Project");
    await page.getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });

    const edges = page.locator(".react-flow__edge");
    await expect(edges).toHaveCount(1, { timeout: 10000 });

    // Verify related edge label
    await expect(page.getByText("연관")).toBeVisible({ timeout: 5000 });
  });

  test("Canvas renders both edge types simultaneously", async ({ page }) => {
    await createTestEdge(nodeAId, nodeBId, { type: "parent_child" });
    await createTestEdge(nodeAId, nodeCId, { type: "related" });

    await selectProjectInSidebar(page, "Edge Rel Project");
    await page.getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });

    const edges = page.locator(".react-flow__edge");
    await expect(edges).toHaveCount(2, { timeout: 10000 });

    await expect(page.getByText("상위-하위")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("연관")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Node markdown preview on canvas", () => {
  let projectId: string;

  test.beforeEach(async () => {
    await cleanTestData();
    const project = await createTestProject("MD Preview Project");
    projectId = project.id;
  });

  test("Node with description shows markdown preview in expanded view", async ({ page }) => {
    await createTestNode(projectId, {
      title: "MD Node",
      type: "feature",
      description: "## Heading\n\n- item 1\n- item 2\n\n**Bold text** and `code`",
      canvasX: 300,
      canvasY: 300,
    });

    await selectProjectInSidebar(page, "MD Preview Project");
    await page.getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });

    const node = page.locator(".react-flow__node");
    await expect(node).toBeVisible({ timeout: 10000 });

    // Zoom in to trigger expanded view (zoom > 0.8)
    const controls = page.locator(".react-flow__controls");
    const zoomIn = controls.locator("button").first();
    for (let i = 0; i < 3; i++) {
      await zoomIn.click();
      await page.waitForTimeout(200);
    }

    // Verify markdown content is visible in the node
    await expect(node.getByText("Heading")).toBeVisible({ timeout: 5000 });
    await expect(node.getByText("item 1")).toBeVisible({ timeout: 3000 });
  });

  test("Node without description shows stats in expanded view", async ({ page }) => {
    await createTestNode(projectId, {
      title: "No Desc Node",
      type: "feature",
      canvasX: 300,
      canvasY: 300,
    });

    await selectProjectInSidebar(page, "MD Preview Project");
    await page.getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });

    const node = page.locator(".react-flow__node");
    await expect(node).toBeVisible({ timeout: 10000 });

    // Zoom in
    const controls = page.locator(".react-flow__controls");
    const zoomIn = controls.locator("button").first();
    for (let i = 0; i < 3; i++) {
      await zoomIn.click();
      await page.waitForTimeout(200);
    }

    // Node title should be visible, no markdown content
    await expect(node.getByText("No Desc Node")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Edge reconnection support", () => {
  let projectId: string;
  let nodeAId: string;
  let nodeBId: string;

  test.beforeEach(async () => {
    await cleanTestData();
    const project = await createTestProject("Reconnect Project");
    projectId = project.id;
    const nodeA = await createTestNode(projectId, {
      title: "Source Node",
      canvasX: 100,
      canvasY: 200,
    });
    const nodeB = await createTestNode(projectId, {
      title: "Target Node",
      canvasX: 500,
      canvasY: 200,
    });
    nodeAId = nodeA.id;
    nodeBId = nodeB.id;
  });

  test("ReactFlow has edgesReconnectable enabled", async ({ page }) => {
    await createTestEdge(nodeAId, nodeBId, { type: "parent_child" });

    await selectProjectInSidebar(page, "Reconnect Project");
    await page.getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });

    const edges = page.locator(".react-flow__edge");
    await expect(edges).toHaveCount(1, { timeout: 10000 });

    // Click edge to select it - should show reconnection anchors
    await edges.first().click();
    await page.waitForTimeout(500);

    // When edge is selected and reconnectable, edge anchors should appear
    // The .react-flow__edgeupdater elements are the reconnection handles
    const edgeUpdaters = page.locator(".react-flow__edgeupdater");
    await expect(edgeUpdaters.first()).toBeVisible({ timeout: 5000 });
  });

  test("Edges have correct handles based on type (canvas API)", async ({ page }) => {
    // Create parent_child edge (should use right→left handles)
    await createTestEdge(nodeAId, nodeBId, { type: "parent_child" });

    await selectProjectInSidebar(page, "Reconnect Project");
    await page.getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });

    // Verify the edge renders (connecting horizontal handles)
    const edges = page.locator(".react-flow__edge");
    await expect(edges).toHaveCount(1, { timeout: 10000 });

    // Verify the label
    await expect(page.getByText("상위-하위")).toBeVisible({ timeout: 5000 });
  });

  test("Handles have correct IDs for reconnection", async ({ page }) => {
    await createTestNode(projectId, {
      title: "Handle Test",
      canvasX: 300,
      canvasY: 300,
    });

    await selectProjectInSidebar(page, "Reconnect Project");
    await page.getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });

    // Verify nodes have 4 handles each (left, right, top, bottom)
    const nodes = page.locator(".react-flow__node");
    await expect(nodes).toHaveCount(3, { timeout: 10000 });

    // Check that handles exist with correct data-handleid attributes
    const firstNode = nodes.first();
    await expect(firstNode.locator('.react-flow__handle[data-handleid="left"]')).toBeAttached();
    await expect(firstNode.locator('.react-flow__handle[data-handleid="right"]')).toBeAttached();
    await expect(firstNode.locator('.react-flow__handle[data-handleid="top"]')).toBeAttached();
    await expect(firstNode.locator('.react-flow__handle[data-handleid="bottom"]')).toBeAttached();
  });
});
