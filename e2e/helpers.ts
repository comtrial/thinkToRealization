const API = "http://localhost:3333/api";

export async function cleanDatabase() {
  // Hard-delete all test data via cleanup endpoint (includes WAL checkpoint)
  const res = await fetch(`${API}/test/cleanup`, { method: "POST" });
  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new Error(`cleanDatabase failed (${res.status}): ${text}`);
  }
  // Verify cleanup completed - wait for DB to be consistent
  for (let i = 0; i < 10; i++) {
    const check = await fetch(`${API}/projects`);
    const json = await check.json();
    if (json.data.length === 0) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("cleanDatabase: projects still exist after 10 retries");
}

export async function createTestProject(
  title = "Test Project",
  slug = "test-project-" + Date.now(),
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
    throw new Error(`createTestProject failed (${res.status}): ${JSON.stringify(json)}`);
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
    throw new Error(`createTestNode failed (${res.status}): ${JSON.stringify(json)}`);
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

export async function createTestSession(
  nodeId: string,
  title?: string,
) {
  const res = await fetch(`${API}/nodes/${nodeId}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  const json = await res.json();
  return json.data;
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
