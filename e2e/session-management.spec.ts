import { test, expect } from "@playwright/test";
import {
  cleanDatabase,
  createTestProject,
  createTestSession,
  goToWorkspace,
} from "./helpers";

test.describe("Session Management", () => {
  test.beforeEach(async ({ request }) => {
    await cleanDatabase(request);
  });

  test("shows empty sessions message initially", async ({
    page,
    request,
  }) => {
    const project = await createTestProject(request);
    await goToWorkspace(page, project.id);

    await expect(page.getByText("아직 세션이 없습니다")).toBeVisible();
  });

  test("create new session via button", async ({ page, request }) => {
    const project = await createTestProject(request);
    await goToWorkspace(page, project.id);

    // Click new session button
    await page.getByTestId("new-session-btn").click();

    // Wait for creation
    await page.waitForTimeout(500);

    // Session should appear in list (empty message should be gone)
    const stagePanel = page.getByTestId("stage-panel").first();
    await expect(stagePanel.getByText("아직 세션이 없습니다")).not.toBeVisible();
    await expect(stagePanel.getByTestId("session-item")).toHaveCount(1);
  });

  test("sessions created via API appear in list", async ({
    page,
    request,
  }) => {
    const project = await createTestProject(request);
    const activeStage = project.stages.find((s) => s.status === "active")!;

    await createTestSession(request, activeStage.id, "첫 번째 세션");
    await createTestSession(request, activeStage.id, "두 번째 세션");

    await goToWorkspace(page, project.id);

    const stagePanel = page.getByTestId("stage-panel");
    await expect(stagePanel.getByTestId("session-item")).toHaveCount(2);
    await expect(stagePanel.getByTestId("session-item").filter({ hasText: "첫 번째 세션" })).toBeVisible();
    await expect(stagePanel.getByTestId("session-item").filter({ hasText: "두 번째 세션" })).toBeVisible();
  });

  test("clicking session changes active session", async ({
    page,
    request,
  }) => {
    const project = await createTestProject(request);
    const activeStage = project.stages.find((s) => s.status === "active")!;

    await createTestSession(request, activeStage.id, "세션 A");
    await createTestSession(request, activeStage.id, "세션 B");

    await goToWorkspace(page, project.id);

    // Click on session A
    const sessionA = page.getByTestId("session-item").filter({ hasText: "세션 A" });
    await sessionA.click();

    // The clicked session button should have active styles
    await expect(sessionA.locator("button")).toHaveClass(/bg-blue-500/);
  });

  test("delete session via API", async ({ request }) => {
    const project = await createTestProject(request);
    const activeStage = project.stages.find((s) => s.status === "active")!;

    const session = await createTestSession(
      request,
      activeStage.id,
      "삭제할 세션"
    );

    // Delete
    const res = await request.fetch(
      `/api/sessions/${session.id}`,
      { method: "DELETE" }
    );
    expect(res.ok()).toBeTruthy();

    // Verify gone
    const getRes = await request.fetch(
      `/api/sessions/${session.id}`
    );
    const json = await getRes.json();
    expect(json.error).toBeTruthy();
  });
});
