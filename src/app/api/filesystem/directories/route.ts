import { NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { successResponse, errorResponse } from "@/lib/api-response";
import { requireLocal } from "@/lib/api-guards";

export const dynamic = "force-dynamic";

interface DirectoryEntry {
  name: string;
  path: string;
  hasGit: boolean;
  hasClaudeMd: boolean;
}

// Security: restrict to home directory subtree
const HOME_DIR = process.env.HOME || "/Users";
const ALLOWED_ROOT = process.env.FILESYSTEM_ROOT || HOME_DIR;

function isPathAllowed(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  return resolved.startsWith(ALLOWED_ROOT);
}

export async function GET(request: NextRequest) {
  const localGuard = requireLocal();
  if (localGuard) return localGuard;

  const searchParams = request.nextUrl.searchParams;
  const targetPath = searchParams.get("path") || ALLOWED_ROOT;

  if (!isPathAllowed(targetPath)) {
    return errorResponse("FORBIDDEN", "Access to this path is not allowed", 403);
  }

  try {
    const stat = await fs.stat(targetPath);
    if (!stat.isDirectory()) {
      return errorResponse("VALIDATION_ERROR", "Path is not a directory", 400);
    }

    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    const directories: DirectoryEntry[] = [];

    for (const entry of entries) {
      // Skip hidden directories (except .git which we check for)
      if (entry.name.startsWith(".") || !entry.isDirectory()) continue;
      // Skip common non-project directories
      if (["node_modules", "__pycache__", ".next", "dist", "build"].includes(entry.name)) continue;

      const fullPath = path.join(targetPath, entry.name);
      let hasGit = false;
      let hasClaudeMd = false;

      try {
        await fs.access(path.join(fullPath, ".git"));
        hasGit = true;
      } catch {
        // no .git
      }

      try {
        await fs.access(path.join(fullPath, "CLAUDE.md"));
        hasClaudeMd = true;
      } catch {
        // no CLAUDE.md
      }

      directories.push({
        name: entry.name,
        path: fullPath,
        hasGit,
        hasClaudeMd,
      });
    }

    // Sort: directories with .git first, then alphabetical
    directories.sort((a, b) => {
      if (a.hasGit !== b.hasGit) return a.hasGit ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return successResponse({
      currentPath: targetPath,
      parentPath: path.dirname(targetPath) !== targetPath ? path.dirname(targetPath) : null,
      directories,
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return errorResponse("NOT_FOUND", "Directory not found", 404);
    }
    if ((err as NodeJS.ErrnoException).code === "EACCES") {
      return errorResponse("FORBIDDEN", "Permission denied", 403);
    }
    console.error("Filesystem API error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to read directory", 500);
  }
}
