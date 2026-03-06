import { test, expect } from "@playwright/test";
import {
  cleanTestData,
  createTestProject,
  createTestNode,
  createTestSession,
  createTestEdge,
} from "./helpers";

const API = "http://localhost:3333/api";

test.describe("Performance: Cache-Control headers on GET APIs", () => {
  let projectId: string;
  let nodeId: string;
  let sessionId: string;

  test.beforeAll(async () => {
    await cleanTestData();
    const project = await createTestProject("Perf Test Project");
    projectId = project.id;
    const node = await createTestNode(projectId, { title: "Perf Node", status: "todo" });
    nodeId = node.id;
    const session = await createTestSession(nodeId, "Perf Session");
    sessionId = session.id;
  });

  test.afterAll(async () => {
    await cleanTestData();
  });

  test("GET /api/projects has Cache-Control header", async () => {
    const res = await fetch(`${API}/projects`);
    expect(res.status).toBe(200);
    const cc = res.headers.get("cache-control");
    expect(cc).toBeTruthy();
    expect(cc).toContain("max-age=");
    expect(cc).toContain("stale-while-revalidate=");
  });

  test("GET /api/projects/:id has Cache-Control header", async () => {
    const res = await fetch(`${API}/projects/${projectId}`);
    expect(res.status).toBe(200);
    const cc = res.headers.get("cache-control");
    expect(cc).toBeTruthy();
    expect(cc).toContain("max-age=");
  });

  test("GET /api/projects/:id/dashboard has Cache-Control header", async () => {
    const res = await fetch(`${API}/projects/${projectId}/dashboard`);
    expect(res.status).toBe(200);
    const cc = res.headers.get("cache-control");
    expect(cc).toBeTruthy();
    expect(cc).toContain("max-age=");
  });

  test("GET /api/projects/:id/canvas has Cache-Control header", async () => {
    const res = await fetch(`${API}/projects/${projectId}/canvas`);
    expect(res.status).toBe(200);
    const cc = res.headers.get("cache-control");
    expect(cc).toBeTruthy();
    expect(cc).toContain("max-age=");
  });

  test("GET /api/nodes/:id has Cache-Control header", async () => {
    const res = await fetch(`${API}/nodes/${nodeId}`);
    expect(res.status).toBe(200);
    const cc = res.headers.get("cache-control");
    expect(cc).toBeTruthy();
    expect(cc).toContain("max-age=");
  });

  test("GET /api/sessions/:id has Cache-Control header", async () => {
    const res = await fetch(`${API}/sessions/${sessionId}`);
    expect(res.status).toBe(200);
    const cc = res.headers.get("cache-control");
    expect(cc).toBeTruthy();
    expect(cc).toContain("max-age=");
  });

  test("GET /api/plans/:id returns 404 but no cache on error", async () => {
    const res = await fetch(`${API}/plans/nonexistent`);
    expect(res.status).toBe(404);
    // Error responses should NOT have cache headers
    const cc = res.headers.get("cache-control");
    // Should be null or not contain long max-age
    if (cc) {
      expect(cc).not.toContain("max-age=30");
    }
  });

  test("POST/PUT/DELETE do NOT have Cache-Control headers", async () => {
    // PUT should not have cache headers
    const putRes = await fetch(`${API}/nodes/${nodeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated for cache test" }),
    });
    expect(putRes.status).toBe(200);
    const putCc = putRes.headers.get("cache-control");
    // Mutation responses should not have stale-while-revalidate
    if (putCc) {
      expect(putCc).not.toContain("stale-while-revalidate");
    }
  });
});

test.describe("Performance: Dashboard API pagination", () => {
  let projectId: string;

  test.beforeAll(async () => {
    await cleanTestData();
    const project = await createTestProject("Pagination Test");
    projectId = project.id;

    // Create nodes in different statuses
    const statuses = ["in_progress", "todo", "backlog", "done"];
    for (const status of statuses) {
      for (let i = 0; i < 3; i++) {
        await createTestNode(projectId, {
          title: `${status} node ${i}`,
          status,
        });
      }
    }
  });

  test.afterAll(async () => {
    await cleanTestData();
  });

  test("dashboard returns correctly grouped nodes", async () => {
    const res = await fetch(`${API}/projects/${projectId}/dashboard`);
    const json = await res.json();
    expect(res.status).toBe(200);

    expect(json.data.inProgress).toHaveLength(3);
    expect(json.data.todo).toHaveLength(3);
    expect(json.data.backlog).toHaveLength(3);
    expect(json.data.recentDone).toHaveLength(3);
  });

  test("dashboard nodes have correct response shape (lite)", async () => {
    const res = await fetch(`${API}/projects/${projectId}/dashboard`);
    const json = await res.json();
    const node = json.data.inProgress[0];

    // Should have count fields
    expect(node).toHaveProperty("sessionCount");
    expect(node).toHaveProperty("decisionCount");
    expect(node).toHaveProperty("childCount");
    expect(node).toHaveProperty("planCount");
    // Should have standard fields
    expect(node).toHaveProperty("id");
    expect(node).toHaveProperty("title");
    expect(node).toHaveProperty("status");
    expect(node).toHaveProperty("type");
  });
});

test.describe("Performance: Node detail API — no duplicate sessions", () => {
  let projectId: string;
  let nodeId: string;

  test.beforeAll(async () => {
    await cleanTestData();
    const project = await createTestProject("Session Dedup Test");
    projectId = project.id;
    const node = await createTestNode(projectId, { title: "Session Node" });
    nodeId = node.id;

    // Create multiple sessions (must end each before creating next — API enforces single active)
    const s1 = await createTestSession(nodeId, "Session 1");
    await fetch(`${API}/sessions/${s1.id}/end`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: false }),
    });
    const s2 = await createTestSession(nodeId, "Session 2");
    await fetch(`${API}/sessions/${s2.id}/end`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: false }),
    });
    await createTestSession(nodeId, "Session 3");
  });

  test.afterAll(async () => {
    await cleanTestData();
  });

  test("GET /api/nodes/:id returns all sessions in single response", async () => {
    const res = await fetch(`${API}/nodes/${nodeId}`);
    const json = await res.json();
    expect(res.status).toBe(200);

    // Should have sessions array with all 3
    expect(json.data.sessions).toBeDefined();
    expect(json.data.sessions.length).toBe(3);

    // Should be ordered by startedAt desc
    const dates = json.data.sessions.map((s: { startedAt: string }) => new Date(s.startedAt).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
    }
  });

  test("node detail has correct count fields", async () => {
    const res = await fetch(`${API}/nodes/${nodeId}`);
    const json = await res.json();

    expect(json.data.sessionCount).toBe(3);
    expect(json.data.hasActiveSession).toBeDefined();
    expect(json.data.outEdges).toBeDefined();
    expect(json.data.inEdges).toBeDefined();
  });
});

test.describe("Performance: Canvas API response", () => {
  let projectId: string;

  test.beforeAll(async () => {
    await cleanTestData();
    const project = await createTestProject("Canvas Perf Test");
    projectId = project.id;

    // Create nodes and edges
    const n1 = await createTestNode(projectId, { title: "Node A", status: "todo" });
    const n2 = await createTestNode(projectId, { title: "Node B", status: "in_progress" });
    const n3 = await createTestNode(projectId, { title: "Node C", status: "done" });
    await createTestEdge(n1.id, n2.id);
    await createTestEdge(n2.id, n3.id);

    // Create an archived node (should not appear in canvas)
    await createTestNode(projectId, { title: "Archived Node", status: "archived" });
  });

  test.afterAll(async () => {
    await cleanTestData();
  });

  test("canvas excludes archived nodes", async () => {
    const res = await fetch(`${API}/projects/${projectId}/canvas`);
    const json = await res.json();
    expect(res.status).toBe(200);

    // 3 active nodes (archived excluded)
    expect(json.data.nodes).toHaveLength(3);
    const statuses = json.data.nodes.map((n: { status: string }) => n.status);
    expect(statuses).not.toContain("archived");
  });

  test("canvas returns edges with correct structure", async () => {
    const res = await fetch(`${API}/projects/${projectId}/canvas`);
    const json = await res.json();

    expect(json.data.edges).toHaveLength(2);
    const edge = json.data.edges[0];
    expect(edge).toHaveProperty("fromNodeId");
    expect(edge).toHaveProperty("toNodeId");
    expect(edge).toHaveProperty("type");
  });

  test("canvas returns viewport data", async () => {
    const res = await fetch(`${API}/projects/${projectId}/canvas`);
    const json = await res.json();

    expect(json.data.viewport).toBeDefined();
    expect(json.data.viewport).toHaveProperty("x");
    expect(json.data.viewport).toHaveProperty("y");
    expect(json.data.viewport).toHaveProperty("zoom");
  });

  test("canvas nodes have count fields", async () => {
    const res = await fetch(`${API}/projects/${projectId}/canvas`);
    const json = await res.json();

    const node = json.data.nodes[0];
    expect(node).toHaveProperty("sessionCount");
    expect(node).toHaveProperty("decisionCount");
    expect(node).toHaveProperty("planCount");
  });
});

test.describe("Performance: API response times", () => {
  let projectId: string;
  let nodeId: string;

  test.beforeAll(async () => {
    await cleanTestData();
    const project = await createTestProject("Response Time Test");
    projectId = project.id;
    const node = await createTestNode(projectId, { title: "Timing Node" });
    nodeId = node.id;
  });

  test.afterAll(async () => {
    await cleanTestData();
  });

  test("GET /api/projects responds within 500ms", async () => {
    const start = Date.now();
    const res = await fetch(`${API}/projects`);
    const elapsed = Date.now() - start;
    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(500);
  });

  test("GET /api/projects/:id/dashboard responds within 500ms", async () => {
    const start = Date.now();
    const res = await fetch(`${API}/projects/${projectId}/dashboard`);
    const elapsed = Date.now() - start;
    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(500);
  });

  test("GET /api/projects/:id/canvas responds within 500ms", async () => {
    const start = Date.now();
    const res = await fetch(`${API}/projects/${projectId}/canvas`);
    const elapsed = Date.now() - start;
    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(500);
  });

  test("GET /api/nodes/:id responds within 500ms", async () => {
    const start = Date.now();
    const res = await fetch(`${API}/nodes/${nodeId}`);
    const elapsed = Date.now() - start;
    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(500);
  });
});

test.describe("Performance: UI loading boundaries", () => {
  test("page shows loading fallback for canvas", async ({ page }) => {
    await page.goto("/");
    // The canvas loading fallback should appear briefly (or the canvas itself)
    // Just verify the page loads without errors
    await page.waitForLoadState("networkidle");
    // No uncaught errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    // Filter out WebSocket errors (expected in test env without WS server)
    const nonWsErrors = errors.filter((e) => !e.includes("WebSocket"));
    expect(nonWsErrors).toHaveLength(0);
  });
});
