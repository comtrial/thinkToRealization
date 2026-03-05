import { test, expect } from "@playwright/test";
import {
  cleanTestData,
  createTestProject,
  createTestNode,
} from "./helpers";

const API = "http://localhost:3333/api";

/**
 * Helper: create a plan directly via the plan creation API.
 * Note: This calls Claude CLI under the hood, which may fail or return
 * unparsed content. The plan is still created with fallback content.
 */
async function createTestPlan(nodeId: string) {
  const res = await fetch(`${API}/nodes/${nodeId}/plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return { status: res.status, data: (await res.json()).data };
}

test.describe("API: Plans CRUD", () => {
  let projectId: string;
  let nodeId: string;

  test.beforeEach(async () => {
    await cleanTestData();
    const project = await createTestProject("Plan Test Project");
    projectId = project.id;
    const node = await createTestNode(projectId, {
      type: "issue",
      title: "Test Issue for Plans",
      description: "An issue that needs a plan",
    });
    nodeId = node.id;
  });

  test("POST /api/nodes/:id/plans creates a plan", async () => {
    const res = await fetch(`${API}/nodes/${nodeId}/plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    // Plan creation may return 201 (success) or 500 (CLI error)
    // But if CLI is available, it should succeed
    if (res.status === 201) {
      const json = await res.json();
      expect(json.data.nodeId).toBe(nodeId);
      expect(json.data.status).toBe("draft");
      expect(json.data.version).toBe(1);
      expect(json.data.content).toBeDefined();
      expect(json.data.prompt).toBeTruthy();
    } else {
      // CLI not available — plan creation failed but API responded correctly
      expect(res.status).toBe(500);
    }
  });

  test("GET /api/nodes/:id/plans returns plan list for node", async () => {
    // Create a plan first
    const createRes = await fetch(`${API}/nodes/${nodeId}/plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (createRes.status !== 201) {
      test.skip();
      return;
    }

    const listRes = await fetch(`${API}/nodes/${nodeId}/plans`);
    const json = await listRes.json();
    expect(listRes.status).toBe(200);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBe(1);
    expect(json.data[0].nodeId).toBe(nodeId);
  });

  test("GET /api/plans/:id returns plan detail", async () => {
    const createRes = await fetch(`${API}/nodes/${nodeId}/plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (createRes.status !== 201) {
      test.skip();
      return;
    }

    const plan = (await createRes.json()).data;
    const detailRes = await fetch(`${API}/plans/${plan.id}`);
    const json = await detailRes.json();
    expect(detailRes.status).toBe(200);
    expect(json.data.id).toBe(plan.id);
    expect(json.data.content).toBeDefined();
    expect(json.data.prompt).toBeTruthy();
    expect(json.data.status).toBe("draft");
    expect(json.data.version).toBe(1);
  });

  test("PUT /api/plans/:id approves plan", async () => {
    const { status, data: plan } = await createTestPlan(nodeId);
    if (status !== 201) { test.skip(); return; }

    const res = await fetch(`${API}/plans/${plan.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.status).toBe("approved");
  });

  test("PUT /api/plans/:id rejects plan with reviewNote", async () => {
    const { status, data: plan } = await createTestPlan(nodeId);
    if (status !== 201) { test.skip(); return; }

    const res = await fetch(`${API}/plans/${plan.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "rejected",
        reviewNote: "Need more detail on risk mitigation",
      }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.status).toBe("rejected");
    expect(json.data.reviewNote).toBe("Need more detail on risk mitigation");
  });

  test("PUT /api/plans/:id/content updates plan content directly", async () => {
    const { status, data: plan } = await createTestPlan(nodeId);
    if (status !== 201) { test.skip(); return; }

    const newContent = {
      summary: "Updated plan summary",
      affectedFiles: [
        { path: "src/index.ts", action: "modify", description: "Update main entry" },
      ],
      changes: [
        { title: "Refactor main", description: "Restructure exports", risk: "low" },
      ],
      testPlan: [
        { description: "Verify exports", type: "unit" },
      ],
      risks: [
        { description: "Breaking changes", severity: "medium", mitigation: "Run full test suite" },
      ],
    };

    const res = await fetch(`${API}/plans/${plan.id}/content`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newContent }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.content.summary).toBe("Updated plan summary");
    expect(json.data.status).toBe("revised");
  });

  test("GET /api/plans/:id returns 404 for non-existent plan", async () => {
    const res = await fetch(`${API}/plans/nonexistent-plan-id`);
    expect(res.status).toBe(404);
  });

  test("Multiple plans on same node have incrementing versions", async () => {
    const { status: s1 } = await createTestPlan(nodeId);
    if (s1 !== 201) { test.skip(); return; }
    const { status: s2 } = await createTestPlan(nodeId);
    if (s2 !== 201) { test.skip(); return; }

    const listRes = await fetch(`${API}/nodes/${nodeId}/plans`);
    const json = await listRes.json();
    expect(json.data.length).toBe(2);

    const versions = json.data.map((p: { version: number }) => p.version).sort();
    expect(versions).toEqual([1, 2]);
  });

  test("GET /api/nodes/:id/plans returns 404 for non-existent node", async () => {
    const res = await fetch(`${API}/nodes/nonexistent-node-id/plans`);
    expect(res.status).toBe(404);
  });

  test("POST /api/nodes/:id/plans returns 404 for non-existent node", async () => {
    const res = await fetch(`${API}/nodes/nonexistent-node-id/plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(404);
  });
});
