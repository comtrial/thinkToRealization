import { test, expect } from "@playwright/test";
import {
  cleanDatabase,
  createTestProject,
  createTestDecision,
  goToWorkspace,
} from "./helpers";

test.describe("Stage Transition", () => {
  test.beforeEach(async ({ request }) => {
    await cleanDatabase(request);
  });

  test("clicking next stage shows transition modal", async ({
    page,
    request,
  }) => {
    const project = await createTestProject(request);
    await goToWorkspace(page, project.id);

    // Click "다음" button in stage panel
    await page.getByTestId("next-stage-btn").click();

    // Transition modal should appear
    const modal = page.getByTestId("transition-modal");
    await expect(modal).toBeVisible();
    await expect(modal.getByText("다음 단계로 이동")).toBeVisible();
    await expect(modal.getByText("저장하고 이동")).toBeVisible();
    await expect(modal.getByText("건너뛰기")).toBeVisible();
  });

  test("save and transition updates stage statuses", async ({
    page,
    request,
  }) => {
    const project = await createTestProject(request);
    await goToWorkspace(page, project.id);

    // Click next
    await page.getByTestId("next-stage-btn").click();

    // Fill summary and save
    await page.getByRole("textbox").fill("첫 단계 완료 요약");
    await page.getByRole("button", { name: "저장하고 이동" }).click();

    // Wait for transition to complete
    await page.waitForTimeout(500);

    // First stage should now be completed (green)
    const pipelineBar = page.getByTestId("pipeline-bar");
    const firstNode = pipelineBar.getByRole("button", { name: "아이디어 발산" });
    await expect(firstNode).toHaveClass(/border-green-500/);

    // Second stage should now be active (blue)
    const secondNode = pipelineBar.getByRole("button", { name: "문제 정의" });
    await expect(secondNode).toHaveClass(/border-blue-500/);
  });

  test("skip transition moves without summary", async ({
    page,
    request,
  }) => {
    const project = await createTestProject(request);
    await goToWorkspace(page, project.id);

    // Click next
    await page.getByTestId("next-stage-btn").click();

    // Click skip
    await page.getByRole("button", { name: "건너뛰기" }).click();

    // Wait for transition
    await page.waitForTimeout(500);

    // Should have moved to second stage
    const pipelineBar = page.getByTestId("pipeline-bar");
    const secondNode = pipelineBar.getByRole("button", { name: "문제 정의" });
    await expect(secondNode).toHaveClass(/border-blue-500/);
  });

  test("previous stage button navigates back", async ({ page, request }) => {
    const project = await createTestProject(request);
    await goToWorkspace(page, project.id);

    // Move to second stage first
    await page.getByTestId("next-stage-btn").click();
    await page.getByRole("button", { name: "건너뛰기" }).click();
    await page.waitForTimeout(500);

    // Now click "이전"
    await page.getByTestId("prev-stage-btn").click();

    // Stage panel should show first stage (first() for mobile/desktop dual render)
    await expect(page.getByTestId("stage-panel").first().locator("h3")).toContainText("아이디어 발산");
  });

  test("decisions are shown in transition modal summary", async ({
    page,
    request,
  }) => {
    const project = await createTestProject(request);
    const activeStage = project.stages.find((s) => s.status === "active")!;

    // Create decisions via API
    await createTestDecision(request, activeStage.id, "CLI만 사용");
    await createTestDecision(request, activeStage.id, "다크모드 고정");

    await goToWorkspace(page, project.id);

    // Click next to open modal
    await page.getByTestId("next-stage-btn").click();

    // The textarea should contain decision contents as summary draft
    const textarea = page.getByRole("textbox");
    await expect(textarea).toHaveValue(/CLI만 사용/);
    await expect(textarea).toHaveValue(/다크모드 고정/);
  });
});
