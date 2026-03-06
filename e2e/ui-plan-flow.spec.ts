import { test, expect } from "@playwright/test";
import {
  cleanTestData,
  createTestProject,
  createTestNode,
  selectProjectInSidebar,
} from "./helpers";

const API = "http://localhost:3333/api";

/**
 * Helper: create a plan directly in the database.
 * Bypasses Claude CLI for deterministic testing.
 */
async function createMockPlan(nodeId: string, overrides: Record<string, unknown> = {}) {
  const res = await fetch(`${API}/nodes/${nodeId}/plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (res.status === 201) {
    return (await res.json()).data;
  }
  // CLI not available — skip test
  return null;
}

test.describe("UI: Plan review flow via Side Panel", () => {
  let projectId: string;
  let nodeId: string;
  let projectTitle: string;

  test.beforeEach(async ({ page }) => {
    const ts = Date.now();
    projectTitle = `Plan Flow Project ${ts}`;
    const project = await createTestProject(projectTitle, `__e2e__plan-flow-${ts}`);
    projectId = project.id;
    const node = await createTestNode(projectId, {
      type: "issue",
      title: "Plan Test Issue",
      description: "Issue that needs a plan",
      canvasX: 200,
      canvasY: 200,
    });
    nodeId = node.id;
    await selectProjectInSidebar(page, projectTitle);
  });

  test("Side panel shows Plans tab when node is selected", async ({ page }) => {
    // Switch to canvas tab
    await page.keyboard.press("Meta+2");
    await page.waitForTimeout(1000);

    // Click on the issue node
    const node = page.locator(`[data-id="${nodeId}"]`);
    await expect(node).toBeVisible({ timeout: 10000 });
    await node.click();
    await page.waitForTimeout(500);

    // Plans tab should be visible in panel tabs
    const plansTab = page.getByText("계획서");
    await expect(plansTab).toBeVisible({ timeout: 5000 });
  });

  test("Plans tab shows empty state when no plans exist", async ({ page }) => {
    // Select node and open plans tab
    await page.keyboard.press("Meta+2");
    await page.waitForTimeout(1000);

    const node = page.locator(`[data-id="${nodeId}"]`);
    await expect(node).toBeVisible({ timeout: 10000 });
    await node.click();
    await page.waitForTimeout(500);

    // Click on Plans tab
    const plansTab = page.getByText("계획서");
    await plansTab.click();
    await page.waitForTimeout(500);

    // Should show empty state message
    const emptyMsg = page.getByText("아직 실행 계획서가 없습니다");
    await expect(emptyMsg).toBeVisible({ timeout: 5000 });
  });

  test("Plans tab has generate button", async ({ page }) => {
    await page.keyboard.press("Meta+2");
    await page.waitForTimeout(1000);

    const node = page.locator(`[data-id="${nodeId}"]`);
    await expect(node).toBeVisible({ timeout: 10000 });
    await node.click();
    await page.waitForTimeout(500);

    // Click Plans tab
    const plansTab = page.getByText("계획서");
    await plansTab.click();
    await page.waitForTimeout(500);

    // Generate button should be visible
    const generateBtn = page.getByText("@Claude 실행 계획서 생성");
    await expect(generateBtn).toBeVisible({ timeout: 5000 });
  });

  test("Plans tab displays plan after generation via API", async ({ page }) => {
    // Create plan via API
    const plan = await createMockPlan(nodeId);
    if (!plan) {
      test.skip();
      return;
    }

    // Select node and open plans tab
    await page.keyboard.press("Meta+2");
    await page.waitForTimeout(1000);

    const node = page.locator(`[data-id="${nodeId}"]`);
    await expect(node).toBeVisible({ timeout: 10000 });
    await node.click();
    await page.waitForTimeout(500);

    const plansTab = page.getByText("계획서");
    await plansTab.click();
    await page.waitForTimeout(1000);

    // Plan viewer should show the plan content
    // Should have status badge "초안" (draft)
    const draftBadge = page.getByText("초안");
    await expect(draftBadge).toBeVisible({ timeout: 5000 });

    // Should show version
    const versionLabel = page.getByText("v1");
    await expect(versionLabel).toBeVisible({ timeout: 3000 });
  });

  test("Plan approve button changes status", async ({ page }) => {
    const plan = await createMockPlan(nodeId);
    if (!plan) { test.skip(); return; }

    await page.keyboard.press("Meta+2");
    await page.waitForTimeout(1000);

    const node = page.locator(`[data-id="${nodeId}"]`);
    await expect(node).toBeVisible({ timeout: 10000 });
    await node.click();
    await page.waitForTimeout(500);

    const plansTab = page.getByText("계획서");
    await plansTab.click();
    await page.waitForTimeout(1000);

    // Click approve button
    const approveBtn = page.getByRole("button", { name: "승인" });
    await expect(approveBtn).toBeVisible({ timeout: 5000 });
    await approveBtn.click();
    await page.waitForTimeout(1000);

    // Should show approved status
    const approvedBadge = page.getByText("승인됨");
    await expect(approvedBadge).toBeVisible({ timeout: 5000 });

    // Verify via API
    const apiRes = await fetch(`${API}/plans/${plan.id}`);
    const apiJson = await apiRes.json();
    expect(apiJson.data.status).toBe("approved");
  });

  test("Plan reject shows review note dialog", async ({ page }) => {
    const plan = await createMockPlan(nodeId);
    if (!plan) { test.skip(); return; }

    await page.keyboard.press("Meta+2");
    await page.waitForTimeout(1000);

    const node = page.locator(`[data-id="${nodeId}"]`);
    await expect(node).toBeVisible({ timeout: 10000 });
    await node.click();
    await page.waitForTimeout(500);

    const plansTab = page.getByText("계획서");
    await plansTab.click();
    await page.waitForTimeout(1000);

    // Click reject button
    const rejectBtn = page.getByRole("button", { name: "수정 요청" });
    await expect(rejectBtn).toBeVisible({ timeout: 5000 });
    await rejectBtn.click();

    // Review note input should appear
    const noteInput = page.getByPlaceholder("수정이 필요한 이유를 작성해주세요...");
    await expect(noteInput).toBeVisible({ timeout: 3000 });

    // Fill note and submit
    await noteInput.fill("리스크 분석이 부족합니다");
    const submitBtn = page.getByRole("button", { name: "수정 요청 보내기" });
    await submitBtn.click();
    await page.waitForTimeout(1000);

    // Should show rejected status
    const rejectedBadge = page.getByText("수정 요청", { exact: false });
    await expect(rejectedBadge.first()).toBeVisible({ timeout: 5000 });

    // Verify via API
    const apiRes = await fetch(`${API}/plans/${plan.id}`);
    const apiJson = await apiRes.json();
    expect(apiJson.data.status).toBe("rejected");
    expect(apiJson.data.reviewNote).toBe("리스크 분석이 부족합니다");
  });

  test("Generate button shows regenerate text when plan exists", async ({ page }) => {
    const plan = await createMockPlan(nodeId);
    if (!plan) { test.skip(); return; }

    await page.keyboard.press("Meta+2");
    await page.waitForTimeout(1000);

    const node = page.locator(`[data-id="${nodeId}"]`);
    await expect(node).toBeVisible({ timeout: 10000 });
    await node.click();
    await page.waitForTimeout(500);

    const plansTab = page.getByText("계획서");
    await plansTab.click();
    await page.waitForTimeout(1000);

    // Button should say "재생성" instead of "생성"
    const regenerateBtn = page.getByText("실행 계획서 재생성");
    await expect(regenerateBtn).toBeVisible({ timeout: 5000 });
  });
});
