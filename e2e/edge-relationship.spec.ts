import { test, expect } from "@playwright/test";
import {
  cleanTestData,
  createTestProject,
  createTestNode,
  createTestEdge,
  selectProjectInSidebar,
} from "./helpers";

const API = "http://localhost:3333/api";

test.describe("Edge relationship & canvas features", () => {
  let projectId: string;
  let nodeAId: string;
  let nodeBId: string;
  let nodeCId: string;

  test.beforeAll(async () => {
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

  test("POST creates parent_child edge", async () => {
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
    await fetch(`${API}/edges/${json.data.id}`, { method: "DELETE" });
  });

  test("POST creates related edge", async () => {
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
    await fetch(`${API}/edges/${json.data.id}`, { method: "DELETE" });
  });

  test("PUT updates edge type to parent_child", async () => {
    const edge = await createTestEdge(nodeAId, nodeBId, { type: "related" });
    const res = await fetch(`${API}/edges/${edge.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "parent_child" }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.type).toBe("parent_child");
    await fetch(`${API}/edges/${edge.id}`, { method: "DELETE" });
  });

  test("PUT updates edge type to related", async () => {
    const edge = await createTestEdge(nodeAId, nodeBId, { type: "parent_child" });
    const res = await fetch(`${API}/edges/${edge.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "related" }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.type).toBe("related");
    await fetch(`${API}/edges/${edge.id}`, { method: "DELETE" });
  });

  test("Edge reconnection: delete old + create new type", async () => {
    const edge = await createTestEdge(nodeAId, nodeBId, { type: "parent_child" });
    const delRes = await fetch(`${API}/edges/${edge.id}`, { method: "DELETE" });
    expect(delRes.status).toBe(200);

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
    await fetch(`${API}/edges/${json.data.id}`, { method: "DELETE" });
  });

  // ── UI Tests ──

  test("Canvas renders parent_child edge with label", async ({ page }) => {
    const edge = await createTestEdge(nodeAId, nodeBId, { type: "parent_child" });

    await selectProjectInSidebar(page, "Edge Rel Project");
    await page.getByRole("navigation").getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });

    await expect(page.locator(".react-flow__edge")).toHaveCount(1, { timeout: 10000 });
    await expect(page.getByText("상위-하위")).toBeVisible({ timeout: 5000 });

    await fetch(`${API}/edges/${edge.id}`, { method: "DELETE" });
  });

  test("Canvas renders related edge with label", async ({ page }) => {
    const edge = await createTestEdge(nodeAId, nodeCId, { type: "related" });

    await selectProjectInSidebar(page, "Edge Rel Project");
    await page.getByRole("navigation").getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });

    await expect(page.locator(".react-flow__edge")).toHaveCount(1, { timeout: 10000 });
    await expect(page.getByText("연관")).toBeVisible({ timeout: 5000 });

    await fetch(`${API}/edges/${edge.id}`, { method: "DELETE" });
  });

  test("Node with description shows markdown preview", async ({ page }) => {
    const mdNode = await createTestNode(projectId, {
      title: "MD Preview Node",
      type: "feature",
      description: "## Heading\n\n- item 1\n- item 2\n\n**Bold text**",
      canvasX: 300,
      canvasY: 300,
    });

    await selectProjectInSidebar(page, "Edge Rel Project");
    await page.getByRole("navigation").getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });

    // Zoom in for expanded view (zoom > 0.8)
    const controls = page.locator(".react-flow__controls");
    const zoomIn = controls.locator("button").first();
    for (let i = 0; i < 3; i++) {
      await zoomIn.click();
      await page.waitForTimeout(200);
    }

    const node = page.locator(`.react-flow__node[data-id="${mdNode.id}"]`);
    await expect(node.getByText("Heading")).toBeVisible({ timeout: 5000 });
    await expect(node.getByText("item 1")).toBeVisible({ timeout: 3000 });
  });

  test("Handles exist on nodes (4 per node)", async ({ page }) => {
    await selectProjectInSidebar(page, "Edge Rel Project");
    await page.getByRole("navigation").getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });

    const firstNode = page.locator(".react-flow__node").first();
    await expect(firstNode).toBeVisible({ timeout: 10000 });

    // Each node should have 4 handles (2 source + 2 target)
    const handles = firstNode.locator(".react-flow__handle");
    await expect(handles).toHaveCount(4, { timeout: 5000 });
  });

  test("edgesReconnectable: edge updater anchors appear", async ({ page }) => {
    const edge = await createTestEdge(nodeAId, nodeBId, { type: "parent_child" });

    await selectProjectInSidebar(page, "Edge Rel Project");
    await page.getByRole("navigation").getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".react-flow__edge")).toHaveCount(1, { timeout: 10000 });

    // Click on the edge path area to select it
    const edgePath = page.locator(".react-flow__edge path.react-flow__edge-path").first();
    await edgePath.click({ force: true });
    await page.waitForTimeout(500);

    // When edgesReconnectable is enabled, selecting an edge shows updater circles
    const edgeUpdaters = page.locator(".react-flow__edgeupdater");
    await expect(edgeUpdaters.first()).toBeVisible({ timeout: 5000 });

    await fetch(`${API}/edges/${edge.id}`, { method: "DELETE" });
  });
});
