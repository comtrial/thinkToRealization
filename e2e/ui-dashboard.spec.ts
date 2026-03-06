import { test, expect } from "@playwright/test";
import {
  cleanTestData,
  createTestProject,
  createTestNode,
  selectProjectInSidebar,
} from "./helpers";

const API = "http://localhost:3333/api";

test.describe("UI: Dashboard rendering and interactions", () => {
  let projectId: string;

  test.beforeEach(async ({ page }) => {
    await cleanTestData();
    const project = await createTestProject("Dashboard Project");
    projectId = project.id;

    await selectProjectInSidebar(page, "Dashboard Project");
  });

  test("Shows empty dashboard when no nodes exist", async ({ page }) => {
    const main = page.locator("main");
    await expect(main).toContainText("아직 진행 중인 작업이 없습니다", {
      timeout: 5000,
    });
  });

  test("Shows welcome message on dashboard", async ({ page }) => {
    await expect(page.locator("main")).toContainText("돌아왔습니다", {
      timeout: 5000,
    });
  });

  test("Dashboard shows in-progress nodes", async ({ page }) => {
    const node = await createTestNode(projectId, {
      title: "Working on feature",
      type: "feature",
    });
    await fetch(`${API}/nodes/${node.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "in_progress",
        triggerType: "user_manual",
      }),
    });

    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page.locator("main")).toContainText("작업 중", {
      timeout: 5000,
    });
    await expect(page.locator("main")).toContainText("Working on feature", {
      timeout: 5000,
    });
  });

  test("Dashboard shows todo nodes", async ({ page }) => {
    const node = await createTestNode(projectId, {
      title: "Need to do this",
      type: "feature",
    });
    await fetch(`${API}/nodes/${node.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "todo", triggerType: "user_manual" }),
    });

    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page.locator("main")).toContainText("할 일", {
      timeout: 5000,
    });
    await expect(page.locator("main")).toContainText("Need to do this", {
      timeout: 5000,
    });
  });

  test("Dashboard shows recently done nodes", async ({ page }) => {
    const node = await createTestNode(projectId, {
      title: "Completed task",
      type: "feature",
    });
    // Must transition through in_progress first (backlog → done is not allowed)
    await fetch(`${API}/nodes/${node.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_progress", triggerType: "user_manual" }),
    });
    await fetch(`${API}/nodes/${node.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done", triggerType: "user_manual" }),
    });

    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page.locator("main")).toContainText("최근 완료", {
      timeout: 5000,
    });
    await expect(page.locator("main")).toContainText("Completed task", {
      timeout: 5000,
    });
  });

  test("Clicking dashboard card switches to canvas tab", async ({ page }) => {
    const node = await createTestNode(projectId, {
      title: "Click me",
      type: "feature",
    });
    await fetch(`${API}/nodes/${node.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "in_progress",
        triggerType: "user_manual",
      }),
    });

    await page.reload();
    await page.waitForLoadState("networkidle");

    const card = page.locator("button", { hasText: "Click me" });
    await expect(card).toBeVisible({ timeout: 5000 });
    await card.click();

    const canvasTab = page.getByRole("button", { name: "캔버스" });
    await expect(canvasTab).toHaveAttribute("data-active", "true", {
      timeout: 3000,
    });
  });

  test("Dashboard shows mixed statuses correctly", async ({ page }) => {
    const n1 = await createTestNode(projectId, {
      title: "In Progress Task",
      type: "feature",
    });
    await fetch(`${API}/nodes/${n1.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "in_progress",
        triggerType: "user_manual",
      }),
    });

    const n2 = await createTestNode(projectId, {
      title: "Todo Item",
      type: "planning",
      canvasX: 200,
      canvasY: 0,
    });
    await fetch(`${API}/nodes/${n2.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "todo", triggerType: "user_manual" }),
    });

    const n3 = await createTestNode(projectId, {
      title: "Done Item",
      type: "planning",
      canvasX: 400,
      canvasY: 0,
    });
    // Must transition through in_progress first (backlog → done is not allowed)
    await fetch(`${API}/nodes/${n3.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_progress", triggerType: "user_manual" }),
    });
    await fetch(`${API}/nodes/${n3.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done", triggerType: "user_manual" }),
    });

    await page.reload();
    await page.waitForLoadState("networkidle");

    const main = page.locator("main");
    await expect(main).toContainText("작업 중", { timeout: 5000 });
    await expect(main).toContainText("In Progress Task");
    await expect(main).toContainText("할 일");
    await expect(main).toContainText("Todo Item");
    await expect(main).toContainText("최근 완료");
    await expect(main).toContainText("Done Item");
  });

  test("Tab switching: dashboard to canvas and back", async ({ page }) => {
    await expect(page.locator("main")).toContainText("돌아왔습니다", {
      timeout: 5000,
    });

    await page.getByRole("button", { name: "캔버스" }).click();
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "대시보드" }).click();
    await expect(page.locator("main")).toContainText("돌아왔습니다", {
      timeout: 5000,
    });
  });
});
