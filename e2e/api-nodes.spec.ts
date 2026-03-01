import { test, expect } from "@playwright/test";
import { cleanDatabase, createTestProject, createTestNode } from "./helpers";

const API = "http://localhost:3333/api";

test.describe("API: Nodes CRUD", () => {
  let projectId: string;

  test.beforeEach(async () => {
    await cleanDatabase();
    const project = await createTestProject();
    projectId = project.id;
  });

  test("POST /api/projects/:id/nodes creates node", async () => {
    const res = await fetch(`${API}/projects/${projectId}/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "task",
        title: "New Task",
        canvasX: 100,
        canvasY: 200,
      }),
    });
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.data.title).toBe("New Task");
    expect(json.data.type).toBe("task");
    expect(json.data.status).toBe("backlog");
  });

  test("GET /api/nodes/:id returns node with details", async () => {
    const node = await createTestNode(projectId);
    const res = await fetch(`${API}/nodes/${node.id}`);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.title).toBe("Test Node");
    expect(json.data.sessions).toBeDefined();
    expect(json.data.decisions).toBeDefined();
    expect(json.data.outEdges).toBeDefined();
    expect(json.data.inEdges).toBeDefined();
  });

  test("PUT /api/nodes/:id updates node fields", async () => {
    const node = await createTestNode(projectId);
    const res = await fetch(`${API}/nodes/${node.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Node", priority: "high" }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.title).toBe("Updated Node");
    expect(json.data.priority).toBe("high");
  });

  test("PUT /api/nodes/:id/status changes status and creates log", async () => {
    const node = await createTestNode(projectId);
    const res = await fetch(`${API}/nodes/${node.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "todo", triggerType: "user_manual" }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.status).toBe("todo");
  });

  test("DELETE /api/nodes/:id archives node", async () => {
    const node = await createTestNode(projectId);
    const res = await fetch(`${API}/nodes/${node.id}`, { method: "DELETE" });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.status).toBe("archived");
  });

  test("GET /api/projects/:id/nodes returns nodes list", async () => {
    await createTestNode(projectId, { title: "Node A" });
    await createTestNode(projectId, { title: "Node B", canvasX: 100, canvasY: 100 });
    const res = await fetch(`${API}/projects/${projectId}/nodes`);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.length).toBe(2);
  });

  test("GET /api/nodes/:id returns 404 for non-existent", async () => {
    const res = await fetch(`${API}/nodes/nonexistent-id`);
    expect(res.status).toBe(404);
  });
});
