import { test, expect } from "@playwright/test";
import {
  cleanDatabase,
  createTestProject,
  createTestDecision,
  goToWorkspace,
} from "./helpers";

test.describe("Decision Pin", () => {
  test.beforeEach(async ({ request }) => {
    await cleanDatabase(request);
  });

  test("shows empty decisions message initially", async ({
    page,
    request,
  }) => {
    const project = await createTestProject(request);
    await goToWorkspace(page, project.id);

    const stagePanel = page.getByTestId("stage-panel").first();
    await expect(stagePanel).toBeVisible({ timeout: 10000 });
    await expect(stagePanel.getByText("아직 결정사항이 없습니다")).toBeVisible();
  });

  test("decisions created via API appear in stage panel", async ({
    page,
    request,
  }) => {
    const project = await createTestProject(request);
    const activeStage = project.stages.find((s) => s.status === "active")!;

    await createTestDecision(request, activeStage.id, "CLI only 방식 채택");
    await createTestDecision(request, activeStage.id, "다크모드 고정");

    await goToWorkspace(page, project.id);

    await expect(page.getByText("CLI only 방식 채택")).toBeVisible();
    await expect(page.getByText("다크모드 고정")).toBeVisible();
    await expect(page.getByText("결정사항 (2)")).toBeVisible();
  });

  test("delete decision shows button on hover", async ({
    page,
    request,
  }) => {
    const project = await createTestProject(request);
    const activeStage = project.stages.find((s) => s.status === "active")!;

    await createTestDecision(request, activeStage.id, "삭제할 결정");

    await goToWorkspace(page, project.id);

    // Wait for decision to appear, then hover to reveal delete button
    const decisionItem = page.getByTestId("decision-item").filter({ hasText: "삭제할 결정" });
    await expect(decisionItem).toBeVisible({ timeout: 10000 });
    await decisionItem.hover();

    // Trash icon button should be visible
    const deleteBtn = decisionItem.locator("button");
    await expect(deleteBtn).toBeVisible();
  });

  test("create and delete decision via API", async ({ request }) => {
    const project = await createTestProject(request);
    const activeStage = project.stages.find((s) => s.status === "active")!;

    // Create
    const decision = await createTestDecision(
      request,
      activeStage.id,
      "API 테스트 결정"
    );
    expect(decision.content).toBe("API 테스트 결정");

    // Delete
    const res = await request.fetch(
      `/api/decisions/${decision.id}`,
      { method: "DELETE" }
    );
    expect(res.ok()).toBeTruthy();
  });

  test("decision validation: empty content rejected", async ({ request }) => {
    const project = await createTestProject(request);
    const activeStage = project.stages.find((s) => s.status === "active")!;

    const res = await request.fetch("/api/decisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      data: { stageId: activeStage.id, content: "" },
    });
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });
});
