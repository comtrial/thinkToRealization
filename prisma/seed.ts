import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_STAGES = [
  { name: "아이디어 발산", orderIndex: 0 },
  { name: "문제 정의", orderIndex: 1 },
  { name: "기능 구조화", orderIndex: 2 },
  { name: "기술 설계", orderIndex: 3 },
  { name: "구현", orderIndex: 4 },
  { name: "검증/회고", orderIndex: 5 },
];

async function main() {
  // Create sample project
  const project = await prisma.project.create({
    data: {
      name: "DevFlow 시스템",
      description: "사고 흐름 운영 시스템 PRD 작성 중",
      status: "active",
    },
  });

  // Create stages
  const stages = await Promise.all(
    DEFAULT_STAGES.map((stage) =>
      prisma.stage.create({
        data: {
          projectId: project.id,
          name: stage.name,
          orderIndex: stage.orderIndex,
          status: stage.orderIndex === 0 ? "active" : "waiting",
        },
      })
    )
  );

  // Create initial activity
  await prisma.activity.create({
    data: {
      projectId: project.id,
      stageId: stages[0].id,
      activityType: "project_created",
      description: "프로젝트가 생성되었습니다",
    },
  });

  // Create a sample session on first stage
  const session = await prisma.session.create({
    data: {
      stageId: stages[0].id,
      title: "초기 아이디어 브레인스토밍",
    },
  });

  // Create a sample decision
  await prisma.decision.create({
    data: {
      stageId: stages[0].id,
      sessionId: session.id,
      content: "CLI 기능 고도화 금지 — 있는 그대로 임베드",
      context: "PRD 설계 철학에 따라 상위 레이어에 집중",
    },
  });

  console.log("Seed completed:", { project: project.name, stages: stages.length });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
