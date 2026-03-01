const API = "http://localhost:3333/api";

export async function cleanDatabase() {
  const res = await fetch(`${API}/projects`);
  const { data } = await res.json();
  for (const p of data || []) {
    await fetch(`${API}/projects/${p.id}`, { method: "DELETE" });
  }
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
