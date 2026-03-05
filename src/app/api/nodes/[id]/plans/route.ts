import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound, errorResponse } from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { assembleContext } from "../../../../../../server/context/context-assembler";
import { executeClaude } from "../../../../../../server/cli/cli-manager";
import { ensureProjectPlanDir } from "../../../../../../server/db/devflow-config";
import { planContentSchema } from "@/lib/schemas/plan";
import fs from "fs";
import path from "path";

type Params = { params: Promise<{ id: string }> };

// GET /api/nodes/:id/plans — list plans for a node
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const node = await prisma.node.findUnique({ where: { id } });
    if (!node) return notFound("Node", id);

    const plans = await prisma.plan.findMany({
      where: { nodeId: id },
      orderBy: { createdAt: "desc" },
    });

    // Parse content JSON for each plan
    const parsed = plans.map((p) => ({
      ...p,
      content: JSON.parse(p.content),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));

    return successResponse(parsed);
  } catch (error) {
    return handlePrismaError(error);
  }
}

// POST /api/nodes/:id/plans — generate a new plan via Claude CLI
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const node = await prisma.node.findUnique({
      where: { id },
      include: { project: { select: { id: true, projectDir: true } } },
    });
    if (!node) return notFound("Node", id);

    // 1. Assemble context
    const context = await assembleContext(prisma, id);

    // 2. Determine version number
    const lastPlan = await prisma.plan.findFirst({
      where: { nodeId: id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (lastPlan?.version ?? 0) + 1;

    // 3. Execute Claude CLI
    const cliResult = await executeClaude(context.prompt, {
      cwd: node.project.projectDir || undefined,
    });

    if (!cliResult.success && !cliResult.rawOutput) {
      return errorResponse(
        "CLI_ERROR",
        cliResult.error || "Claude CLI execution failed",
        500
      );
    }

    // 4. Parse plan content from CLI response
    let planContent: unknown;
    const rawResponse = cliResult.rawOutput;

    if (cliResult.data) {
      // CLI returned valid JSON — try to extract the plan content
      // The CLI --output-format json wraps output; extract the text result
      const cliData = cliResult.data as Record<string, unknown>;
      const resultText =
        typeof cliData === "string"
          ? cliData
          : typeof cliData.result === "string"
            ? cliData.result
            : JSON.stringify(cliData);

      // Try parsing the result text as plan JSON
      try {
        planContent = JSON.parse(resultText);
      } catch {
        // Try to find JSON in the text
        const jsonMatch = resultText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            planContent = JSON.parse(jsonMatch[0]);
          } catch {
            planContent = null;
          }
        }
      }
    } else {
      // Try extracting JSON from raw output
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          planContent = JSON.parse(jsonMatch[0]);
        } catch {
          planContent = null;
        }
      }
    }

    // Validate plan content structure
    const validated = planContent ? planContentSchema.safeParse(planContent) : null;

    const contentToStore = validated?.success
      ? validated.data
      : {
          summary: "Plan generated but could not be parsed into structured format",
          affectedFiles: [],
          changes: [],
          testPlan: [],
          risks: [],
        };

    // 5. Save plan to database
    const plan = await prisma.plan.create({
      data: {
        nodeId: id,
        version: nextVersion,
        status: validated?.success ? "draft" : "draft",
        content: JSON.stringify(contentToStore),
        prompt: context.prompt,
        rawResponse: rawResponse || null,
      },
    });

    // 6. Backup to ~/.devflow/
    try {
      const planDir = ensureProjectPlanDir(node.project.id);
      fs.writeFileSync(
        path.join(planDir, `${plan.id}.json`),
        JSON.stringify(
          { ...plan, content: contentToStore },
          null,
          2
        )
      );
    } catch {
      // Non-critical — log but don't fail
      console.warn("Failed to backup plan to ~/.devflow/");
    }

    return successResponse(
      {
        ...plan,
        content: contentToStore,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
      },
      201
    );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Node not found")) {
      return errorResponse("NODE_NOT_FOUND", error.message, 404);
    }
    return handlePrismaError(error);
  }
}
