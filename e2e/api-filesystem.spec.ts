import { test, expect } from "@playwright/test";

const API = "http://localhost:3333/api";

test.describe("API: Filesystem directories", () => {
  test("GET /api/filesystem/directories returns directory list for valid path", async () => {
    // Use a path under home directory (the allowed root)
    const res = await fetch(
      `${API}/filesystem/directories?path=${process.env.HOME}/personal-project`
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.currentPath).toBe("${process.env.HOME}/personal-project");
    expect(Array.isArray(json.data.directories)).toBe(true);
  });

  test("GET /api/filesystem/directories rejects paths outside allowed root", async () => {
    const res = await fetch(`${API}/filesystem/directories?path=/tmp`);
    expect(res.status).toBe(403);
  });

  test("GET /api/filesystem/directories entries have expected fields", async () => {
    const res = await fetch(
      `${API}/filesystem/directories?path=${process.env.HOME}/personal-project`
    );
    const json = await res.json();
    expect(res.status).toBe(200);

    const dirs = json.data.directories;
    expect(dirs.length).toBeGreaterThan(0);

    for (const entry of dirs) {
      expect(typeof entry.name).toBe("string");
      expect(typeof entry.path).toBe("string");
      expect(typeof entry.hasGit).toBe("boolean");
      expect(typeof entry.hasClaudeMd).toBe("boolean");
    }
  });

  test("GET /api/filesystem/directories detects .git and CLAUDE.md", async () => {
    const res = await fetch(
      `${API}/filesystem/directories?path=${process.env.HOME}/personal-project`
    );
    const json = await res.json();
    expect(res.status).toBe(200);

    // thinkToRealization has both .git and CLAUDE.md
    const ttr = json.data.directories.find(
      (d: { name: string }) => d.name === "thinkToRealization"
    );
    expect(ttr).toBeDefined();
    expect(ttr.hasGit).toBe(true);
    expect(ttr.hasClaudeMd).toBe(true);
  });

  test("GET /api/filesystem/directories returns parentPath", async () => {
    const res = await fetch(
      `${API}/filesystem/directories?path=${process.env.HOME}/personal-project`
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.parentPath).toBe(`${process.env.HOME}`);
  });

  test("GET /api/filesystem/directories returns only directories", async () => {
    const res = await fetch(
      `${API}/filesystem/directories?path=${process.env.HOME}/personal-project`
    );
    const json = await res.json();
    expect(res.status).toBe(200);

    // Should not include files like CLAUDE.md, package.json, etc.
    const names = json.data.directories.map((d: { name: string }) => d.name);
    expect(names).not.toContain("CLAUDE.md");
    expect(names).not.toContain("package.json");
  });

  test("GET /api/filesystem/directories returns 404 for non-existent path under allowed root", async () => {
    const res = await fetch(
      `${API}/filesystem/directories?path=${process.env.HOME}/nonexistent-dir-${Date.now()}`
    );
    expect(res.status).toBe(404);
  });

  test("GET /api/filesystem/directories without path returns default listing", async () => {
    const res = await fetch(`${API}/filesystem/directories`);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.currentPath).toBeTruthy();
    expect(Array.isArray(json.data.directories)).toBe(true);
  });
});
