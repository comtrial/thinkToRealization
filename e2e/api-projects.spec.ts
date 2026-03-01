import { test, expect } from "@playwright/test";
import { cleanDatabase, createTestProject } from "./helpers";

const API = "http://localhost:3333/api";

test.describe("API: Projects CRUD", () => {
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  test("GET /api/projects returns empty list initially", async () => {
    const res = await fetch(`${API}/projects`);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data).toEqual([]);
  });

  test("POST /api/projects creates project with slug", async () => {
    const uniqueSlug = `my-project-${Date.now()}`;
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
    expect(listJson.data.length).toBe(0);
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
