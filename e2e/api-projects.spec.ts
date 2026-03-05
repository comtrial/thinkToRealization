import { test, expect } from "@playwright/test";
import { cleanTestData, createTestProject } from "./helpers";

const API = "http://localhost:3333/api";

test.describe("API: Projects CRUD", () => {
  test.beforeEach(async () => {
    await cleanTestData();
  });

  test("GET /api/projects returns list after cleanup (no test projects)", async () => {
    const res = await fetch(`${API}/projects`);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(json.data)).toBe(true);
    // After cleanup, no test projects should remain
    const testProjects = json.data.filter((p: { slug: string }) =>
      p.slug.startsWith("__e2e__") || p.slug.startsWith("e2e-test-"),
    );
    expect(testProjects.length).toBe(0);
  });

  test("POST /api/projects creates project with slug", async () => {
    const uniqueSlug = `__e2e__project-${Date.now()}`;
    const res = await fetch(`${API}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "My Project",
        slug: uniqueSlug,
        description: "A test project",
        projectDir: "/tmp/my-project",
      }),
    });
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.data.title).toBe("My Project");
    expect(json.data.slug).toBe(uniqueSlug);
    expect(json.data.id).toBeTruthy();
  });

  test("GET /api/projects/:id returns project with node count", async () => {
    const project = await createTestProject("Detail Project");
    const res = await fetch(`${API}/projects/${project.id}`);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.title).toBe("Detail Project");
    expect(json.data._count).toBeDefined();
    expect(json.data._count.nodes).toBe(0);
  });

  test("PUT /api/projects/:id updates title and description", async () => {
    const project = await createTestProject();
    const res = await fetch(`${API}/projects/${project.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Title", description: "Updated desc" }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.title).toBe("Updated Title");
    expect(json.data.description).toBe("Updated desc");
  });

  test("DELETE /api/projects/:id soft-deletes (sets isActive=false)", async () => {
    const project = await createTestProject();
    const delRes = await fetch(`${API}/projects/${project.id}`, { method: "DELETE" });
    expect(delRes.status).toBe(200);

    // Should no longer appear in list (list filters isActive=true)
    const listRes = await fetch(`${API}/projects`);
    const listJson = await listRes.json();
    // The deleted test project should not appear
    const found = listJson.data.find((p: { id: string }) => p.id === project.id);
    expect(found).toBeUndefined();
  });

  test("GET /api/projects/:id returns 404 for non-existent", async () => {
    const res = await fetch(`${API}/projects/nonexistent-id`);
    expect(res.status).toBe(404);
  });

  test("POST /api/projects validates required fields", async () => {
    const res = await fetch(`${API}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
