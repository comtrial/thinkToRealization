import { NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { successResponse, errorResponse } from "@/lib/api-response";
import { requireLocal } from "@/lib/api-guards";

const HOME_DIR = process.env.HOME || "/Users";
const ALLOWED_ROOT = process.env.FILESYSTEM_ROOT || HOME_DIR;

// Only allow reading specific file names for security
const ALLOWED_FILENAMES = ["CLAUDE.md"];
const MAX_FILE_SIZE = 32 * 1024; // 32KB

function isPathAllowed(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  return resolved.startsWith(ALLOWED_ROOT);
}

export async function GET(request: NextRequest) {
  const localGuard = requireLocal();
  if (localGuard) return localGuard;

  const filePath = request.nextUrl.searchParams.get("path");
  if (!filePath) {
    return errorResponse("VALIDATION_ERROR", "path parameter required", 400);
  }

  if (!isPathAllowed(filePath)) {
    return errorResponse("FORBIDDEN", "Access to this path is not allowed", 403);
  }

  const fileName = path.basename(filePath);
  if (!ALLOWED_FILENAMES.includes(fileName)) {
    return errorResponse("FORBIDDEN", "Only CLAUDE.md files can be read", 403);
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return errorResponse("VALIDATION_ERROR", "Path is not a file", 400);
    }
    if (stat.size > MAX_FILE_SIZE) {
      return errorResponse("VALIDATION_ERROR", "File too large (max 32KB)", 400);
    }

    const content = await fs.readFile(filePath, "utf-8");
    return successResponse({ path: filePath, content });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return errorResponse("NOT_FOUND", "File not found", 404);
    }
    console.error("File read error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to read file", 500);
  }
}
