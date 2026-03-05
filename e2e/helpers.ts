const API = "http://localhost:3333/api";
const E2E_SLUG_PREFIX = "__e2e__";
const E2E_SLUG_PREFIXES = ["__e2e__", "e2e-test-"];

function isTestProject(slug: string) {
  return E2E_SLUG_PREFIXES.some((prefix) => slug.startsWith(prefix));
}

/**
 * Clean up only E2E test data (projects with __e2e__ or e2e-test- slug prefix).
 * User's real projects are never touched.
 */
export async function cleanTestData() {
  const res = await fetch(`${API}/test/cleanup`, { method: "POST" });
  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new Error(`cleanTestData failed (${res.status}): ${text}`);
  }
  // Verify cleanup completed — only check that no test projects remain
  for (let i = 0; i < 10; i++) {
    const check = await fetch(`${API}/projects`);
    const json = await check.json();
    const testProjects = json.data.filter((p: { slug: string }) =>
      isTestProject(p.slug),
    );
    if (testProjects.length === 0) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("cleanTestData: test projects still exist after 10 retries");
}

/** @deprecated Use cleanTestData() instead — this alias exists for migration */
export const cleanDatabase = cleanTestData;

export async function createTestProject(
  title = "Test Project",
  slug = E2E_SLUG_PREFIX + Date.now(),
) {
  const res = await fetch(`${API}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      slug,
      description: "E2E test project",
      projectDir: "/tmp/test-project",
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      `createTestProject failed (${res.status}): ${JSON.stringify(json)}`,
    );
  }
  return json.data;
}

export async function createTestNode(
  projectId: string,
  overrides: Record<string, unknown> = {},
) {
  const res = await fetch(`${API}/projects/${projectId}/nodes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "task",
      title: "Test Node",
      status: "backlog",
      canvasX: 0,
      canvasY: 0,
      ...overrides,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      `createTestNode failed (${res.status}): ${JSON.stringify(json)}`,
    );
  }
  return json.data;
}

export async function createTestEdge(
  fromNodeId: string,
  toNodeId: string,
  overrides: Record<string, unknown> = {},
) {
  const res = await fetch(`${API}/edges`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromNodeId, toNodeId, ...overrides }),
  });
  const json = await res.json();
  return json.data;
}

export async function createTestSession(nodeId: string, title?: string) {
  const res = await fetch(`${API}/nodes/${nodeId}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  const json = await res.json();
  return json.data;
}

/**
 * Navigate to the app and select a specific project by clicking it in the sidebar.
 * Handles the case where another project may be auto-selected initially.
 */
export async function selectProjectInSidebar(
  page: import("@playwright/test").Page,
  projectTitle: string,
) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Wait for sidebar project list to contain the project
  const projectList = page.getByTestId("project-list");
  await projectList.getByText(projectTitle).waitFor({ timeout: 15000 });

  // Click the project in sidebar
  await projectList.getByText(projectTitle).click();

  // Wait a moment for state to propagate
  await page.waitForTimeout(500);

  // Verify the project is selected in header (ProjectSelector shows title)
  // The header button text is truncated at 150px, so use substring match
  await page
    .locator("header")
    .getByText(projectTitle, { exact: false })
    .waitFor({ timeout: 10000 });
}

export async function createTestDecision(
  nodeId: string,
  content: string,
  sessionId?: string,
) {
  const res = await fetch(`${API}/decisions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nodeId, content, sessionId }),
  });
  const json = await res.json();
  return json.data;
}
