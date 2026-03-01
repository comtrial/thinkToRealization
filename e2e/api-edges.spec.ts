import { test, expect } from "@playwright/test";
import {
  cleanDatabase,
  createTestProject,
  createTestNode,
  createTestEdge,
} from "./helpers";

const API = "http://localhost:3333/api";

test.describe("API: Edges CRUD", () => {
  let projectId: string;
  let nodeAId: string;
  let nodeBId: string;

  test.beforeEach(async () => {
    await cleanDatabase();
    const project = await createTestProject();
    projectId = project.id;
    const nodeA = await createTestNode(projectId, { title: "Node A" });
    const nodeB = await createTestNode(projectId, {
      title: "Node B",
      canvasX: 200,
      canvasY: 0,
    });
    nodeAId = nodeA.id;
    nodeBId = nodeB.id;
  });

  test("POST /api/edges creates edge", async () => {
    const res = await fetch(`${API}/edges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromNodeId: nodeAId, toNodeId: nodeBId }),
    });
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.data.fromNodeId).toBe(nodeAId);
    expect(json.data.toNodeId).toBe(nodeBId);
    expect(json.data.type).toBe("sequence");
  });

  test("GET /api/projects/:id/edges returns edges", async () => {
    await createTestEdge(nodeAId, nodeBId);
    const res = await fetch(`${API}/projects/${projectId}/edges`);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.length).toBe(1);
    expect(json.data[0].fromNodeId).toBe(nodeAId);
  });

  test("PUT /api/edges/:id updates edge", async () => {
    const edge = await createTestEdge(nodeAId, nodeBId);
    const res = await fetch(`${API}/edges/${edge.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "dependency", label: "blocks" }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.type).toBe("dependency");
    expect(json.data.label).toBe("blocks");
  });

  test("DELETE /api/edges/:id deletes edge", async () => {
    const edge = await createTestEdge(nodeAId, nodeBId);
    const delRes = await fetch(`${API}/edges/${edge.id}`, { method: "DELETE" });
    expect(delRes.status).toBe(200);

    // Verify edge is gone
    const listRes = await fetch(`${API}/projects/${projectId}/edges`);
    const listJson = await listRes.json();
    expect(listJson.data.length).toBe(0);
  });

  test("POST /api/edges rejects self-referencing edge", async () => {
    const res = await fetch(`${API}/edges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromNodeId: nodeAId, toNodeId: nodeAId }),
    });
    expect(res.status).toBe(400);
  });
});
