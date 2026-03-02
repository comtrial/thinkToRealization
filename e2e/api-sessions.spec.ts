import { test, expect } from "@playwright/test";
import {
  cleanDatabase,
  createTestProject,
  createTestNode,
  createTestSession,
} from "./helpers";

const API = "http://localhost:3333/api";

test.describe("API: Sessions lifecycle", () => {
  let projectId: string;
  let nodeId: string;

  test.beforeEach(async () => {
    await cleanDatabase();
    const project = await createTestProject();
    projectId = project.id;
    const node = await createTestNode(projectId);
    nodeId = node.id;
  });

  test("POST /api/nodes/:id/sessions creates session", async () => {
    const res = await fetch(`${API}/nodes/${nodeId}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Work Session" }),
    });
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.data.nodeId).toBe(nodeId);
    expect(json.data.status).toBe("active");
    expect(json.data.title).toBe("Work Session");
  });

  test("Creating session auto-transitions node to in_progress", async () => {
    await createTestSession(nodeId, "Auto-transition test");
    const nodeRes = await fetch(`${API}/nodes/${nodeId}`);
    const nodeJson = await nodeRes.json();
    expect(nodeJson.data.status).toBe("in_progress");
  });

  test("GET /api/sessions/:id returns session with details", async () => {
    const session = await createTestSession(nodeId);
    const res = await fetch(`${API}/sessions/${session.id}`);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.id).toBe(session.id);
    expect(json.data.files).toBeDefined();
    expect(json.data.decisions).toBeDefined();
  });

  test("PUT /api/sessions/:id/end ends session", async () => {
    const session = await createTestSession(nodeId);
    const res = await fetch(`${API}/sessions/${session.id}/end`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: false }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.status).toBe("paused");
    expect(json.data.endedAt).toBeTruthy();
    expect(json.data.durationSeconds).toBeGreaterThanOrEqual(0);
  });

  test("PUT /api/sessions/:id/end with completed=true transitions node to done", async () => {
    const session = await createTestSession(nodeId);
    await fetch(`${API}/sessions/${session.id}/end`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    const nodeRes = await fetch(`${API}/nodes/${nodeId}`);
    const nodeJson = await nodeRes.json();
    expect(nodeJson.data.status).toBe("done");
  });

  test("POST /api/sessions/:id/resume resumes session", async () => {
    const session = await createTestSession(nodeId);
    // End the session first
    await fetch(`${API}/sessions/${session.id}/end`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: false }),
    });
    // Resume it
    const res = await fetch(`${API}/sessions/${session.id}/resume`, {
      method: "POST",
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.status).toBe("active");
    expect(json.data.resumeCount).toBe(1);

    // Verify node is restored to in_progress after resume
    const nodeRes = await fetch(`${API}/nodes/${nodeId}`);
    const nodeJson = await nodeRes.json();
    expect(nodeJson.data.status).toBe("in_progress");
  });

  test("Cannot create second active session on same node", async () => {
    await createTestSession(nodeId);
    const res = await fetch(`${API}/nodes/${nodeId}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(409);
  });
});
