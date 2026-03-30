import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Clean existing data
  await prisma.projectMember.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.nodeComment.deleteMany();
  await prisma.nodeStateLog.deleteMany();
  await prisma.decision.deleteMany();
  await prisma.sessionFile.deleteMany();
  await prisma.session.deleteMany();
  await prisma.edge.deleteMany();
  await prisma.node.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  // Create demo users
  const passwordHash = await bcrypt.hash("devflow123", 10);
  const admin = await prisma.user.create({
    data: { email: "admin@ttr.local", name: "관리자", passwordHash },
  });
  const dev = await prisma.user.create({
    data: { email: "dev@ttr.local", name: "개발자", passwordHash },
  });

  // Create project
  const project = await prisma.project.create({
    data: {
      title: "ThinkToRealization v2",
      slug: "ttr-v2",
      description: "사고 흐름 캔버스 기반 개발 도구",
      projectDir: process.cwd(),
      createdById: admin.id,
    },
  });

  // Create project memberships
  await prisma.projectMember.createMany({
    data: [
      { projectId: project.id, userId: admin.id, role: "owner" },
      { projectId: project.id, userId: dev.id, role: "member" },
    ],
  });

  // Create nodes
  const ideaNode = await prisma.node.create({
    data: {
      projectId: project.id,
      type: "planning",
      title: "초기 아이디어 브레인스토밍",
      description: "DevFlow v2의 핵심 컨셉과 기능 정의",
      status: "done",
      canvasX: 0,
      canvasY: 0,
    },
  });

  const prdNode = await prisma.node.create({
    data: {
      projectId: project.id,
      type: "feature",
      title: "PRD 작성",
      description: "Product Requirements Document 작성",
      status: "done",
      canvasX: 350,
      canvasY: 0,
    },
  });

  const backendNode = await prisma.node.create({
    data: {
      projectId: project.id,
      type: "feature",
      title: "백엔드 설계",
      description: "API 설계 및 데이터 모델 구현",
      status: "in_progress",
      priority: "high",
      canvasX: 700,
      canvasY: -100,
    },
  });

  const frontendNode = await prisma.node.create({
    data: {
      projectId: project.id,
      type: "feature",
      title: "프론트엔드 설계",
      description: "UI/UX 설계 및 컴포넌트 구현",
      status: "todo",
      priority: "high",
      canvasX: 700,
      canvasY: 100,
    },
  });

  const milestoneNode = await prisma.node.create({
    data: {
      projectId: project.id,
      type: "planning",
      title: "v2 MVP 완성",
      description: "핵심 기능 완성 및 테스트",
      status: "backlog",
      canvasX: 1050,
      canvasY: 0,
    },
  });

  const issueNode = await prisma.node.create({
    data: {
      projectId: project.id,
      type: "issue",
      title: "SQLite WAL 동시성 이슈",
      description: "다중 세션에서 WAL 모드 확인 필요",
      status: "todo",
      priority: "medium",
      canvasX: 700,
      canvasY: 300,
    },
  });

  // Create edges
  await prisma.edge.createMany({
    data: [
      { fromNodeId: ideaNode.id, toNodeId: prdNode.id, type: "sequence" },
      { fromNodeId: prdNode.id, toNodeId: backendNode.id, type: "sequence" },
      { fromNodeId: prdNode.id, toNodeId: frontendNode.id, type: "sequence" },
      { fromNodeId: backendNode.id, toNodeId: milestoneNode.id, type: "dependency" },
      { fromNodeId: frontendNode.id, toNodeId: milestoneNode.id, type: "dependency" },
      { fromNodeId: backendNode.id, toNodeId: issueNode.id, type: "related" },
    ],
  });

  // Create sessions
  const session1 = await prisma.session.create({
    data: {
      nodeId: prdNode.id,
      title: "PRD 초안 작성 세션",
      status: "completed",
      endedAt: new Date(),
      durationSeconds: 1200,
      fileChangeCount: 3,
    },
  });

  const session2 = await prisma.session.create({
    data: {
      nodeId: backendNode.id,
      title: "데이터 모델 설계",
      status: "completed",
      endedAt: new Date(),
      durationSeconds: 900,
      fileChangeCount: 5,
    },
  });

  await prisma.session.create({
    data: {
      nodeId: backendNode.id,
      title: "API 라우트 구현",
      status: "active",
      fileChangeCount: 8,
    },
  });

  // Create decisions
  await prisma.decision.createMany({
    data: [
      {
        nodeId: ideaNode.id,
        content: "CLI 기능 고도화 금지 -- 있는 그대로 임베드",
      },
      {
        nodeId: prdNode.id,
        sessionId: session1.id,
        content: "SQLite + Prisma ORM 사용 (Supabase 대신)",
      },
      {
        nodeId: backendNode.id,
        sessionId: session2.id,
        content: "7개 모델: Project, Node, Edge, Session, SessionFile, Decision, NodeStateLog",
      },
    ],
  });

  // Create state logs
  await prisma.nodeStateLog.createMany({
    data: [
      { nodeId: prdNode.id, fromStatus: "backlog", toStatus: "in_progress", triggerType: "session_start" },
      { nodeId: prdNode.id, fromStatus: "in_progress", toStatus: "done", triggerType: "session_end_done" },
      { nodeId: backendNode.id, fromStatus: "backlog", toStatus: "in_progress", triggerType: "session_start" },
    ],
  });

  // Assign users to nodes
  await prisma.node.update({ where: { id: backendNode.id }, data: { assigneeId: admin.id } });
  await prisma.node.update({ where: { id: frontendNode.id }, data: { assigneeId: dev.id } });

  // Create demo comments
  await prisma.nodeComment.createMany({
    data: [
      { nodeId: backendNode.id, userId: dev.id, content: "API 설계 관련해서 리뷰 부탁드립니다" },
      { nodeId: backendNode.id, userId: admin.id, content: "좋습니다, 확인하겠습니다" },
      { nodeId: issueNode.id, userId: admin.id, content: "busy_timeout 설정으로 해결 가능할 것 같습니다" },
    ],
  });

  // Create demo notification
  await prisma.notification.create({
    data: {
      userId: admin.id,
      type: "comment",
      title: "새 댓글",
      body: "개발자님이 '백엔드 설계' 노드에 댓글을 남겼습니다",
      nodeId: backendNode.id,
      actorId: dev.id,
    },
  });

  console.log("Seed completed:", {
    project: project.title,
    users: 2,
    members: 2,
    nodes: 6,
    edges: 6,
    sessions: 3,
    decisions: 3,
    comments: 3,
    notifications: 1,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
