import { test, expect } from "@playwright/test";
import {
  cleanDatabase,
  createTestProject,
  goToWorkspace,
} from "./helpers";

test.describe("Workspace", () => {
  test.beforeEach(async ({ request }) => {
    await cleanDatabase(request);
  });

  test("shows pipeline bar with 6 stage nodes", async ({ page, request }) => {
    const project = await createTestProject(request);
    await goToWorkspace(page, project.id);

    // Pipeline bar should have 6 stage nodes
    const pipelineBar = page.getByTestId("pipeline-bar");
    await expect(pipelineBar).toBeVisible();
    await expect(pipelineBar.getByTestId("stage-node")).toHaveCount(6);

    // 6 stage names should be visible in the pipeline bar
    await expect(pipelineBar.getByText("아이디어 발산")).toBeVisible();
    await expect(pipelineBar.getByText("문제 정의")).toBeVisible();
    await expect(pipelineBar.getByText("기능 구조화")).toBeVisible();
    await expect(pipelineBar.getByText("기술 설계")).toBeVisible();
    await expect(pipelineBar.getByText("구현")).toBeVisible();
    await expect(pipelineBar.getByText("검증/회고")).toBeVisible();
  });

  test("first stage node is active (blue)", async ({ page, request }) => {
    const project = await createTestProject(request);
    await goToWorkspace(page, project.id);

    // First stage button should have active styles (border-blue-500)
    const pipelineBar = page.getByTestId("pipeline-bar");
    const firstNode = pipelineBar.getByRole("button", { name: "아이디어 발산" });
    await expect(firstNode).toHaveClass(/border-blue-500/);
  });

  test("clicking node changes left panel stage", async ({
    page,
    request,
  }) => {
    const project = await createTestProject(request);
    await goToWorkspace(page, project.id);

    // Stage panel initially shows first stage (first() for mobile/desktop dual render)
    const stagePanel = page.getByTestId("stage-panel").first();
    await expect(stagePanel.locator("h3")).toContainText("아이디어 발산");

    // Click second stage node in pipeline bar
    const pipelineBar = page.getByTestId("pipeline-bar");
    await pipelineBar.getByRole("button", { name: "문제 정의" }).click();

    // Stage panel should update
    await expect(stagePanel.locator("h3")).toContainText("문제 정의");
  });

  test("shows back button to dashboard", async ({ page, request }) => {
    const project = await createTestProject(request);
    await goToWorkspace(page, project.id);

    await expect(page.getByText("대시보드")).toBeVisible();
  });

  test("shows project name in header", async ({ page, request }) => {
    const project = await createTestProject(request, "헤더 테스트");
    await goToWorkspace(page, project.id);

    await expect(page.getByText("헤더 테스트")).toBeVisible();
  });

  test("shows terminal placeholder", async ({ page, request }) => {
    const project = await createTestProject(request);
    await goToWorkspace(page, project.id);

    // Desktop layout's CLIPanel shows this (use last() to get the visible desktop one)
    await expect(page.getByText("새 세션을 시작해주세요").last()).toBeVisible();
  });
});
