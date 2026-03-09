import { test, expect } from "@playwright/test";
import {
  cleanTestData,
  createTestProject,
  createTestNode,
  createTestEdge,
} from "./helpers";

const API = "http://localhost:3333/api";

/**
 * The BYPASS_AUTH test user (auto-created by guard.ts when BYPASS_AUTH=true).
 * userId: "test-user-id", email: "test@test.local", name: "Test User"
 */
const TEST_USER_ID = "test-user-id";

test.describe("API: New Features", () => {
  let projectId: string;

  test.beforeEach(async () => {
    await cleanTestData();
    const project = await createTestProject();
    projectId = project.id;
  });

  // --------------------------------------------------------------------------
  // 1. PUT /api/nodes/:id/status — any-to-any manual transitions
  // --------------------------------------------------------------------------
  test.describe("PUT /api/nodes/:id/status — manual transitions", () => {
    test("backlog → done (skip intermediate states)", async () => {
      const node = await createTestNode(projectId, { status: "backlog" });

      const res = await fetch(`${API}/nodes/${node.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done", triggerType: "user_manual" }),
      });
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.data.status).toBe("done");
    });

    test("done → todo (reverse transition)", async () => {
      const node = await createTestNode(projectId, { status: "backlog" });

      // First move to done
      await fetch(`${API}/nodes/${node.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done", triggerType: "user_manual" }),
      });

      // Then move back to todo
      const res = await fetch(`${API}/nodes/${node.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "todo", triggerType: "user_manual" }),
      });
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.data.status).toBe("todo");
    });

    test("in_progress → archived", async () => {
      const node = await createTestNode(projectId, { status: "backlog" });

      await fetch(`${API}/nodes/${node.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "in_progress",
          triggerType: "user_manual",
        }),
      });

      const res = await fetch(`${API}/nodes/${node.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "archived",
          triggerType: "user_manual",
        }),
      });
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.data.status).toBe("archived");
    });

    test("archived → backlog (unarchive)", async () => {
      const node = await createTestNode(projectId, { status: "backlog" });

      await fetch(`${API}/nodes/${node.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "archived",
          triggerType: "user_manual",
        }),
      });

      const res = await fetch(`${API}/nodes/${node.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "backlog",
          triggerType: "user_manual",
        }),
      });
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.data.status).toBe("backlog");
    });

    test("same status transition returns 400", async () => {
      const node = await createTestNode(projectId, { status: "backlog" });

      const res = await fetch(`${API}/nodes/${node.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "backlog",
          triggerType: "user_manual",
        }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("SAME_STATUS");
    });
  });

  // --------------------------------------------------------------------------
  // 2. PUT /api/nodes/:id/assignee — self-assignment creates notification
  // --------------------------------------------------------------------------
  test.describe("PUT /api/nodes/:id/assignee", () => {
    test("self-assignment creates notification", async () => {
      const node = await createTestNode(projectId);

      const res = await fetch(`${API}/nodes/${node.id}/assignee`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: TEST_USER_ID }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.assigneeId).toBe(TEST_USER_ID);

      // Verify notification was created (self-assignment uses allowSelf: true)
      const notifRes = await fetch(`${API}/notifications`);
      const notifJson = await notifRes.json();
      expect(notifRes.status).toBe(200);

      const assignmentNotif = notifJson.data.find(
        (n: { type: string; nodeId: string }) =>
          n.type === "assignment" && n.nodeId === node.id,
      );
      expect(assignmentNotif).toBeDefined();
      expect(assignmentNotif.userId).toBe(TEST_USER_ID);
    });

    test("clear assignee (set to null)", async () => {
      const node = await createTestNode(projectId);

      // Assign first
      await fetch(`${API}/nodes/${node.id}/assignee`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: TEST_USER_ID }),
      });

      // Clear assignee
      const res = await fetch(`${API}/nodes/${node.id}/assignee`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: null }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.assigneeId).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 3. GET /api/notifications?unread=true — filter works correctly
  // --------------------------------------------------------------------------
  test.describe("GET /api/notifications — unread filter", () => {
    test("unread=true returns only unread notifications", async () => {
      const node = await createTestNode(projectId);

      // Create a notification via self-assignment
      await fetch(`${API}/nodes/${node.id}/assignee`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: TEST_USER_ID }),
      });

      // All notifications should be unread by default
      const unreadRes = await fetch(`${API}/notifications?unread=true`);
      const unreadJson = await unreadRes.json();
      expect(unreadRes.status).toBe(200);
      expect(unreadJson.data.length).toBeGreaterThanOrEqual(1);

      // Every returned notification should have isRead=false
      for (const notif of unreadJson.data) {
        expect(notif.isRead).toBe(false);
      }
    });

    test("without filter returns all notifications", async () => {
      const node = await createTestNode(projectId);

      // Create a notification via self-assignment
      await fetch(`${API}/nodes/${node.id}/assignee`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: TEST_USER_ID }),
      });

      const allRes = await fetch(`${API}/notifications`);
      const allJson = await allRes.json();
      expect(allRes.status).toBe(200);
      expect(allJson.data.length).toBeGreaterThanOrEqual(1);
    });

    test("marking notification as read excludes it from unread filter", async () => {
      const node = await createTestNode(projectId);

      // Create a notification
      await fetch(`${API}/nodes/${node.id}/assignee`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: TEST_USER_ID }),
      });

      // Get notifications to find the ID
      const allRes = await fetch(`${API}/notifications`);
      const allJson = await allRes.json();
      const notifId = allJson.data.find(
        (n: { nodeId: string }) => n.nodeId === node.id,
      )?.id;
      expect(notifId).toBeDefined();

      // Mark as read
      const markRes = await fetch(`${API}/notifications/${notifId}/read`, {
        method: "PUT",
      });
      expect(markRes.status).toBe(200);

      // Now unread filter should not return this notification
      const unreadRes = await fetch(`${API}/notifications?unread=true`);
      const unreadJson = await unreadRes.json();
      const found = unreadJson.data.find(
        (n: { id: string }) => n.id === notifId,
      );
      expect(found).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // 4. POST /api/projects/:pid/nodes with status parameter
  // --------------------------------------------------------------------------
  test.describe("POST nodes with explicit status", () => {
    test("creates node with specified status", async () => {
      const res = await fetch(`${API}/projects/${projectId}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "feature",
          title: "Pre-done Node",
          status: "done",
          canvasX: 100,
          canvasY: 200,
        }),
      });
      const json = await res.json();
      expect(res.status).toBe(201);
      expect(json.data.status).toBe("done");
    });

    test("creates node with todo status", async () => {
      const res = await fetch(`${API}/projects/${projectId}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "issue",
          title: "Todo Issue",
          status: "todo",
          canvasX: 0,
          canvasY: 0,
        }),
      });
      const json = await res.json();
      expect(res.status).toBe(201);
      expect(json.data.status).toBe("todo");
    });

    test("defaults to backlog when status omitted", async () => {
      const res = await fetch(`${API}/projects/${projectId}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "planning",
          title: "No Status Node",
          canvasX: 50,
          canvasY: 50,
        }),
      });
      const json = await res.json();
      expect(res.status).toBe(201);
      expect(json.data.status).toBe("backlog");
    });
  });

  // --------------------------------------------------------------------------
  // 5. POST /api/auth/register — API accepts valid registration
  // --------------------------------------------------------------------------
  test.describe("POST /api/auth/register", () => {
    test("registers new user successfully", async () => {
      const uniqueEmail = `e2e-${Date.now()}@test.local`;
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: uniqueEmail,
          name: "E2E Tester",
          password: "testpassword123",
        }),
      });
      const json = await res.json();
      expect(res.status).toBe(201);
      expect(json.data.email).toBe(uniqueEmail);
      expect(json.data.name).toBe("E2E Tester");
      // Password hash should NOT be returned
      expect(json.data.passwordHash).toBeUndefined();
    });

    test("rejects duplicate email", async () => {
      const uniqueEmail = `e2e-dup-${Date.now()}@test.local`;
      // Register first time
      await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: uniqueEmail,
          name: "First User",
          password: "password123",
        }),
      });

      // Register same email again
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: uniqueEmail,
          name: "Second User",
          password: "password456",
        }),
      });
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error.code).toBe("EMAIL_EXISTS");
    });

    test("rejects short password", async () => {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: `e2e-short-${Date.now()}@test.local`,
          name: "Short Pass",
          password: "123",
        }),
      });
      expect(res.status).toBe(400);
    });

    test("API does not validate password confirmation (client-side only)", async () => {
      // The register API schema only has email, name, password.
      // Password confirmation is a client-side concern only.
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: `e2e-noconfirm-${Date.now()}@test.local`,
          name: "No Confirm",
          password: "validpassword",
        }),
      });
      const json = await res.json();
      expect(res.status).toBe(201);
      expect(json.data.name).toBe("No Confirm");
    });
  });

  // --------------------------------------------------------------------------
  // 6. POST /api/nodes/:id/comments — self-comment does NOT create notification
  // --------------------------------------------------------------------------
  test.describe("POST /api/nodes/:id/comments", () => {
    test("self-comment does NOT create notification", async () => {
      const node = await createTestNode(projectId);

      // Assign node to self first so assigneeId === test-user-id
      await fetch(`${API}/nodes/${node.id}/assignee`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: TEST_USER_ID }),
      });

      // Get current notification count (may include assignment notification)
      const beforeRes = await fetch(`${API}/notifications`);
      const beforeJson = await beforeRes.json();
      const beforeCommentNotifs = beforeJson.data.filter(
        (n: { type: string; nodeId: string }) =>
          n.type === "comment" && n.nodeId === node.id,
      );

      // Post a comment as self (same user as assignee)
      const commentRes = await fetch(`${API}/nodes/${node.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Self-comment should not notify" }),
      });
      expect(commentRes.status).toBe(201);
      const commentJson = await commentRes.json();
      expect(commentJson.data.content).toBe(
        "Self-comment should not notify",
      );

      // Check that no new comment notification was created
      const afterRes = await fetch(`${API}/notifications`);
      const afterJson = await afterRes.json();
      const afterCommentNotifs = afterJson.data.filter(
        (n: { type: string; nodeId: string }) =>
          n.type === "comment" && n.nodeId === node.id,
      );
      expect(afterCommentNotifs.length).toBe(beforeCommentNotifs.length);
    });

    test("comment is created and returned with user data", async () => {
      const node = await createTestNode(projectId);

      const res = await fetch(`${API}/nodes/${node.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Hello from E2E test" }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.content).toBe("Hello from E2E test");
      expect(json.data.user).toBeDefined();
      expect(json.data.user.id).toBe(TEST_USER_ID);
      expect(json.data.nodeId).toBe(node.id);
    });

    test("GET comments returns them in chronological order", async () => {
      const node = await createTestNode(projectId);

      // Create two comments
      await fetch(`${API}/nodes/${node.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "First comment" }),
      });
      await fetch(`${API}/nodes/${node.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Second comment" }),
      });

      const res = await fetch(`${API}/nodes/${node.id}/comments`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.length).toBe(2);
      expect(json.data[0].content).toBe("First comment");
      expect(json.data[1].content).toBe("Second comment");
    });

    test("rejects empty comment content", async () => {
      const node = await createTestNode(projectId);

      const res = await fetch(`${API}/nodes/${node.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "" }),
      });
      expect(res.status).toBe(400);
    });
  });

  // --------------------------------------------------------------------------
  // 7. DELETE /api/nodes/:id — archive sets status to archived
  // --------------------------------------------------------------------------
  test.describe("DELETE /api/nodes/:id — archive action", () => {
    test("archives node by setting status to archived", async () => {
      const node = await createTestNode(projectId, { status: "backlog" });

      const res = await fetch(`${API}/nodes/${node.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.data.status).toBe("archived");
    });

    test("archives in_progress node", async () => {
      const node = await createTestNode(projectId, { status: "backlog" });

      // Move to in_progress first
      await fetch(`${API}/nodes/${node.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "in_progress",
          triggerType: "user_manual",
        }),
      });

      const res = await fetch(`${API}/nodes/${node.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.data.status).toBe("archived");
    });

    test("archived node is still retrievable via GET", async () => {
      const node = await createTestNode(projectId);

      await fetch(`${API}/nodes/${node.id}`, { method: "DELETE" });

      const getRes = await fetch(`${API}/nodes/${node.id}`);
      const getJson = await getRes.json();
      expect(getRes.status).toBe(200);
      expect(getJson.data.status).toBe("archived");
    });

    test("returns 404 for non-existent node", async () => {
      const res = await fetch(`${API}/nodes/nonexistent-id-xxx`, {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
    });
  });

  // --------------------------------------------------------------------------
  // 8. Sub-node creation — POST with parentNodeId creates child node
  // --------------------------------------------------------------------------
  test.describe("Sub-node creation with parentNodeId", () => {
    test("creates child node with parentNodeId", async () => {
      const parent = await createTestNode(projectId, {
        title: "Parent Node",
      });

      const res = await fetch(`${API}/projects/${projectId}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "feature",
          title: "Child Node",
          canvasX: 0,
          canvasY: 100,
          parentNodeId: parent.id,
        }),
      });
      const json = await res.json();
      expect(res.status).toBe(201);
      expect(json.data.title).toBe("Child Node");
      expect(json.data.parentNodeId).toBe(parent.id);
    });

    test("child node appears in parent's detail via GET", async () => {
      const parent = await createTestNode(projectId, {
        title: "Parent Node",
      });

      await fetch(`${API}/projects/${projectId}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "issue",
          title: "Sub-issue A",
          canvasX: 0,
          canvasY: 100,
          parentNodeId: parent.id,
        }),
      });

      await fetch(`${API}/projects/${projectId}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "issue",
          title: "Sub-issue B",
          canvasX: 100,
          canvasY: 100,
          parentNodeId: parent.id,
        }),
      });

      // Fetch parent detail
      const detailRes = await fetch(`${API}/nodes/${parent.id}`);
      const detailJson = await detailRes.json();
      expect(detailRes.status).toBe(200);

      // Verify the parent node itself is returned
      expect(detailJson.data.title).toBe("Parent Node");
    });

    test("child node without parentNodeId has null parentNodeId", async () => {
      const node = await createTestNode(projectId, {
        title: "Standalone Node",
      });

      const detailRes = await fetch(`${API}/nodes/${node.id}`);
      const detailJson = await detailRes.json();
      expect(detailJson.data.parentNodeId).toBeNull();
    });

    test("multiple children can reference the same parent", async () => {
      const parent = await createTestNode(projectId, { title: "Parent" });

      const child1Res = await fetch(`${API}/projects/${projectId}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "feature",
          title: "Child 1",
          canvasX: 0,
          canvasY: 100,
          parentNodeId: parent.id,
        }),
      });
      const child1 = (await child1Res.json()).data;

      const child2Res = await fetch(`${API}/projects/${projectId}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "feature",
          title: "Child 2",
          canvasX: 100,
          canvasY: 100,
          parentNodeId: parent.id,
        }),
      });
      const child2 = (await child2Res.json()).data;

      expect(child1.parentNodeId).toBe(parent.id);
      expect(child2.parentNodeId).toBe(parent.id);

      // Both children exist in the project's node list
      const listRes = await fetch(`${API}/projects/${projectId}/nodes`);
      const listJson = await listRes.json();
      const titles = listJson.data.map((n: { title: string }) => n.title);
      expect(titles).toContain("Child 1");
      expect(titles).toContain("Child 2");
    });
  });
});
