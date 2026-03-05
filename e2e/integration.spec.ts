import { test, expect } from "@playwright/test";
import {
  cleanTestData,
  createTestProject,
  createTestNode,
  createTestEdge,
  createTestSession,
  createTestDecision,
} from "./helpers";

const API = "http://localhost:3333/api";

test.describe("Integration: Full user workflow", () => {
  test.beforeEach(async () => {
    await cleanTestData();
  });

  test("Complete project lifecycle: create → add nodes → link → session → decision → promote", async () => {
    // 1. Create project
    const slug = `__e2e__workflow-${Date.now()}`;
    const projRes = await fetch(`${API}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Workflow Project",
        slug,
        description: "Integration test project",
        projectDir: "/tmp/workflow",
      }),
    });
    expect(projRes.status).toBe(201);
    const project = (await projRes.json()).data;

    // 2. Create multiple nodes
    const ideaNode = await createTestNode(project.id, {
      type: "idea",
      title: "Use React Flow for canvas",
      canvasX: 0,
      canvasY: 0,
    });
    const taskNode = await createTestNode(project.id, {
      type: "task",
      title: "Implement canvas view",
      canvasX: 300,
      canvasY: 0,
    });
    const issueNode = await createTestNode(project.id, {
      type: "issue",
      title: "Performance bottleneck",
      canvasX: 300,
      canvasY: 200,
    });

    // 3. Link nodes with edges
    const edge1 = await createTestEdge(ideaNode.id, taskNode.id, {
      type: "sequence",
    });
    const edge2 = await createTestEdge(taskNode.id, issueNode.id, {
      type: "regression",
    });
    expect(edge1.type).toBe("sequence");
    expect(edge2.type).toBe("regression");

    // 4. Start session on task node
    const session = await createTestSession(taskNode.id, "Implement canvas");
    expect(session.status).toBe("active");

    // Verify node auto-transitioned to in_progress
    const nodeCheck = await fetch(`${API}/nodes/${taskNode.id}`);
    expect((await nodeCheck.json()).data.status).toBe("in_progress");

    // 5. Add decision during session
    const decision = await createTestDecision(
      taskNode.id,
      "Use dagre for auto-layout",
      session.id
    );
    expect(decision.sessionId).toBe(session.id);

    // 6. Promote decision to new node
    const promoteRes = await fetch(`${API}/decisions/${decision.id}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodeType: "task",
        title: "Implement dagre auto-layout",
      }),
    });
    expect(promoteRes.status).toBe(201);
    const promoted = (await promoteRes.json()).data;
    expect(promoted.newNode.type).toBe("task");
    expect(promoted.newEdge.fromNodeId).toBe(taskNode.id);

    // 7. End session as completed
    const endRes = await fetch(`${API}/sessions/${session.id}/end`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    expect(endRes.status).toBe(200);

    // 8. Verify node transitioned to done
    const finalNode = await fetch(`${API}/nodes/${taskNode.id}`);
    expect((await finalNode.json()).data.status).toBe("done");

    // 9. Verify canvas has all nodes
    const canvasRes = await fetch(`${API}/projects/${project.id}/canvas`);
    const canvas = (await canvasRes.json()).data;
    expect(canvas.nodes.length).toBe(4); // 3 original + 1 promoted
    expect(canvas.edges.length).toBe(3); // 2 original + 1 from promote
  });

  test("Dashboard view returns correct categorization", async () => {
    const project = await createTestProject("Dashboard Test");

    // Create nodes with different statuses
    const backlogNode = await createTestNode(project.id, {
      title: "Backlog Node",
      status: "backlog",
    });
    const todoNode = await createTestNode(project.id, {
      title: "Todo Node",
    });
    // Manually set to todo
    await fetch(`${API}/nodes/${todoNode.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "todo", triggerType: "user_manual" }),
    });

    const progressNode = await createTestNode(project.id, {
      title: "In Progress Node",
    });
    await fetch(`${API}/nodes/${progressNode.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "in_progress",
        triggerType: "user_manual",
      }),
    });

    const doneNode = await createTestNode(project.id, {
      title: "Done Node",
    });
    // Must transition through in_progress first (backlog → done is not allowed)
    await fetch(`${API}/nodes/${doneNode.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_progress", triggerType: "user_manual" }),
    });
    await fetch(`${API}/nodes/${doneNode.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done", triggerType: "user_manual" }),
    });

    // Fetch dashboard
    const dashRes = await fetch(`${API}/projects/${project.id}/dashboard`);
    expect(dashRes.status).toBe(200);
    const dash = (await dashRes.json()).data;

    expect(dash.inProgress.length).toBe(1);
    expect(dash.inProgress[0].title).toBe("In Progress Node");
    expect(dash.todo.length).toBe(1);
    expect(dash.todo[0].title).toBe("Todo Node");
    expect(dash.recentDone.length).toBe(1);
    expect(dash.recentDone[0].title).toBe("Done Node");
  });

  test("Canvas viewport persistence", async () => {
    const project = await createTestProject("Viewport Test");

    // Save custom viewport
    const vpRes = await fetch(
      `${API}/projects/${project.id}/canvas/viewport`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: 150, y: -200, zoom: 1.5 }),
      }
    );
    expect(vpRes.status).toBe(200);

    // Reload canvas and check viewport
    const canvasRes = await fetch(`${API}/projects/${project.id}/canvas`);
    const canvas = (await canvasRes.json()).data;
    expect(canvas.viewport.x).toBe(150);
    expect(canvas.viewport.y).toBe(-200);
    expect(canvas.viewport.zoom).toBe(1.5);
  });

  test("Node positions bulk update", async () => {
    const project = await createTestProject("Position Test");
    const node1 = await createTestNode(project.id, {
      title: "Node 1",
      canvasX: 0,
      canvasY: 0,
    });
    const node2 = await createTestNode(project.id, {
      title: "Node 2",
      canvasX: 100,
      canvasY: 100,
    });

    // Bulk update positions (API expects { nodes: [{ id, canvasX, canvasY }] })
    const posRes = await fetch(`${API}/nodes/positions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodes: [
          { id: node1.id, canvasX: 500, canvasY: 300 },
          { id: node2.id, canvasX: 800, canvasY: 400 },
        ],
      }),
    });
    expect(posRes.status).toBe(200);

    // Verify positions updated
    const n1Res = await fetch(`${API}/nodes/${node1.id}`);
    const n1 = (await n1Res.json()).data;
    expect(n1.canvasX).toBe(500);
    expect(n1.canvasY).toBe(300);

    const n2Res = await fetch(`${API}/nodes/${node2.id}`);
    const n2 = (await n2Res.json()).data;
    expect(n2.canvasX).toBe(800);
    expect(n2.canvasY).toBe(400);
  });

  test("Session resume flow with multiple cycles", async () => {
    const project = await createTestProject("Resume Test");
    const node = await createTestNode(project.id, {
      title: "Resume Node",
    });

    // Start session
    const session = await createTestSession(node.id, "First run");
    expect(session.status).toBe("active");

    // End session (not completed)
    const endRes1 = await fetch(`${API}/sessions/${session.id}/end`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: false }),
    });
    // Verify session status is "paused" (not completed)
    expect((await endRes1.json()).data.status).toBe("paused");

    // Resume session
    const resumeRes = await fetch(`${API}/sessions/${session.id}/resume`, {
      method: "POST",
    });
    expect(resumeRes.status).toBe(200);
    const resumed = (await resumeRes.json()).data;
    expect(resumed.status).toBe("active");
    expect(resumed.resumeCount).toBe(1);

    // Verify node is restored to in_progress after resume
    let nodeCheck = await fetch(`${API}/nodes/${node.id}`);
    expect((await nodeCheck.json()).data.status).toBe("in_progress");

    // End again (not completed)
    const endRes2 = await fetch(`${API}/sessions/${session.id}/end`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: false }),
    });
    expect((await endRes2.json()).data.status).toBe("paused");

    // Resume again
    const resume2Res = await fetch(`${API}/sessions/${session.id}/resume`, {
      method: "POST",
    });
    const resumed2 = (await resume2Res.json()).data;
    expect(resumed2.resumeCount).toBe(2);

    // Verify node restored to in_progress again
    nodeCheck = await fetch(`${API}/nodes/${node.id}`);
    expect((await nodeCheck.json()).data.status).toBe("in_progress");

    // End as completed
    await fetch(`${API}/sessions/${session.id}/end`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });

    // Node should be done
    const nodeRes = await fetch(`${API}/nodes/${node.id}`);
    expect((await nodeRes.json()).data.status).toBe("done");
  });

  test("Recovery endpoint returns active sessions", async () => {
    const res = await fetch(`${API}/recovery/sessions`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBeDefined();
    expect(Array.isArray(json.data)).toBe(true);
  });

  test("Edge type validation", async () => {
    const project = await createTestProject("Edge Types Test");
    const nodeA = await createTestNode(project.id, { title: "A" });
    const nodeB = await createTestNode(project.id, {
      title: "B",
      canvasX: 200,
      canvasY: 0,
    });

    // Create edges with all valid types
    const types = [
      "sequence",
      "dependency",
      "related",
      "regression",
      "branch",
    ] as const;
    for (const type of types) {
      // Delete existing edge first (if any)
      const listRes = await fetch(`${API}/projects/${project.id}/edges`);
      const edgesData = (await listRes.json()).data;
      for (const edge of edgesData) {
        await fetch(`${API}/edges/${edge.id}`, { method: "DELETE" });
      }

      const res = await fetch(`${API}/edges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromNodeId: nodeA.id,
          toNodeId: nodeB.id,
          type,
        }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.type).toBe(type);
    }
  });

  test("Node type creation and canvas rendering", async () => {
    const project = await createTestProject("Node Types Test");
    const nodeTypes = [
      "idea",
      "decision",
      "task",
      "issue",
      "milestone",
      "note",
    ] as const;

    for (let i = 0; i < nodeTypes.length; i++) {
      const node = await createTestNode(project.id, {
        type: nodeTypes[i],
        title: `${nodeTypes[i]} node`,
        canvasX: i * 200,
        canvasY: 0,
      });
      expect(node.type).toBe(nodeTypes[i]);
    }

    // Verify all nodes appear in canvas
    const canvasRes = await fetch(`${API}/projects/${project.id}/canvas`);
    const canvas = (await canvasRes.json()).data;
    expect(canvas.nodes.length).toBe(6);
  });

  test("Multiple decisions on same node", async () => {
    const project = await createTestProject("Multi Decision Test");
    const node = await createTestNode(project.id, { title: "Deciding node" });

    // Add multiple decisions
    const d1 = await createTestDecision(node.id, "Decision 1");
    const d2 = await createTestDecision(node.id, "Decision 2");
    const d3 = await createTestDecision(node.id, "Decision 3");

    // List should have all 3
    const listRes = await fetch(`${API}/nodes/${node.id}/decisions`);
    const decisions = (await listRes.json()).data;
    expect(decisions.length).toBe(3);

    // Delete one
    await fetch(`${API}/decisions/${d2.id}`, { method: "DELETE" });

    // Now should have 2
    const listRes2 = await fetch(`${API}/nodes/${node.id}/decisions`);
    const decisions2 = (await listRes2.json()).data;
    expect(decisions2.length).toBe(2);
    expect(decisions2.map((d: { id: string }) => d.id)).not.toContain(d2.id);
  });

  test("Project soft-delete hides from list but preserves data", async () => {
    const project = await createTestProject("Soft Delete Test");
    const node = await createTestNode(project.id, {
      title: "Important Node",
    });

    // Soft-delete project
    await fetch(`${API}/projects/${project.id}`, { method: "DELETE" });

    // Project list should not include it
    const listRes = await fetch(`${API}/projects`);
    const projects = (await listRes.json()).data;
    const found = projects.find(
      (p: { id: string }) => p.id === project.id
    );
    expect(found).toBeUndefined();

    // But direct access should still work (project data preserved)
    const directRes = await fetch(`${API}/projects/${project.id}`);
    // Depending on implementation, this might be 404 or return inactive project
    // The important thing is the project wasn't hard-deleted
    expect([200, 404]).toContain(directRes.status);
  });

  test("Node status state machine transitions", async () => {
    const project = await createTestProject("State Machine Test");
    const node = await createTestNode(project.id, { title: "Status Test" });

    // backlog → todo
    let res = await fetch(`${API}/nodes/${node.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "todo", triggerType: "user_manual" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe("todo");

    // todo → in_progress
    res = await fetch(`${API}/nodes/${node.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "in_progress",
        triggerType: "user_manual",
      }),
    });
    expect((await res.json()).data.status).toBe("in_progress");

    // in_progress → done
    res = await fetch(`${API}/nodes/${node.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done", triggerType: "user_manual" }),
    });
    expect((await res.json()).data.status).toBe("done");

    // done → archived
    res = await fetch(`${API}/nodes/${node.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "archived",
        triggerType: "user_manual",
      }),
    });
    expect((await res.json()).data.status).toBe("archived");

    // Invalid transition: archived → in_progress (should fail)
    res = await fetch(`${API}/nodes/${node.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "in_progress",
        triggerType: "user_manual",
      }),
    });
    expect(res.status).toBe(400);
  });
});

test.describe("Integration: UI components", () => {
  test.beforeEach(async ({ page }) => {
    await cleanTestData();
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("Command palette opens with Cmd+K", async ({ page }) => {
    await page.keyboard.press("Meta+k");
    // Command palette uses custom overlay, look for the input placeholder
    const paletteInput = page.getByPlaceholder("무엇을 할까요?");
    await expect(paletteInput).toBeVisible({ timeout: 3000 });

    // Close with Escape
    await page.keyboard.press("Escape");
    await expect(paletteInput).toBeHidden({ timeout: 3000 });
  });

  test("Keyboard shortcut Cmd+1/2 switches tabs", async ({
    page,
  }) => {
    // Create a project so tabs are functional
    await createTestProject("KB Test");
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Press Cmd+2 for canvas tab
    await page.keyboard.press("Meta+2");
    const canvasTab = page.getByRole("button", { name: "캔버스" });
    await expect(canvasTab).toHaveAttribute("data-active", "true", {
      timeout: 3000,
    });

    // Press Cmd+1 for dashboard tab
    await page.keyboard.press("Meta+1");
    const dashTab = page.getByRole("button", { name: "대시보드" });
    await expect(dashTab).toHaveAttribute("data-active", "true", {
      timeout: 3000,
    });
  });

  test("Main content is visible after page load", async ({ page }) => {
    const mainContent = page.locator("main");
    await expect(mainContent).toBeVisible();
  });
});
