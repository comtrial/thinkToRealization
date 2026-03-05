import { test, expect } from "@playwright/test";
import {
  cleanTestData,
  createTestProject,
  createTestNode,
  createTestDecision,
} from "./helpers";

const API = "http://localhost:3333/api";

test.describe("API: Decisions CRUD", () => {
  let projectId: string;
  let nodeId: string;

  test.beforeEach(async () => {
    await cleanTestData();
    const project = await createTestProject();
    projectId = project.id;
    const node = await createTestNode(projectId);
    nodeId = node.id;
  });

  test("POST /api/decisions creates decision", async () => {
    const res = await fetch(`${API}/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId, content: "Use PostgreSQL instead of MySQL" }),
    });
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.data.content).toBe("Use PostgreSQL instead of MySQL");
    expect(json.data.nodeId).toBe(nodeId);
  });

  test("GET /api/nodes/:id/decisions returns decisions", async () => {
    await createTestDecision(nodeId, "Decision A");
    await createTestDecision(nodeId, "Decision B");
    const res = await fetch(`${API}/nodes/${nodeId}/decisions`);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.length).toBe(2);
  });

  test("POST /api/decisions/:id/promote promotes to node", async () => {
    const decision = await createTestDecision(nodeId, "Should become a task");
    const res = await fetch(`${API}/decisions/${decision.id}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeType: "task", title: "Promoted Task" }),
    });
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.data.newNode.title).toBe("Promoted Task");
    expect(json.data.newNode.type).toBe("task");
    expect(json.data.newEdge.fromNodeId).toBe(nodeId);
    expect(json.data.newEdge.toNodeId).toBe(json.data.newNode.id);
    expect(json.data.decision.promotedToNodeId).toBe(json.data.newNode.id);
  });

  test("DELETE /api/decisions/:id deletes decision", async () => {
    const decision = await createTestDecision(nodeId, "To be deleted");
    const delRes = await fetch(`${API}/decisions/${decision.id}`, { method: "DELETE" });
    expect(delRes.status).toBe(200);

    // Verify decision is gone
    const listRes = await fetch(`${API}/nodes/${nodeId}/decisions`);
    const listJson = await listRes.json();
    expect(listJson.data.length).toBe(0);
  });

  test("DELETE /api/decisions/:id returns 404 for non-existent", async () => {
    const res = await fetch(`${API}/decisions/nonexistent-id`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});
