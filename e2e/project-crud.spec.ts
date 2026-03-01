import { test, expect } from "@playwright/test";
import { cleanDatabase, createTestProject } from "./helpers";

test.describe("Project CRUD", () => {
  test.beforeEach(async ({ request }) => {
    await cleanDatabase(request);
  });

  test("create a new project via dialog", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Click create button
    await page.getByTestId("create-project-btn").click();

    // Fill in project name
    await page.getByPlaceholder("프로젝트 이름").fill("내 새 프로젝트");

    // Submit
    await page.getByRole("button", { name: "생성" }).click();

    // Verify project card appears on dashboard
    await expect(page.getByTestId("project-card").filter({ hasText: "내 새 프로젝트" })).toBeVisible();
  });

  test("project card shows 6 stage dots", async ({ page, request }) => {
    await createTestProject(request, "도트 테스트");

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Project card should exist
    const card = page.getByTestId("project-card").filter({ hasText: "도트 테스트" });
    await expect(card).toBeVisible();

    // Should have 6 dot indicators (stage dots)
    const dots = card.getByTestId("project-card-dots").locator("span.rounded-full");
    await expect(dots).toHaveCount(6);
  });

  test("clicking project card navigates to workspace", async ({
    page,
    request,
  }) => {
    const project = await createTestProject(request, "이동 테스트");

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Click the project card
    await page.getByTestId("project-card").filter({ hasText: "이동 테스트" }).click();

    // Should navigate to workspace
    await expect(page).toHaveURL(`/project/${project.id}`);
  });

  test("project with 6 default stages created via API", async ({
    request,
  }) => {
    const project = await createTestProject(request, "API 생성");

    expect(project.stages).toHaveLength(6);
    expect(project.stages[0].status).toBe("active");
    expect(project.stages[1].status).toBe("waiting");
    expect(project.stages[0].name).toBe("아이디어 발산");
    expect(project.stages[5].name).toBe("검증/회고");
  });

  test("delete project via API", async ({ request }) => {
    const project = await createTestProject(request, "삭제 테스트");

    // Delete
    const res = await request.fetch(
      `/api/projects/${project.id}`,
      { method: "DELETE" }
    );
    expect(res.ok()).toBeTruthy();

    // Verify gone
    const getRes = await request.fetch(
      `/api/projects/${project.id}`
    );
    const json = await getRes.json();
    expect(json.error).toBeTruthy();
  });
});
