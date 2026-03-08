import { test, expect } from "@playwright/test";
import {
  cleanTestData,
  createTestProject,
  createTestNode,
  selectProjectInSidebar,
} from "./helpers";

const API = "http://localhost:3333/api";

/**
 * Helper: dispatch handle-double-click custom event.
 * ReactFlow intercepts mousedown on source handles to start connection drag,
 * which prevents native dblclick from firing on right handles.
 * Bottom handles work with native dblclick, but for consistency we use
 * evaluate for right handles and native dblclick for bottom handles.
 */
async function triggerHandleDoubleClick(
  page: import("@playwright/test").Page,
  nodeLocator: import("@playwright/test").Locator,
  handlePosition: "right" | "bottom",
) {
  if (handlePosition === "bottom") {
    const overlay = nodeLocator.locator(
      '[data-testid="handle-overlay-bottom"]',
    );
    await expect(overlay).toBeVisible({ timeout: 5000 });
    await overlay.dblclick();
  } else {
    const nodeId = await nodeLocator.getAttribute("data-id");
    await page.evaluate(
      ({ id, pos }) => {
        window.dispatchEvent(
          new CustomEvent("handle-double-click", {
            detail: { nodeId: id, handlePosition: pos },
          }),
        );
      },
      { id: nodeId, pos: handlePosition },
    );
  }
}

test.describe("UI: Handle double-click creates connected node", () => {
  let projectId: string;

  test.beforeEach(async ({ page }) => {
    await cleanTestData();
    const project = await createTestProject("Handle DblClick Test");
    projectId = project.id;

    await createTestNode(projectId, {
      title: "Source Node",
      type: "feature",
      canvasX: 300,
      canvasY: 300,
    });

    await selectProjectInSidebar(page, "Handle DblClick Test");
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "캔버스" })
      .click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".react-flow__node")).toHaveCount(1, {
      timeout: 10000,
    });
  });

  test("Double-click right handle creates node with parent_child edge", async ({
    page,
  }) => {
    const node = page.locator(".react-flow__node").first();
    await triggerHandleDoubleClick(page, node, "right");

    await expect(page.locator(".react-flow__node")).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(page.locator(".react-flow__edge")).toHaveCount(1, {
      timeout: 5000,
    });

    // Verify edge type via API
    const res = await fetch(`${API}/projects/${projectId}/canvas`);
    const json = await res.json();
    expect(json.data.edges).toHaveLength(1);
    expect(json.data.edges[0].type).toBe("parent_child");
  });

  test("Double-click bottom handle creates node with related edge", async ({
    page,
  }) => {
    const node = page.locator(".react-flow__node").first();
    await triggerHandleDoubleClick(page, node, "bottom");

    await expect(page.locator(".react-flow__node")).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(page.locator(".react-flow__edge")).toHaveCount(1, {
      timeout: 5000,
    });

    // Verify edge type via API
    const res = await fetch(`${API}/projects/${projectId}/canvas`);
    const json = await res.json();
    expect(json.data.edges).toHaveLength(1);
    expect(json.data.edges[0].type).toBe("related");
  });

  test("New node inherits source node type (feature→feature)", async ({
    page,
  }) => {
    // The beforeEach created a feature source node
    // Double-click bottom handle (uses native dblclick, reads source type from canvas)
    const node = page.locator(".react-flow__node").first();
    await triggerHandleDoubleClick(page, node, "bottom");

    await expect(page.locator(".react-flow__node")).toHaveCount(2, {
      timeout: 10000,
    });

    // Verify new node inherited 'feature' type from source
    const res = await fetch(`${API}/projects/${projectId}/canvas`);
    const json = await res.json();
    const nodes = json.data.nodes;
    expect(nodes).toHaveLength(2);
    expect(nodes.every((n: { type: string }) => n.type === "feature")).toBe(
      true,
    );
  });

  test("Multiple double-clicks offset nodes vertically (no stacking)", async ({
    page,
  }) => {
    const node = page.locator(".react-flow__node").first();

    // Create first child
    await triggerHandleDoubleClick(page, node, "right");
    await expect(page.locator(".react-flow__node")).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(page.locator(".react-flow__edge")).toHaveCount(1, {
      timeout: 5000,
    });

    // Create second child
    await triggerHandleDoubleClick(page, node, "right");
    await expect(page.locator(".react-flow__node")).toHaveCount(3, {
      timeout: 10000,
    });

    // Verify children have different Y positions
    const res = await fetch(`${API}/projects/${projectId}/canvas`);
    const json = await res.json();
    const children = json.data.nodes.filter(
      (n: { title: string }) => n.title !== "Source Node",
    );
    expect(children).toHaveLength(2);
    expect(children[0].canvasY).not.toBe(children[1].canvasY);
  });
});
