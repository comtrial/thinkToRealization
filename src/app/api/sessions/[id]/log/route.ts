import { NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound } from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { parseSessionLog } from "@/lib/log-parser";
import { requireLocal } from "@/lib/api-guards";

type Params = { params: Promise<{ id: string }> };

const LOG_DIR = path.join(process.cwd(), ".devflow-logs");

// GET /api/sessions/:id/log — return raw log + parsed messages
export async function GET(_req: NextRequest, { params }: Params) {
  const localGuard = requireLocal();
  if (localGuard) return localGuard;

  const { id } = await params;
  try {
    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) return notFound("Session", id);

    // Try .devflow-logs/{sessionId}.log first, then session.logFilePath fallback
    const logFile = path.join(LOG_DIR, `${id}.log`);
    const logPath = session.logFilePath || logFile;

    try {
      const raw = await fs.readFile(logPath, "utf-8");
      const messages = parseSessionLog(raw);
      return successResponse({ raw, messages });
    } catch {
      // If primary path fails and we have a different fallback, try it
      if (logPath !== logFile) {
        try {
          const raw = await fs.readFile(logFile, "utf-8");
          const messages = parseSessionLog(raw);
          return successResponse({ raw, messages });
        } catch {
          // Both paths failed
        }
      }
      return successResponse({ raw: "", messages: [] });
    }
  } catch (error) {
    return handlePrismaError(error);
  }
}
