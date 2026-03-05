import { test, expect } from "@playwright/test";
import {
  cleanTestData,
  createTestProject,
  createTestNode,
  createTestSession,
  createTestEdge,
} from "./helpers";

const API = "http://localhost:3333/api";

test.describe("API: Validation & Edge Cases", () => {
  let projectId: string;
  let nodeId: string;

  test.beforeEach(async () => {
    await cleanTestData();
    const project = await createTestProject();
    projectId = project.id;
    const node = await createTestNode(projectId);
    nodeId = node.id;
  });

  // 1. Edge duplicate prevention
  test("POST /api/edges rejects duplicate edge", async () => {
    const nodeB = await createTestNode(projectId, {
      title: "Node B",
      canvasX: 200,
      canvasY: 0,
    });
    await createTestEdge(nodeId, nodeB.id);
    const res = await fetch(`${API}/edges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromNodeId: nodeId, toNodeId: nodeB.id }),
    });
    expect(res.status).toBe(409);
  });

  // 2. Edge cross-project prevention
  test("POST /api/edges rejects cross-project edge", async () => {
    const project2 = await createTestProject(
      "Project 2",
      "project-2-" + Date.now(),
    );
    const nodeC = await createTestNode(project2.id, { title: "Node C" });
    const res = await fetch(`${API}/edges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromNodeId: nodeId, toNodeId: nodeC.id }),
    });
    expect(res.status).toBe(400);
  });

  // 3. Session resume restores node to in_progress
  test("Session resume restores node to in_progress", async () => {
    const session = await createTestSession(nodeId);
    // End as not completed (node goes to todo)
    await fetch(`${API}/sessions/${session.id}/end`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: false }),
    });
    // Verify node is todo
    let nodeRes = await fetch(`${API}/nodes/${nodeId}`);
    expect((await nodeRes.json()).data.status).toBe("todo");

    // Resume
    await fetch(`${API}/sessions/${session.id}/resume`, { method: "POST" });
    // Verify node is in_progress
    nodeRes = await fetch(`${API}/nodes/${nodeId}`);
    expect((await nodeRes.json()).data.status).toBe("in_progress");
  });

  // 4. Session end duration accumulation
  test("Session end accumulates duration across resume cycles", async () => {
    const session = await createTestSession(nodeId);
    // Wait a bit then end
    await new Promise((r) => setTimeout(r, 1000));
    await fetch(`${API}/sessions/${session.id}/end`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: false }),
    });
    // Get duration after first end
    let sessionRes = await fetch(`${API}/sessions/${session.id}`);
    const d1 = (await sessionRes.json()).data.durationSeconds;
    expect(d1).toBeGreaterThanOrEqual(0);

    // Resume and wait then end again
    await fetch(`${API}/sessions/${session.id}/resume`, { method: "POST" });
    await new Promise((r) => setTimeout(r, 1000));
    await fetch(`${API}/sessions/${session.id}/end`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    // Duration should be accumulated (>= d1)
    sessionRes = await fetch(`${API}/sessions/${session.id}`);
    const d2 = (await sessionRes.json()).data.durationSeconds;
    expect(d2).toBeGreaterThanOrEqual(d1);
  });

  // 5. Decision sessionId validation - nonexistent
  test("POST /api/decisions rejects invalid sessionId", async () => {
    const res = await fetch(`${API}/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodeId,
        content: "Test",
        sessionId: "nonexistent-id",
      }),
    });
    expect(res.status).toBe(400);
  });

  // 6. Decision sessionId node mismatch
  test("POST /api/decisions rejects session from different node", async () => {
    const nodeB = await createTestNode(projectId, { title: "Node B" });
    const session = await createTestSession(nodeB.id);
    const res = await fetch(`${API}/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodeId,
        content: "Test",
        sessionId: session.id,
      }),
    });
    expect(res.status).toBe(400);
  });

  // 7. Node status invalid transition
  test("PUT /api/nodes/:id/status rejects invalid transition", async () => {
    // Set node to archived first
    await fetch(`${API}/nodes/${nodeId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived", triggerType: "user_manual" }),
    });
    // Try archived -> in_progress (should fail)
    const res = await fetch(`${API}/nodes/${nodeId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "in_progress",
        triggerType: "user_manual",
      }),
    });
    expect(res.status).toBe(400);
  });

  // 8. Node status same-status transition rejection
  test("PUT /api/nodes/:id/status rejects same status transition", async () => {
    const res = await fetch(`${API}/nodes/${nodeId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "backlog", triggerType: "user_manual" }),
    });
    expect(res.status).toBe(400);
  });

  // 9. Malformed JSON body - projects
  test("POST /api/projects rejects malformed JSON body", async () => {
    const res = await fetch(`${API}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });
    expect(res.status).toBe(400);
  });

  // 10. Malformed JSON body - edges
  test("PUT /api/edges/:id rejects malformed JSON body", async () => {
    const nodeB = await createTestNode(projectId, {
      title: "Node B",
      canvasX: 200,
      canvasY: 0,
    });
    const edge = await createTestEdge(nodeId, nodeB.id);
    const res = await fetch(`${API}/edges/${edge.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "invalid json",
    });
    expect(res.status).toBe(400);
  });
});
