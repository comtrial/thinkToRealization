import { type Page, type APIRequestContext } from "@playwright/test";

// API helper that wraps fetch responses
// Uses relative URLs — Playwright's baseURL from config is applied automatically
async function apiRequest<T>(
  request: APIRequestContext,
  url: string,
  options?: {
    method?: string;
    data?: unknown;
  }
): Promise<T> {
  const res = await request.fetch(url, {
    method: options?.method ?? "GET",
    data: options?.data,
    headers: { "Content-Type": "application/json" },
  });
  const json = await res.json();
  return json.data as T;
}

// Create a project via API and return it with stages
export async function createTestProject(
  request: APIRequestContext,
  name = "테스트 프로젝트"
) {
  const project = await apiRequest<{
    id: string;
    name: string;
    stages: { id: string; name: string; status: string; orderIndex: number }[];
  }>(request, "/api/projects", {
    method: "POST",
    data: { name },
  });
  return project;
}

// Delete a project via API
export async function deleteTestProject(
  request: APIRequestContext,
  projectId: string
) {
  await apiRequest(request, `/api/projects/${projectId}`, {
    method: "DELETE",
  });
}

// Delete all projects (clean slate)
export async function cleanDatabase(request: APIRequestContext) {
  const projects = await apiRequest<{ id: string }[]>(
    request,
    "/api/projects"
  );
  for (const project of projects) {
    await deleteTestProject(request, project.id);
  }
}

// Create a session for a stage via API
export async function createTestSession(
  request: APIRequestContext,
  stageId: string,
  title?: string
) {
  return apiRequest<{ id: string; stageId: string; title: string | null }>(
    request,
    `/api/stages/${stageId}/sessions`,
    {
      method: "POST",
      data: { title },
    }
  );
}

// Create a decision for a stage via API
export async function createTestDecision(
  request: APIRequestContext,
  stageId: string,
  content: string,
  sessionId?: string
) {
  return apiRequest<{ id: string; content: string }>(
    request,
    "/api/decisions",
    {
      method: "POST",
      data: { stageId, sessionId, content },
    }
  );
}

// Navigate to workspace for a project
export async function goToWorkspace(page: Page, projectId: string) {
  await page.goto(`/project/${projectId}`);
  await page.waitForLoadState("networkidle");
}
